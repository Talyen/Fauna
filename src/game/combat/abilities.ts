import { battlefield } from "../battlefield";
import { summonEcho, createPearls, drawBossCards } from "./legendary";
import { definition, species, type CardDefinition } from "../content";
import { creaturePassive, hasTalent } from "../progression";
import { definitionKeywords } from "../keywords";
import { abilityExtras, scalePower } from "./ability-values";
import {
  combat,
  grantBlock,
  grantStatus,
  grantArmor,
  restoreHealth,
  triggerArmorBreak,
  removeArmor,
  applyBlind,
  removeEffects,
  gainMana,
  beginAttack,
  openingCriticalBonus,
  hit,
  mostInjured,
  grantTemporaryDodge,
  removeControlBuildup,
  type Combatant,
} from "./index";
import { roll } from "../random";
import { fillHand, MAX_HAND_SIZE, draw } from "../card-zones";
import type { Creature, Enemy, GameState, GameEvent, BattleState } from "../types";

type AbilityAction = {
  def: CardDefinition;
  value: number;
  targetId?: string;
  allyTargetId?: string;
} & ({ side: "player"; actor: Creature } | { side: "enemy"; actor: Enemy });
interface AbilityOperations {
  swap: (state: GameState, actor: Combatant, events: GameEvent[]) => void;
}
const actorPower = (action: AbilityAction) => (action.side === "enemy" ? action.actor.power : 1);
const friendlyRow = (state: GameState, action: AbilityAction): Combatant[] => battlefield(state, action.side);
const opposingRow = (state: GameState, action: AbilityAction): Combatant[] =>
  battlefield(state, action.side === "player" ? "enemy" : "player");
const alive = (row: Combatant[]) => row.filter((unit) => unit.health > 0);

function encore(state: GameState, actor: Combatant) {
  const stats = combat(actor);
  const chance = creaturePassive("maxHealth" in actor ? undefined : state, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "encore" ? effect.amount : 0),
    0,
  );
  if (chance <= 0 || stats.encoreUsed) return false;
  stats.encoreUsed = true;
  return roll(state) < chance / 100;
}
function kindlingFlourish(state: GameState, actor: Combatant) {
  const stats = combat(actor);
  if (stats.cardsPlayedThisTurn >= 2) return false;
  stats.cardsPlayedThisTurn++;
  if (stats.cardsPlayedThisTurn !== 2) return false;
  const chance = creaturePassive("maxHealth" in actor ? undefined : state, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "kindlingFlourish" ? effect.amount : 0),
    0,
  );
  return chance > 0 && (chance === 100 || roll(state) < chance / 100);
}
function recoverDiscard(state: GameState, events: GameEvent[]) {
  const battle = state.battle!;
  const available = battle.discard.filter((id) => {
    const card = state.cards.find((entry) => entry.id === id)!;
    return state.team.some((unit) => unit.id === card.ownerId && unit.health > 0);
  });
  if (!available.length) return;
  const id = available[Math.floor(roll(state) * available.length)]!;
  battle.discard.splice(battle.discard.indexOf(id), 1);
  fillHand(state);
  (battle.hand.length < MAX_HAND_SIZE ? battle.hand : battle.buffer).push(id);
  const card = state.cards.find((entry) => entry.id === id)!;
  events.push({
    kind: "action",
    actionType: "support",
    actorId: card.ownerId,
    text: `${definition(card.definitionId).name} returns to your hand`,
  });
}
function hushDome(state: GameState, enemy: boolean, events: GameEvent[]) {
  for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
    if (unit.health <= 0) continue;
    combat(unit).nullify = true;
    events.push({
      kind: "status",
      targetId: unit.id,
      status: "nullify",
      outcome: "apply",
      text: `${species(unit.species).name} nullifies the next harmful status effect`,
    });
  }
}

function teamProtection(
  state: GameState,
  enemy: boolean,
  amount: number,
  events: GameEvent[],
  power: number,
) {
  const block = roll(state) < 0.5;
  for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
    if (unit.health <= 0) continue;
    if (block) grantBlock(state, unit, scalePower(amount, power), events);
    else grantStatus(unit, "thorns", amount, events, state);
  }
}

function applyExtras(
  state: GameState,
  action: AbilityAction,
  events: GameEvent[],
  options: { target?: Combatant; blindMiss?: boolean; criticalBonus?: number; recipientOnly?: boolean } = {},
) {
  const { actor, def } = action;
  const enemy = action.side === "enemy";
  const power = enemy ? actorPower(action) : 1;
  const { target, blindMiss = false, criticalBonus = 0, recipientOnly = false } = options;
  for (const effect of abilityExtras(def, power)) {
    // Targeted Cleanse follows each healed ally; global extras run once after the primary effect
    if (recipientOnly !== (effect.kind === "cleanse" && effect.target === "recipient")) continue;
    if (actor.health <= 0) break;
    const kind = effect.kind;
    switch (kind) {
      case "damage":
        if (target)
          hit(state, actor, target, effect.amount, effect.damageType, events, {
            origin: "ability",
            blindMiss,
            criticalBonus,
            leech: effect.leech,
            cardLeech: def.leech || def.effects?.some((effect) => effect.kind === "damage" && effect.leech),
          });
        break;
      case "status":
        if (effect.status === "armor") grantArmor(state, actor, effect.amount, events);
        else grantStatus(actor, effect.status, effect.amount, events, state);
        break;
      case "meltArmor":
        for (const recipient of battlefield(state, enemy ? "player" : "enemy")) {
          if (actor.health <= 0) break;
          if (recipient.health <= 0) continue;
          const stats = combat(recipient);
          const { removed, depletion } = removeArmor(
            recipient,
            Math.ceil((stats.armor * effect.amount) / 100),
          );
          if (!removed) continue;
          events.push({
            kind: "status",
            actorId: actor.id,
            targetId: recipient.id,
            status: "armor",
            outcome: "remove",
            amount: removed,
            text: `${species(recipient.species).name} loses ${removed} Armor`,
          });
          triggerArmorBreak(state, depletion, events);
        }
        break;
      case "blind":
        for (const recipient of battlefield(state, enemy ? "player" : "enemy"))
          if (recipient.health > 0) applyBlind(state, actor, recipient, events);
        break;
      case "nullifyFreeze":
        combat(actor).nullifyFreeze = true;
        events.push({
          kind: "status",
          targetId: actor.id,
          status: "nullify",
          outcome: "apply",
          text: "Nullify the next Freeze damage",
        });
        break;
      case "reflect":
        if (effect.status === "burn") combat(actor).reflectBurn = true;
        else combat(actor).reflect = true;
        events.push({
          kind: "status",
          targetId: actor.id,
          status: "reflect",
          outcome: "apply",
          text: effect.status === "burn" ? "Reflect the next Burn" : "Reflect the next harmful status effect",
        });
        break;
      case "cleanse":
        for (const recipient of effect.target === "allAllies"
          ? battlefield(state, enemy ? "enemy" : "player").filter((unit) => unit.health > 0)
          : [effect.target === "recipient" && target ? target : actor])
          removeEffects(recipient, "cleanse", effect.amount, events, state);
        break;
      case "purge":
        if (target) removeEffects(target, "purge", effect.amount, events, state);
        break;
      case "heal":
        restoreHealth(actor, effect.amount, events, false, state, true, actor);
        break;
      case "draw":
        if (!enemy) draw(state, effect.amount, events);
        break;
      case "mana":
        if (!enemy) gainMana(state, effect.amount, events);
        break;
      default: {
        const unhandled: never = kind;
        throw new Error(`Unhandled extra effect: ${unhandled}`);
      }
    }
  }
}
/** Runs inside the command draft; command costs, counters and settlement stay with the caller. */
export function executeAbility(
  state: BattleState,
  action: AbilityAction,
  events: GameEvent[],
  operations: AbilityOperations,
) {
  const { actor, def, value } = action;
  const enemy = action.side === "enemy";
  const power = actorPower(action);
  const opponents = alive(opposingRow(state, action));
  // Select once for the whole ability, including repeats. Group targets are read again per resolution.
  const target =
    def.effect === "attack" && def.target === "randomEnemy"
      ? opponents[Math.floor(roll(state) * opponents.length)]
      : def.effect === "attack" && def.target === "allEnemies"
        ? undefined
        : opponents.find((unit) => unit.id === action.targetId);
  const name = enemy ? action.actor.name : species(actor.species).name;
  events.push({
    kind: "action",
    actionType: def.effect === "attack" ? "attack" : "support",
    actorId: actor.id,
    targetId: enemy
      ? def.effect === "attack" && def.target === "allEnemies"
        ? undefined
        : target?.id
      : action.targetId,
    text: `${name} uses ${def.name}.`,
  });
  const keywords = definitionKeywords(def);
  if (!enemy) {
    if (target && keywords.includes("leech") && hasTalent(state, "leech.armor-siphon")) {
      const { removed: stolen, depletion } = removeArmor(target, 1);
      grantArmor(state, actor, stolen, events);
      triggerArmorBreak(state, depletion, events);
    }
    if (keywords.includes("block") && hasTalent(state, "armor.armored-surge") && roll(state) < 0.1)
      grantArmor(state, actor, 6, events);
  }
  if (actor.health <= 0) return;
  const flourishRepeat = kindlingFlourish(state, actor);
  const encoreRepeat = encore(state, actor);
  const abilityRepeat = def.repeatChance !== undefined && roll(state) < def.repeatChance / 100;
  const repeatTalents = [
    ["burn", "burn.flash-fire"],
    ["freeze", "freeze.winter-s-grasp"],
    ["nature", "nature.overgrowth"],
    ["poison", "poison.venom-strike"],
    ["stun", "stun.jarring-blow"],
  ] as const;
  const repeat =
    !enemy &&
    repeatTalents.some(
      ([keyword, talent]) => keywords.includes(keyword) && hasTalent(state, talent) && roll(state) < 0.1,
    );
  for (let play = 0; play < (repeat || encoreRepeat || abilityRepeat || flourishRepeat ? 2 : 1); play++) {
    if (
      actor.health <= 0 ||
      (def.effect === "attack" &&
        (def.target === "allEnemies"
          ? !alive(opposingRow(state, action)).length
          : !target || target.health <= 0))
    )
      break;
    if (play === 1 && (encoreRepeat || abilityRepeat || flourishRepeat))
      events.push({
        kind: "action",
        actionType: "support",
        actorId: actor.id,
        text: `${name} repeats ${def.name}${flourishRepeat ? " with Kindling Flourish" : encoreRepeat ? " with Encore" : ""}`,
      });
    const criticalBonus = def.effect === "attack" ? openingCriticalBonus(state, actor) : 0;
    const blindMiss = def.effect === "attack" ? beginAttack(state, actor) : false;
    const kind = def.effect;
    switch (kind) {
      case "procession":
        summonEcho(state, actor, action.side, value, events);
        break;
      case "createPearls":
        createPearls(state, actor, action.side, value, events);
        break;
      case "pearl":
        if (roll(state) < 0.5) grantBlock(state, actor, scalePower(value, power), events);
        else if (action.side === "enemy" && action.actor.deck)
          action.actor.deck.mana = Math.min(4, action.actor.deck.mana + value);
        else gainMana(state, value, events);
        break;
      case "attack": {
        const damageType =
          def.alternateDamageType && roll(state) < 0.5 ? def.alternateDamageType : def.damageType;
        const targets =
          def.target === "allEnemies"
            ? alive(opposingRow(state, action))
            : target && target.health > 0
              ? [target]
              : [];
        for (const recipient of targets) {
          if (actor.health <= 0) break;
          hit(state, actor, recipient, value, damageType, events, {
            origin: "ability",
            blindMiss,
            criticalBonus,
            leech: def.leech,
            cardLeech: keywords.includes("leech"),
          });
        }
        if (action.side === "player") action.actor.attacked = true;
        break;
      }
      case "guard":
      case "teamGuard": {
        const targets =
          def.effect === "teamGuard"
            ? alive(friendlyRow(state, action))
            : def.target === "self"
              ? [actor]
              : friendlyRow(state, action).filter((unit) => unit.id === action.allyTargetId);
        for (const recipient of targets) grantBlock(state, recipient, value, events);
        break;
      }
      case "heal": {
        const allies = friendlyRow(state, action);
        const targets =
          def.target === "allAllies"
            ? alive(allies)
            : def.target === "self"
              ? [actor]
              : def.target === "mostInjured"
                ? [mostInjured(allies)!]
                : allies.filter((unit) => unit.id === action.allyTargetId && unit.health > 0);
        for (const recipient of targets) {
          restoreHealth(recipient, value, events, false, state, true, actor);
          applyExtras(state, action, events, { target: recipient, recipientOnly: true });
        }
        break;
      }
      case "waterThorns":
        grantStatus(actor, "waterThorns", value, events, state);
        break;
      case "draw":
        if (action.side === "enemy" && action.actor.deck) drawBossCards(state, action.actor.deck, value);
        else if (!enemy) draw(state, value, events);
        break;
      case "recover":
        if (!enemy) recoverDiscard(state, events);
        break;
      case "mana":
        if (!enemy) gainMana(state, value, events);
        break;
      case "teamDodge":
        for (const unit of alive(friendlyRow(state, action))) grantTemporaryDodge(unit, value, events);
        break;
      case "dodge":
        grantTemporaryDodge(actor, value, events);
        break;
      case "teamThaw":
        for (const unit of alive(friendlyRow(state, action)))
          removeControlBuildup(state, unit, "freeze", events);
        break;
      case "teamBlind":
        for (const unit of alive(opposingRow(state, action))) applyBlind(state, actor, unit, events);
        break;
      case "teamPurge":
        for (const unit of alive(opposingRow(state, action))) {
          if (actor.health <= 0) break;
          removeEffects(unit, "purge", Number.MAX_SAFE_INTEGER, events, state);
        }
        break;
      case "teamCleanse":
        for (const unit of alive(friendlyRow(state, action)))
          removeEffects(unit, "cleanse", value, events, state);
        break;
      case "nullify":
        hushDome(state, enemy, events);
        break;
      case "teamProtection":
        teamProtection(state, enemy, value, events, power);
        break;
      case "swap":
        operations.swap(state, actor, events);
        break;
      default: {
        const unhandled: never = kind;
        throw new Error(`Unhandled ability effect: ${unhandled}`);
      }
    }
    applyExtras(state, action, events, { target, blindMiss, criticalBonus });
  }
}

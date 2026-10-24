import { cardActor, drawableOwnerIds } from "../card-actors";
import { createFood } from "./food";
import { takeAttackReflection } from "./attack-reflection";
import { resurrect } from "./resurrection";
import { cardTargeting } from "../card-rules";
import { interceptAttack } from "./interception";
import { battlefield, isRosterCreature } from "../battlefield";
import { summonEcho, createPearls, drawBossCards } from "./legendary";
import { definition, species, type CardDefinition } from "../content";
import { creaturePassive, hasTalent } from "../progression";
import { definitionKeywords } from "../keywords";
import { abilityExtras, scalePower } from "./ability-values";
import {
  ensureCombat,
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
  negateAttack,
  mostInjured,
  grantTemporaryDodge,
  removeControlBuildup,
  type Combatant,
} from "./index";
import { chance as succeeds } from "../chance";
import { roll } from "../random";
import { fillHand, MAX_HAND_SIZE, draw, drawKeyword, redrawHand } from "../card-zones";
import type { Creature, Enemy, GameState, GameEvent, BattleState } from "../types";

type AbilityAction = {
  def: CardDefinition;
  value: number;
  targetId?: string;
  allyTargetId?: string;
} & ({ side: "player"; actor: Creature } | { side: "enemy"; actor: Enemy });
interface AbilityOperations {
  swap: (state: GameState, actor: Combatant, events: GameEvent[], backupOnly?: boolean) => void;
}
const actorPower = (action: AbilityAction) => (action.side === "enemy" ? action.actor.power : 1);
const friendlyRow = (state: GameState, action: AbilityAction): Combatant[] => battlefield(state, action.side);
const opposingRow = (state: GameState, action: AbilityAction): Combatant[] =>
  battlefield(state, action.side === "player" ? "enemy" : "player");
const alive = (row: Combatant[]) => row.filter((unit) => unit.health > 0);

function encore(state: GameState, actor: Combatant, events: GameEvent[]) {
  const stats = ensureCombat(actor);
  const chance = creaturePassive(isRosterCreature(actor) ? state : undefined, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "encore" ? effect.amount : 0),
    0,
  );
  if (chance <= 0 || stats.encoreUsed) return false;
  stats.encoreUsed = true;
  return succeeds(state, chance / 100, !isRosterCreature(actor), events);
}
function kindlingFlourish(state: GameState, actor: Combatant, events: GameEvent[]) {
  const chance = creaturePassive(isRosterCreature(actor) ? state : undefined, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "kindlingFlourish" ? effect.amount : 0),
    0,
  );
  return succeeds(state, chance / 100, !isRosterCreature(actor), events);
}
function recoverDiscard(state: GameState, events: GameEvent[]) {
  const battle = state.battle!;
  const available = battle.discard.filter((id) => {
    const card = state.cards.find((entry) => entry.id === id)!;
    return card.ownerId === null || drawableOwnerIds(state).has(card.ownerId);
  });
  if (!available.length) return;
  const id =
    available[Math.floor(roll(state, { kind: "index", size: available.length }) * available.length)]!;
  battle.discard.splice(battle.discard.indexOf(id), 1);
  fillHand(state);
  (battle.hand.length < MAX_HAND_SIZE ? battle.hand : battle.buffer).push(id);
  const card = state.cards.find((entry) => entry.id === id)!;
  events.push({
    kind: "action",
    actionType: "support",
    actorId: card.ownerId ?? cardActor(state, card)!.id,
    text: `${definition(card.definitionId).name} returns to your hand`,
  });
}
function hushDome(state: GameState, enemy: boolean, events: GameEvent[]) {
  for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
    if (unit.health <= 0) continue;
    ensureCombat(unit).nullify = true;
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
  const block = roll(state, { kind: "chance", threshold: 0.5 }) < 0.5;
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
  options: {
    target?: Combatant;
    blindMiss?: boolean;
    criticalBonus?: number;
    recipientOnly?: boolean;
    negated?: ReadonlySet<string>;
  } = {},
) {
  const { actor, def } = action;
  const enemy = action.side === "enemy";
  const power = enemy ? actorPower(action) : 1;
  const { target, blindMiss = false, criticalBonus = 0, recipientOnly = false } = options;
  for (const effect of abilityExtras(def, power)) {
    // Recipient effects follow the primary recipient; global extras resolve separately.
    if (
      recipientOnly !==
      ((effect.kind === "cleanse" || effect.kind === "heal") && effect.target === "recipient")
    )
      continue;
    if (actor.health <= 0) break;
    const kind = effect.kind;
    switch (kind) {
      case "damage":
        if (target && !options.negated?.has(target.id))
          hit(state, actor, target, effect.amount, effect.damageType, events, {
            origin: "ability",
            interceptionChecked: true,
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
          if (recipient.health <= 0 || options.negated?.has(recipient.id)) continue;
          const stats = ensureCombat(recipient);
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
          if (recipient.health > 0 && !options.negated?.has(recipient.id))
            applyBlind(state, actor, recipient, events);
        break;
      case "nullifyFreeze":
        ensureCombat(actor).nullifyFreeze = true;
        events.push({
          kind: "status",
          targetId: actor.id,
          status: "nullify",
          outcome: "apply",
          text: "Nullify the next Freeze damage",
        });
        break;
      case "reflect":
        if (effect.status === "burn") ensureCombat(actor).reflectBurn = true;
        else ensureCombat(actor).reflect = true;
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
        if (target && !options.negated?.has(target.id))
          removeEffects(target, "purge", effect.amount, events, state);
        break;
      case "heal": {
        const recipient = effect.target === "recipient" ? target : actor;
        if (recipient) restoreHealth(recipient, effect.amount, events, false, state, true, actor);
        break;
      }
      case "drawKeyword":
        if (!enemy) for (let i = 0; i < effect.amount; i++) drawKeyword(state, effect.keyword, events);
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
      ? opponents[Math.floor(roll(state, { kind: "index", size: opponents.length }) * opponents.length)]
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
    if (
      keywords.includes("block") &&
      hasTalent(state, "armor.armored-surge") &&
      succeeds(state, 0.1, enemy, events)
    )
      grantArmor(state, actor, 6, events);
  }
  if (actor.health <= 0) return;
  const stats = ensureCombat(actor);
  const previousPlays = stats.cardsPlayedThisTurn;
  stats.cardsPlayedThisTurn = Math.min(2, previousPlays + 1);
  const flourishRepeat = previousPlays === 1 && kindlingFlourish(state, actor, events);
  const encoreRepeat = encore(state, actor, events);
  const abilityRepeat =
    def.repeatChance !== undefined && succeeds(state, def.repeatChance / 100, enemy, events);
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
      ([keyword, talent]) =>
        keywords.includes(keyword) && hasTalent(state, talent) && succeeds(state, 0.1, enemy, events),
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
    let attackTarget = target;
    const negated = new Set<string>();
    const criticalBonus = def.effect === "attack" ? openingCriticalBonus(state, actor) : 0;
    const blindMiss = def.effect === "attack" ? beginAttack(state, actor, events) : false;
    const kind = def.effect;
    switch (kind) {
      case "procession":
        summonEcho(state, actor, action.side, value, events);
        break;
      case "createFood":
        if (action.side === "player") createFood(state, action.actor, value, events);
        break;
      case "createPearls":
        createPearls(state, actor, action.side, value, events);
        break;
      case "pearl":
        if (roll(state, { kind: "chance", threshold: 0.5 }) < 0.5)
          grantBlock(state, actor, scalePower(value, power), events);
        else if (action.side === "enemy" && action.actor.deck)
          action.actor.deck.mana = Math.min(4, action.actor.deck.mana + value);
        else gainMana(state, value, events);
        break;
      case "attack": {
        const damageType =
          def.alternateDamageType && roll(state, { kind: "chance", threshold: 0.5 }) < 0.5
            ? def.alternateDamageType
            : def.damageType;
        const targets =
          def.target === "allEnemies"
            ? alive(opposingRow(state, action))
            : target && target.health > 0
              ? [target]
              : [];
        for (const intended of targets) {
          if (actor.health <= 0) break;
          const recipient = blindMiss ? intended : interceptAttack(state, actor, intended, events);
          if (def.target !== "allEnemies") attackTarget = recipient;
          if (!blindMiss && negateAttack(state, actor, recipient, events)) {
            negated.add(recipient.id);
            continue;
          }
          if (!blindMiss && takeAttackReflection(actor, recipient, events)) {
            negated.add(recipient.id);
            if (negateAttack(state, recipient, actor, events)) continue;
            if (def.purgeThorns) {
              ensureCombat(actor).thorns = 0;
              ensureCombat(actor).waterThorns = 0;
            }
            hit(
              state,
              recipient,
              actor,
              value * (def.doubleAgainstHealthier && recipient.health > actor.health ? 2 : 1),
              damageType,
              events,
              {
                origin: "ability",
                delivery: "reflection",
                interceptionChecked: true,
                blindMiss: false,
                leech: def.leech,
                cardLeech: keywords.includes("leech"),
              },
            );
            // Only harmful attack extras return; the attacker's own support effects keep their owner.
            for (const effect of abilityExtras(def, power)) {
              if (actor.health <= 0 || recipient.health <= 0) break;
              if (effect.kind === "damage")
                hit(state, recipient, actor, effect.amount, effect.damageType, events, {
                  origin: "ability",
                  delivery: "reflection",
                  interceptionChecked: true,
                  blindMiss: false,
                  leech: effect.leech,
                });
              else if (effect.kind === "blind") applyBlind(state, recipient, actor, events);
              else if (effect.kind === "purge") removeEffects(actor, "purge", effect.amount, events, state);
              else if (effect.kind === "meltArmor") {
                const { depletion } = removeArmor(
                  actor,
                  Math.ceil((ensureCombat(actor).armor * effect.amount) / 100),
                );
                triggerArmorBreak(state, depletion, events);
              }
            }
            continue;
          }
          if (def.purgeThorns) {
            const stats = ensureCombat(recipient);
            for (const status of ["thorns", "waterThorns"] as const) {
              const removed = stats[status];
              stats[status] = 0;
              if (removed)
                events.push({
                  kind: "status",
                  actorId: actor.id,
                  targetId: recipient.id,
                  status: "purge",
                  affectedStatus: status,
                  outcome: "remove",
                  amount: -removed,
                  text: `Purge ${status === "thorns" ? "Thorns" : "Water Thorns"}`,
                });
            }
          }
          hit(
            state,
            actor,
            recipient,
            value * (def.doubleAgainstHealthier && recipient.health > actor.health ? 2 : 1),
            damageType,
            events,
            {
              origin: "ability",
              interceptionChecked: true,
              blindMiss,
              criticalBonus,
              leech: def.leech,
              cardLeech: keywords.includes("leech"),
            },
          );
        }
        if (action.side === "player") action.actor.attacked = true;
        break;
      }
      case "guard":
      case "teamGuard": {
        const targets =
          def.effect === "teamGuard"
            ? alive(friendlyRow(state, action))
            : cardTargeting(def) === "self"
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
            : cardTargeting(def) === "self"
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
      case "reflectAttack":
        stats.attackReflection = true;
        events.push({
          kind: "status",
          status: "attackReflection",
          outcome: "apply",
          actorId: actor.id,
          targetId: actor.id,
          text: `${name} reflects the next attack`,
        });
        break;
      case "resurrect": {
        const recipients = enemy ? state.battle.enemies : [...state.team, ...state.reserves];
        const recipient = recipients.find((unit) => unit.id === action.allyTargetId && unit.health === 0);
        if (recipient) resurrect(recipient, actor, events);
        break;
      }
      case "dreamDouble":
        grantStatus(actor, "thorns", value, events, state);
        ensureCombat(actor).negate = true;
        events.push({
          kind: "status",
          actorId: actor.id,
          targetId: actor.id,
          status: "negate",
          outcome: "apply",
          text: `${name} negates the next attack against them`,
        });
        break;
      case "nightmareHarvest": {
        let removed = 0;
        for (const recipient of alive(friendlyRow(state, action)))
          removed += removeEffects(recipient, "cleanse", Number.MAX_SAFE_INTEGER, events, state);
        if (!enemy) gainMana(state, removed * value, events);
        else if (action.side === "enemy" && action.actor.deck)
          action.actor.deck.mana = Math.min(4, action.actor.deck.mana + removed * value);
        break;
      }
      case "waterThorns":
        grantStatus(actor, "waterThorns", value, events, state);
        break;
      case "draw":
        if (action.side === "enemy" && action.actor.deck) drawBossCards(state, action.actor.deck, value);
        else if (!enemy) draw(state, value, events);
        break;
      case "redistributeBlock": {
        const recipients = alive(friendlyRow(state, action));
        const total = recipients.reduce((sum, unit) => sum + unit.block, 0);
        const share = Math.floor(total / recipients.length);
        const remainder = total % recipients.length;
        // This moves existing protection, so it must not trigger gain/conversion/sharing rewards.
        recipients.forEach((unit, index) => {
          const next = share + Number(index < remainder);
          const delta = next - unit.block;
          unit.block = next;
          if (delta)
            events.push({
              kind: "status",
              status: "block",
              outcome: delta > 0 ? "gain" : "remove",
              actorId: actor.id,
              targetId: unit.id,
              amount: delta,
              text: "Wish Exchange redistributes Block",
            });
        });
        for (const recipient of recipients) grantBlock(state, recipient, value, events);
        break;
      }
      case "redraw":
        if (!enemy) redrawHand(state, events);
        break;
      case "recover":
        if (!enemy) recoverDiscard(state, events);
        applyExtras(state, action, events, {
          target: friendlyRow(state, action).find(
            (unit) => unit.id === action.allyTargetId && unit.health > 0,
          ),
          recipientOnly: true,
        });
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
      case "teamClearBlind":
        for (const unit of alive(friendlyRow(state, action)))
          if (ensureCombat(unit).blind) removeEffects(unit, "cleanse", 1, events, state, "blind");
        break;
      case "swapLowest": {
        const outgoing = alive(action.side === "player" ? state.team : state.battle.enemies).sort(
          (a, b) => a.health - b.health,
        )[0];
        if (outgoing) operations.swap(state, outgoing, events, true);
        break;
      }
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
    applyExtras(state, action, events, { target: attackTarget, blindMiss, criticalBonus, negated });
  }
}

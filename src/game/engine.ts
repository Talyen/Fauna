import { MERCHANT_PRICE, canVisitCampfire, campfireRecovery, canVisitMerchant } from "./support";
import saveFormat from "./save-format.json";
import { freeze, produce } from "immer";
import {
  collectedSpecies,
  creaturePassive,
  MAX_CREATURE_STARS,
  KEYWORDS,
  BOONS,
  cardKeywords,
  canBuyTalent,
  hasTalent,
} from "./progression";
import {
  combat,
  beginAttack,
  openingCriticalBonus,
  applyBlind,
  grantTemporaryDodge,
  shuffle,
  fillHand,
  draw,
  drawKeyword,
  gainMana,
  grantArmor,
  triggerArmorBreak,
  freshCombat,
  grantStatus,
  grantBlock,
  hit,
  restoreHealth,
  mostInjured,
  removeEffects,
  roll,
  startAction,
  tickStatuses,
  controlled,
  TURN_MANA,
  TURN_DRAW,
  HAND_LIMIT,
} from "./combat";
import { retainedBlock, actionValue, cardCost, enemyAbilityValue } from "./rules";
import { CARDS, SPECIES, FIRST_RUN_STARTERS, definition, species, enemyCard } from "./content";
import { bossEncounter, encounterSource, finalEncounter, encounterPacks } from "./encounters";
import type { Card, Command, CommandResult, GameEvent, GameState } from "./types";
export function createGame(seed = 1): GameState {
  const state: GameState = {
    version: saveFormat.version,
    support: null,
    discovery: { encountered: [], recruited: {} },
    revision: 0,
    rng: seed >>> 0,
    phase: "draft",
    unlocked: SPECIES.map((entry) => entry.id),
    wins: 0,
    selected: [],
    starterOffers: [],
    roster: [],
    reserves: [],
    lineup: [],
    keywordXP: {},
    battleXP: {},
    talents: [],
    currency: 0,
    boons: [],
    reward: null,
    journey: null,
    team: [],
    cards: [],
    encounter: 0,
    expedition: { pack: null },
    battle: null,
  };
  offerStarters(state);
  return freeze(state, true);
}
export function starterCount(state: GameState) {
  return collectedSpecies(state).length === 0 ? 1 : 3;
}
function offerStarters(state: GameState) {
  const collected = collectedSpecies(state);
  const pool = collected.length ? collected : FIRST_RUN_STARTERS;
  if (state.selected.length === starterCount(state)) {
    state.starterOffers = [];
    return;
  }
  const shuffled = shuffle(state, [...pool]);
  state.starterOffers = Array.from({ length: 3 }, (_, index) => shuffled[index % shuffled.length]!);
}
const random = roll;
function prepareEncounter(state: GameState) {
  const route = state.expedition!;
  route.pack = Math.floor(random(state) * encounterPacks(state.encounter).length);
  const kind = [1, 5].includes(state.encounter) ? "merchant" : null;
  const stock =
    kind === "merchant"
      ? shuffle(
          state,
          BOONS.filter((b) => !state.boons.includes(b.id)),
        )
          .slice(0, 2)
          .map((b, i) => ({
            slot: `slot-${i}`,
            boon: b.id,
            price: MERCHANT_PRICE - (state.boons.includes("merchants-favor") ? 7 : 0),
          }))
      : [];
  state.support =
    kind && stock.length
      ? {
          id: `support-${state.encounter}`,
          kind,
          encounter: state.encounter,
          resolved: false,
          purchased: null,
          stock,
        }
      : null;
}
function living(state: GameState) {
  return state.team.filter((c) => c.health > 0);
}
function ownedCards(id: string, kind: GameState["team"][number]["species"]): Card[] {
  return CARDS.filter((c) => c.species === kind).map((c) => ({
    id: `${id}:${c.id}`,
    definitionId: c.id,
    ownerId: id,
    level: 0,
  }));
}
export const MAX_HAND_SIZE = HAND_LIMIT;
function intents(state: GameState) {
  const alive = living(state);
  for (const enemy of state.battle!.enemies) {
    if (enemy.health > 0)
      enemy.targetId = alive.length ? alive[Math.floor(random(state) * alive.length)]!.id : state.team[0]!.id;
  }
}
export function beginBattle(state: GameState, events: GameEvent[] = []) {
  const encounter = encounterSource(state);
  for (const enemy of encounter.enemies)
    if (!state.discovery.encountered.includes(enemy.species)) state.discovery.encountered.push(enemy.species);
  const all = [...state.team, ...state.reserves];
  state.team = state.lineup.map((id) => all.find((c) => c.id === id)!);
  state.reserves = all.filter((c) => !state.lineup.includes(c.id));
  rebuildCards(state);
  for (const c of [...state.team, ...state.reserves]) {
    c.combat = freshCombat();
    c.block = 0;
    c.attacked = false;
  }
  state.battle = {
    earnedGold: 0,
    freeBurnUsed: false,
    meteoriteUsed: false,
    cardsPlayedThisTurn: 0,
    turn: 1,
    mana: TURN_MANA + Number(hasTalent(state, "mana.leyline-attunement")),
    maxMana: TURN_MANA + Number(hasTalent(state, "mana.leyline-attunement")),
    draw: shuffle(
      state,
      state.cards.map((c) => c.id),
    ),
    hand: [],
    buffer: [],
    discard: [],
    enemies: encounter.enemies.map((e, i) => {
      const enemy = {
        id: `enemy-${i}`,
        name: e.name,
        species: e.species,
        health: e.health,
        maxHealth: e.health,
        damage: e.damage,
        targetId: "",
        block: 0,
        combat: freshCombat(),
        lastAbility: null,
      };
      for (const effect of creaturePassive(undefined, e.species).effects) {
        if (effect.kind !== "battleStart") continue;
        if (effect.effect === "block") enemy.block += effect.amount;
        else enemy.combat[effect.effect] += effect.amount;
      }
      return enemy;
    }),
  };
  state.phase = "battle";
  draw(state, TURN_DRAW + (state.boons.includes("tattered-pages") ? 1 : 0));
  if (hasTalent(state, "nature.ecosystem")) drawKeyword(state, "nature");
  for (const unit of state.team) {
    if (hasTalent(state, "armor.bulwark")) grantArmor(state, unit, 2, events);
    for (const effect of creaturePassive(state, unit.species).effects) {
      if (effect.kind !== "battleStart") continue;
      if (effect.effect === "block") grantBlock(state, unit, effect.amount, events);
      else if (effect.effect === "armor") grantArmor(state, unit, effect.amount, events);
      else grantStatus(unit, "thorns", effect.amount, events, state);
    }
    if (hasTalent(state, "mana.mana-bulwark")) grantBlock(state, unit, state.battle.maxMana, events);
    if (hasTalent(state, "mana.mana-shell")) grantArmor(state, unit, state.battle.maxMana, events);
    if (hasTalent(state, "health.combat-surge")) restoreHealth(unit, 4, events, false, state);
  }
  state.reward = null;
  state.battleXP = {};
  intents(state);
}
function bankBattleXP(state: GameState) {
  const xp: GameState["battleXP"] = {};
  for (const keyword of KEYWORDS) {
    const previous = state.keywordXP[keyword] ?? 0;
    const total = Math.min(1_000_000, previous + (state.battleXP[keyword] ?? 0));
    state.keywordXP[keyword] = total;
    if (total > previous) {
      xp[keyword] = total - previous;
      if (state.journey) state.journey.xp[keyword] = (state.journey.xp[keyword] ?? 0) + total - previous;
    }
  }
  state.battleXP = {};
  return xp;
}
function finishBattle(state: GameState, defeated: boolean) {
  const xp = bankBattleXP(state);
  const earnedGold = state.battle?.earnedGold ?? 0;
  const previousCurrency = state.currency;
  state.currency = Math.min(
    1_000_000,
    state.currency +
      (defeated ? 0 : (bossEncounter(state) ? 40 : 20) + (state.boons.includes("smugglers-map") ? 2 : 0)),
  );
  const currency = state.currency - previousCurrency + earnedGold;
  const outcome = defeated ? "defeat" : finalEncounter(state) ? "victory" : "next";
  if (state.journey) {
    state.journey.currency = Math.min(1_000_000, state.journey.currency + currency - earnedGold);
    state.journey.lastBattle = { xp, currency };
    if (!defeated) state.journey.victories++;
    if (outcome !== "next") state.journey.outcome = outcome;
  }
  if (outcome === "victory") {
    state.wins++;
  }
  const boons =
    defeated || outcome === "victory" || !bossEncounter(state)
      ? []
      : shuffle(
          state,
          BOONS.filter((r) => !state.boons.includes(r.id)).map((r) => r.id),
        ).slice(0, 3);
  state.reward = {
    xp,
    currency,
    outcome,
    recruits:
      defeated || outcome === "victory" || bossEncounter(state)
        ? []
        : encounterSource(state).enemies.map((enemy) => enemy.species),
    boons,
  };
  enterReward(state);
}
function settle(state: GameState, events: GameEvent[]): boolean {
  if (![...state.team, ...state.reserves].some((c) => c.health > 0)) {
    finishBattle(state, true);
    events.push({ kind: "knockout", text: "Your journey has ended." });
    return true;
  }
  if (state.battle!.enemies.every((e) => e.health <= 0)) {
    for (const creature of [...state.team, ...state.reserves]) {
      if (hasTalent(state, "health.vitality")) restoreHealth(creature, 4, events, false, state);
      creature.block = 0;
      creature.combat = freshCombat();
    }
    for (const enemy of state.battle!.enemies) {
      enemy.combat = freshCombat();
      enemy.block = 0;
    }
    finishBattle(state, false);
    events.push({
      kind: state.phase === "victory" || state.reward?.outcome === "victory" ? "victory" : "reward",
      text: "Battle complete. Rewards saved.",
    });
    return true;
  }
  return false;
}
function prepareLineup(state: GameState) {
  const all = [...state.team, ...state.reserves];
  state.team = state.lineup.map((id) => all.find((c) => c.id === id)!);
  state.reserves = all.filter((c) => !state.lineup.includes(c.id));
  rebuildCards(state);
}
function afterRewards(state: GameState) {
  if (state.reward!.outcome === "victory") {
    state.phase = "victory";
    return;
  }
  state.encounter++;
  if (state.expedition) prepareEncounter(state);
  state.phase = "teamSelection";
  state.battle = null;
  state.reward = null;
  prepareLineup(state);
}
function enterReward(state: GameState) {
  const reward = state.reward!;
  if (reward.outcome === "defeat") state.phase = "defeat";
  else if (reward.outcome === "victory") state.phase = "victory";
  else if (reward.recruits.length > 0) state.phase = "recruit";
  else if (reward.boons.length) state.phase = "boon";
  else afterRewards(state);
}
function rebuildCards(state: GameState) {
  const previous = state.cards;
  state.cards = state.team
    .flatMap((c) => ownedCards(c.id, c.species))
    .map(
      (card) =>
        previous.find(
          (old) =>
            old.id === card.id && old.ownerId === card.ownerId && old.definitionId === card.definitionId,
        ) ?? card,
    );
  if (state.battle) {
    state.battle.hand = [];
    state.battle.buffer = [];
    state.battle.discard = [];
    state.battle.draw = state.cards.map((c) => c.id);
  }
}
/** Manual swaps retain zone slots; swap cards return the incoming kit to the draw pile. */
function swapBackup(
  state: GameState,
  activeId: string,
  backupId: string,
  events: GameEvent[],
  fromCard = false,
) {
  const index = state.team.findIndex((unit) => unit.id === activeId);
  const backupIndex = state.reserves.findIndex((unit) => unit.id === backupId);
  const outgoing = state.team[index]!;
  const incoming = state.reserves[backupIndex]!;
  state.team[index] = incoming;
  state.reserves[backupIndex] = outgoing;
  const oldDefs = CARDS.filter((card) => card.species === outgoing.species);
  const newDefs = CARDS.filter((card) => card.species === incoming.species);
  const replaced = state.cards.filter((card) => card.ownerId === outgoing.id);
  for (const card of replaced) {
    card.definitionId = newDefs[oldDefs.findIndex((def) => def.id === card.definitionId)]!.id;
    card.ownerId = incoming.id;
    card.level = 0;
  }
  if (state.battle) {
    for (const enemy of state.battle.enemies)
      if (enemy.targetId === outgoing.id) enemy.targetId = incoming.id;
    if (fromCard) {
      const ids = new Set(replaced.map((card) => card.id));
      for (const zone of ["draw", "hand", "buffer", "discard"] as const)
        state.battle[zone] = state.battle[zone].filter((id) => !ids.has(id));
      state.battle.draw = shuffle(state, [...state.battle.draw, ...ids]);
    }
  }
  if (state.phase !== "battle") state.lineup = state.team.map((unit) => unit.id);
  events.push({
    kind: "action",
    actionType: "swap",
    actorId: incoming.id,
    text: `${species(incoming.species).name} replaces ${species(outgoing.species).name}.`,
  });
}
function swapFromCard(state: GameState, actor: import("./combat").Combatant, events: GameEvent[]) {
  const allied = !("maxHealth" in actor);
  const backup = allied ? state.reserves.filter((unit) => unit.health > 0) : [];
  if (backup.length) {
    const incoming = backup[Math.floor(random(state) * backup.length)]!;
    swapBackup(state, actor.id, incoming.id, events, true);
    return;
  }
  const row = allied ? state.team : state.battle!.enemies;
  const others = row.filter((unit) => unit.id !== actor.id && unit.health > 0);
  if (!others.length) return;
  const other = others[Math.floor(random(state) * others.length)]!;
  const from = row.findIndex((unit) => unit.id === actor.id);
  const to = row.findIndex((unit) => unit.id === other.id);
  [row[from], row[to]] = [row[to]!, row[from]!];
  events.push({
    kind: "action",
    actionType: "swap",
    actorId: actor.id,
    targetId: other.id,
    text: `${species(actor.species).name} swaps positions with ${species(other.species).name}.`,
  });
}
function encore(state: GameState, actor: import("./combat").Combatant) {
  const stats = combat(actor);
  const chance = creaturePassive("maxHealth" in actor ? undefined : state, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "encore" ? effect.amount : 0),
    0,
  );
  if (chance <= 0 || stats.encoreUsed) return false;
  stats.encoreUsed = true;
  return roll(state) < chance / 100;
}
function hushDome(state: GameState, enemy: boolean, events: GameEvent[]) {
  for (const unit of enemy ? state.battle!.enemies : state.team) {
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

function applyExtras(
  state: GameState,
  actor: import("./combat").Combatant,
  def: import("./content").CardDefinition,
  events: GameEvent[],
  enemy = false,
  target?: import("./combat").Combatant,
  blindMiss = false,
  criticalBonus = 0,
  recipientOnly = false,
) {
  for (const effect of def.effects ?? []) {
    // Targeted Cleanse follows each healed ally; global extras run once after the primary effect
    if (recipientOnly !== (effect.kind === "cleanse" && effect.target === "recipient")) continue;
    if (actor.health <= 0) break;
    switch (effect.kind) {
      case "damage":
        if (target)
          hit(state, actor, target, effect.amount, effect.damageType, events, {
            blindMiss,
            criticalBonus,
            leech: effect.leech,
            cardLeech:
              !enemy &&
              (def.leech || def.effects?.some((effect) => effect.kind === "damage" && effect.leech)),
          });
        break;
      case "status":
        if (effect.status === "armor") grantArmor(state, actor, effect.amount, events);
        else grantStatus(actor, effect.status, effect.amount, events, state);
        break;
      case "meltArmor":
        for (const recipient of enemy ? state.team : state.battle!.enemies) {
          if (actor.health <= 0) break;
          if (recipient.health <= 0) continue;
          const stats = combat(recipient);
          const removed = Math.ceil((stats.armor * effect.amount) / 100);
          if (!removed) continue;
          stats.armor -= removed;
          events.push({
            kind: "status",
            actorId: actor.id,
            targetId: recipient.id,
            status: "armor",
            outcome: "remove",
            amount: removed,
            text: `${species(recipient.species).name} loses ${removed} Armor`,
          });
          if (stats.armor === 0) triggerArmorBreak(state, recipient, events);
        }
        break;
      case "blind":
        for (const recipient of enemy ? state.team : state.battle!.enemies)
          if (recipient.health > 0) applyBlind(state, actor, recipient, events);
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
          ? (enemy ? state.battle!.enemies : state.team).filter((unit) => unit.health > 0)
          : [effect.target === "recipient" && target ? target : actor])
          removeEffects(recipient, "cleanse", effect.amount, events, state);
        break;
      case "purge":
        if (target) removeEffects(target, "purge", effect.amount, events, state);
        break;
      case "heal":
        restoreHealth(actor, effect.amount, events, false, state, !enemy, actor);
        break;
      case "draw":
        if (!enemy) draw(state, effect.amount);
        break;
      case "mana":
        if (!enemy) gainMana(state, effect.amount, events);
        break;
    }
  }
}
function finishTurn(draft: GameState, events: GameEvent[]) {
  const battle = draft.battle!;
  const bonusMana = Number(
    battle.mana > 0 ? hasTalent(draft, "mana.wellspring") : hasTalent(draft, "mana.dark-recovery"),
  );
  // Enemy-phase draws and existing overflow survive into the next player turn.
  battle.discard.push(...battle.hand.splice(0));
  for (let pass = 0; pass < 3; pass++) {
    // Swaps can reorder the battlefield; each enemy keeps its single action window.
    const actionOrder = battle.enemies.slice();
    for (const enemy of actionOrder) {
      if (enemy.health <= 0) continue;
      tickStatuses(draft, enemy, events);
      if (settle(draft, events)) return;
      if (enemy.health <= 0) continue;
      enemy.block = retainedBlock(enemy);
      if (!startAction(enemy, events, draft)) continue;
      let target = living(draft).find((c) => c.id === enemy.targetId) ?? living(draft)[0];
      if (!target) break;
      const abilities = CARDS.filter(
        (card) =>
          card.species === enemy.species &&
          card.id !== enemy.lastAbility &&
          enemyCard(card).effect !== "draw",
      );
      const def = enemyCard(abilities[Math.floor(random(draft) * abilities.length)]!);
      if (def.effect === "attack" && def.target === "randomEnemy") {
        const allies = living(draft);
        target = allies[Math.floor(random(draft) * allies.length)]!;
      }
      const value = enemyAbilityValue(enemy, def);
      enemy.lastAbility = def.id;
      events.push({
        kind: "action",
        actionType: def.effect === "attack" ? "attack" : "support",
        actorId: enemy.id,
        targetId: def.effect === "attack" && def.target === "allEnemies" ? undefined : target.id,
        text: `${enemy.name} uses ${def.name}.`,
      });
      const encoreRepeat = encore(draft, enemy);
      for (let play = 0; play < (encoreRepeat ? 2 : 1); play++) {
        if (
          enemy.health <= 0 ||
          (def.effect === "attack" && def.target !== "allEnemies" && target.health <= 0)
        )
          break;
        if (play === 1)
          events.push({
            kind: "action",
            actionType: "support",
            actorId: enemy.id,
            text: `${enemy.name} repeats ${def.name} with Encore`,
          });
        const criticalBonus = def.effect === "attack" ? openingCriticalBonus(draft, enemy) : 0;
        const blindMiss = def.effect === "attack" ? beginAttack(draft, enemy) : false;
        if (def.effect === "attack") {
          const damageType =
            def.alternateDamageType && roll(draft) < 0.5 ? def.alternateDamageType : def.damageType;
          const targets = def.target === "allEnemies" ? living(draft) : target.health > 0 ? [target] : [];
          if (!targets.length) break;
          for (const recipient of targets) {
            if (enemy.health <= 0) break;
            hit(draft, enemy, recipient, value, damageType, events, {
              leech: def.leech,
              blindMiss,
              criticalBonus,
            });
          }
        } else if (def.effect === "heal") {
          const injured = def.target === "self" ? enemy : mostInjured(battle.enemies)!;
          for (const recipient of def.target === "allAllies"
            ? battle.enemies.filter((e) => e.health > 0)
            : [injured]) {
            restoreHealth(recipient, value, events, false, draft, false, enemy);
            applyExtras(draft, enemy, def, events, true, recipient, false, 0, true);
          }
        } else if (def.effect === "teamCleanse") {
          for (const recipient of battle.enemies.filter((unit) => unit.health > 0))
            removeEffects(recipient, "cleanse", value, events, draft);
        } else if (def.effect === "nullify") {
          hushDome(draft, true, events);
        } else if (def.effect === "dodge") {
          grantTemporaryDodge(enemy, value, events);
        } else if (def.effect === "swap") {
          swapFromCard(draft, enemy, events);
        } else {
          for (const unit of def.effect === "teamGuard"
            ? battle.enemies.filter((e) => e.health > 0)
            : [enemy]) {
            grantBlock(draft, unit, value, events);
          }
        }
        applyExtras(draft, enemy, def, events, true, target, blindMiss, criticalBonus);
      }
      if (settle(draft, events)) return;
    }
    for (const c of [...draft.team, ...draft.reserves]) {
      if (c.health <= 0) continue;
      tickStatuses(draft, c, events);
      if (settle(draft, events)) return;
    }
    for (const enemy of battle.enemies) restoreHealth(enemy, 1, events, false, draft);
    for (const c of [...draft.team, ...draft.reserves]) {
      const stats = combat(c);
      if (stats.grace > 0) stats.grace--;
      c.block = retainedBlock(c, draft);
      c.attacked = false;
      startAction(c, events, draft);
    }
    battle.maxMana = TURN_MANA + Number(hasTalent(draft, "mana.leyline-attunement")) + bonusMana;
    battle.mana = 0;
    gainMana(draft, battle.maxMana, events);
    battle.turn++;
    battle.cardsPlayedThisTurn = 0;
    intents(draft);
    if (
      living(draft).some((c) => !controlled(c)) ||
      draft.reserves.some((c) => c.health > 0 && !controlled(c))
    )
      break;
  }
  draw(draft, TURN_DRAW);
  events.push({ kind: "turn", text: `Turn ${battle.turn}. ${battle.maxMana} Mana restored.` });
}

function reject(state: GameState, reason: string): CommandResult {
  return { accepted: false, state, reason, events: [] };
}
export function dispatch(state: GameState, command: Command, development = false): CommandResult {
  if (command.type === "devWinBattle" && !development)
    return reject(state, "Development command unavailable.");
  return resolve(state, command, false);
}
export function previewCard(state: GameState, cardId: string, targetId?: string): CommandResult {
  return resolve(state, { type: "play", cardId, targetId }, true);
}
function resolve(state: GameState, command: Command, preview: boolean): CommandResult {
  const b = state.battle;
  if (
    command.type === "newRun" &&
    (!Number.isSafeInteger(command.seed) || command.seed < 0 || command.seed > 0xffffffff)
  )
    return reject(state, "Choose a valid journey seed.");
  if (
    command.type === "draft" &&
    (state.phase !== "draft" ||
      !state.starterOffers.includes(command.species) ||
      state.selected.length === starterCount(state))
  )
    return reject(state, "Choose an offered starter.");
  if (command.type === "start" && (state.phase !== "draft" || state.selected.length !== starterCount(state)))
    return reject(state, "Complete your starter choices first.");
  if (
    (command.type === "play" || command.type === "endTurn" || command.type === "devWinBattle") &&
    (state.phase !== "battle" || !b)
  )
    return reject(state, "There is no active battle.");
  if (command.type === "play") {
    const card = state.cards.find((c) => c.id === command.cardId);
    if (!card || !b!.hand.includes(card.id)) return reject(state, "That card is not in your hand.");
    const actor = state.team.find((c) => c.id === card.ownerId);
    if (!actor || actor.health <= 0) return reject(state, "That creature is knocked out.");
    if (controlled(actor)) return reject(state, "That creature is Stunned or Frozen.");
    const def = definition(card.definitionId);
    if (b!.mana < cardCost(card, state)) return reject(state, "Not enough mana.");
    if (
      def.effect === "attack" &&
      !def.target &&
      !b!.enemies.some((e) => e.id === command.targetId && e.health > 0)
    )
      return reject(state, "Choose a living enemy.");
    if (
      ((def.effect === "guard" && def.target !== "self") || (def.effect === "heal" && !def.target)) &&
      !state.team.some((c) => c.id === command.targetId && c.health > 0)
    )
      return reject(state, "Choose a living ally.");
    if (
      (def.effect === "dodge" ||
        ((def.effect === "guard" || def.effect === "heal") && def.target === "self")) &&
      command.targetId !== undefined &&
      command.targetId !== actor.id
    )
      return reject(state, "This ability targets its acting creature.");
  }
  if (command.type === "visitCampfire" && !canVisitCampfire(state))
    return reject(state, "There is no available Campfire.");
  if ((command.type === "rest" || command.type === "leaveCampfire") && state.phase !== "campfire")
    return reject(state, "Visit a Campfire first.");
  if (command.type === "newRun" && !["draft", "victory", "defeat"].includes(state.phase))
    return reject(state, "End the current journey first.");
  if (command.type === "beginBattle" && state.phase !== "teamSelection") {
    return reject(state, "Battle is unavailable.");
  }
  if (
    command.type === "swap" &&
    (!["battle", "teamSelection"].includes(state.phase) ||
      !state.team.some((c) => c.id === command.activeId) ||
      !state.reserves.some((c) => c.id === command.reserve && (state.phase !== "battle" || c.health > 0)) ||
      state.team.some((c) => c.id === command.reserve))
  )
    return reject(state, "Choose an active creature and a backup.");
  if (
    command.type === "setLineup" &&
    (!["teamSelection", "recruit", "boon", "campfire", "support"].includes(state.phase) ||
      ![...state.team, ...state.reserves].some(
        (c) => c.id === command.activeId && state.lineup.includes(c.id),
      ) ||
      ![...state.team, ...state.reserves].some((c) => c.id === command.reserve) ||
      state.lineup.includes(command.reserve) ||
      state.reward?.outcome === "defeat" ||
      state.reward?.outcome === "victory")
  )
    return reject(state, "Choose a starting creature and a backup between battles.");
  if (
    command.type === "recruit" &&
    (state.phase !== "recruit" ||
      !state.reward?.recruits.includes(command.species) ||
      (state.roster.length === 5
        ? !command.replace || ![...state.team, ...state.reserves].some((c) => c.id === command.replace)
        : !!command.replace))
  )
    return reject(state, "Choose an offered species and, if full, a creature to release.");
  if (command.type === "skipRecruit" && (state.phase !== "recruit" || !!state.reward?.recruits.length))
    return reject(state, "Choose a creature to recruit.");
  if (
    command.type === "chooseBoon" &&
    (state.phase !== "boon" ||
      !state.reward?.boons.includes(command.boon) ||
      state.boons.includes(command.boon))
  )
    return reject(state, "Choose an offered boon.");
  if (command.type === "skipBoon" && state.phase !== "boon") return reject(state, "There is no boon reward.");
  if (command.type === "buyTalent" && !canBuyTalent(state, command.talentId))
    return reject(state, "That talent is not available.");
  if (
    command.type === "resetTalents" &&
    (!KEYWORDS.includes(command.keyword) || !state.talents.some((id) => id.startsWith(`${command.keyword}.`)))
  )
    return reject(state, "There are no talents to reset in this category.");
  if (
    command.type === "abandon" &&
    !["battle", "teamSelection", "recruit", "boon", "campfire", "support"].includes(state.phase) &&
    !(state.phase === "draft" && state.selected.length > 0)
  )
    return reject(state, "There is no journey to end.");
  const visit = state.support;
  if (command.type === "enterSupport" && (!canVisitMerchant(state) || !visit || visit.id !== command.visit))
    return reject(state, "That visit is unavailable.");
  if (
    ["buyBoon", "leaveSupport"].includes(command.type) &&
    (state.phase !== "support" || !visit || !("visit" in command) || command.visit !== visit.id)
  )
    return reject(state, "That visit is no longer active.");
  if (command.type === "buyBoon") {
    const slot = visit?.stock.find((s) => s.slot === command.slot);
    if (
      visit?.kind !== "merchant" ||
      visit.resolved ||
      visit.purchased ||
      !slot ||
      state.boons.includes(slot.boon) ||
      state.currency < slot.price
    )
      return reject(state, "That purchase is unavailable.");
  }
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    draft.revision++;
    switch (command.type) {
      case "draft": {
        draft.selected.push(command.species);
        offerStarters(draft);
        break;
      }
      case "start":
        if (collectedSpecies(draft).length === 0) {
          for (const kind of draft.selected) draft.discovery.recruited[kind] = 1;
          for (const kind of draft.selected)
            if (!draft.discovery.encountered.includes(kind)) draft.discovery.encountered.push(kind);
        }
        draft.team = draft.selected.map((kind, i) => ({
          id: `ally-${i}`,
          species: kind,
          health: species(kind).health,
          block: 0,
          attacked: false,
        }));
        draft.cards = draft.team.flatMap((c) => ownedCards(c.id, c.species));
        draft.journey = { outcome: null, victories: 0, currency: 0, xp: {}, unlocks: [], lastBattle: null };
        draft.roster = [...draft.selected];
        draft.lineup = draft.team.map((c) => c.id);
        draft.phase = "teamSelection";
        if (draft.expedition) prepareEncounter(draft);
        break;
      case "enterSupport":
        draft.phase = "support";
        break;
      case "leaveSupport":
        draft.support!.resolved = true;
        draft.phase = "teamSelection";
        break;
      case "buyBoon": {
        const slot = draft.support!.stock.find((s) => s.slot === command.slot)!;
        draft.currency -= slot.price;
        draft.boons.push(slot.boon);
        draft.support!.purchased = slot.boon;
        draft.support!.resolved = true;
        events.push({ kind: "reward", text: "Boon purchased for this journey." });
        break;
      }
      case "beginBattle":
        draft.support = null;
        if (draft.journey) draft.journey.lastBattle = null;
        beginBattle(draft, events);
        events.push({ kind: "turn", text: "Your journey begins." });
        break;
      case "visitCampfire":
        draft.phase = "campfire";
        break;
      case "leaveCampfire":
        draft.phase = "teamSelection";
        break;
      case "rest":
        for (const creature of [...draft.team, ...draft.reserves])
          restoreHealth(creature, campfireRecovery(creature), events, true);
        draft.phase = "teamSelection";
        break;
      case "play": {
        const battle = draft.battle!;
        const card = draft.cards.find((c) => c.id === command.cardId)!;
        const def = definition(card.definitionId);
        const actor = draft.team.find((c) => c.id === card.ownerId)!;
        const value = actionValue(card, actor, draft);
        for (const keyword of cardKeywords(card))
          draft.battleXP[keyword] = Math.min(1_000_000, (draft.battleXP[keyword] ?? 0) + 1);
        battle.mana -= cardCost(card, draft);
        const keywords = cardKeywords(card);
        combat(actor).freeCard = false;
        if (keywords.includes("nature")) combat(actor).freeNature = false;
        if (keywords.includes("light")) combat(actor).freeLight = false;
        if (keywords.includes("burn")) battle.freeBurnUsed = true;
        battle.hand.splice(battle.hand.indexOf(card.id), 1);
        battle.discard.push(card.id);
        events.push({
          kind: "action",
          actionType: def.effect === "attack" ? "attack" : "support",
          text: `${species(actor.species).name} uses ${def.name}.`,
          actorId: actor.id,
          targetId: command.targetId,
        });
        const target =
          def.effect === "attack" && def.target === "randomEnemy"
            ? (() => {
                const enemies = battle.enemies.filter((enemy) => enemy.health > 0);
                return enemies[Math.floor(random(draft) * enemies.length)];
              })()
            : def.effect === "attack" && def.target === "allEnemies"
              ? undefined
              : battle.enemies.find((e) => e.id === command.targetId);
        if (target && keywords.includes("leech") && hasTalent(draft, "leech.armor-siphon")) {
          const stolen = Math.min(1, target.combat.armor);
          target.combat.armor -= stolen;
          grantArmor(draft, actor, stolen, events);
          if (stolen > 0 && target.combat.armor === 0) triggerArmorBreak(draft, target, events);
        }
        if (keywords.includes("block") && hasTalent(draft, "armor.armored-surge") && roll(draft) < 0.1)
          grantArmor(draft, actor, 6, events);
        const repeatTalents = [
          ["burn", "burn.flash-fire"],
          ["freeze", "freeze.winter-s-grasp"],
          ["nature", "nature.overgrowth"],
          ["poison", "poison.venom-strike"],
          ["stun", "stun.jarring-blow"],
        ] as const;
        const encoreRepeat = encore(draft, actor);
        const repeat = repeatTalents.some(
          ([keyword, talent]) => keywords.includes(keyword) && hasTalent(draft, talent) && roll(draft) < 0.1,
        );
        for (let play = 0; play < (repeat || encoreRepeat ? 2 : 1); play++) {
          if (
            actor.health <= 0 ||
            (def.effect === "attack" && def.target !== "allEnemies" && (!target || target.health <= 0))
          )
            break;
          if (play === 1 && encoreRepeat)
            events.push({
              kind: "action",
              actionType: "support",
              actorId: actor.id,
              text: `${species(actor.species).name} repeats ${def.name} with Encore`,
            });
          const criticalBonus = def.effect === "attack" ? openingCriticalBonus(draft, actor) : 0;
          const blindMiss = def.effect === "attack" ? beginAttack(draft, actor) : false;
          if (def.effect === "attack") {
            const damageType =
              def.alternateDamageType && roll(draft) < 0.5 ? def.alternateDamageType : def.damageType;
            const targets =
              def.target === "allEnemies"
                ? battle.enemies.filter((enemy) => enemy.health > 0)
                : target && target.health > 0
                  ? [target]
                  : [];
            if (!targets.length) break;
            for (const enemy of targets) {
              if (actor.health <= 0) break;
              hit(draft, actor, enemy, value, damageType, events, {
                blindMiss,
                criticalBonus,
                leech: def.leech,
                cardLeech: keywords.includes("leech"),
              });
            }
            actor.attacked = true;
          }
          if (def.effect === "guard" || def.effect === "teamGuard") {
            const targets =
              def.effect === "teamGuard"
                ? living(draft)
                : def.target === "self"
                  ? [actor]
                  : draft.team.filter((c) => c.id === command.targetId);
            for (const target of targets) {
              grantBlock(draft, target, value, events);
            }
          }
          if (def.effect === "heal") {
            const targets =
              def.target === "allAllies"
                ? living(draft)
                : def.target === "self"
                  ? [actor]
                  : def.target === "mostInjured"
                    ? [mostInjured(draft.team)!]
                    : draft.team.filter((c) => c.id === command.targetId && c.health > 0);
            for (const recipient of targets) {
              restoreHealth(recipient, value, events, false, draft, true, actor);
              applyExtras(draft, actor, def, events, false, recipient, false, 0, true);
            }
          }
          if (def.effect === "draw") draw(draft, value);
          if (def.effect === "teamCleanse")
            for (const recipient of living(draft)) removeEffects(recipient, "cleanse", value, events, draft);
          if (def.effect === "nullify") hushDome(draft, false, events);
          if (def.effect === "dodge") grantTemporaryDodge(actor, value, events);
          if (def.effect === "swap") swapFromCard(draft, actor, events);
          applyExtras(draft, actor, def, events, false, target, blindMiss, criticalBonus);
        }
        if (battle.cardsPlayedThisTurn < 3) {
          battle.cardsPlayedThisTurn++;
          if (battle.cardsPlayedThisTurn === 3 && draft.boons.includes("resonant-chimes"))
            gainMana(draft, 1, events);
        }
        fillHand(draft);
        if (!preview) settle(draft, events);
        if (!preview && command.autoEndTurn !== false && draft.phase === "battle" && battle.mana === 0)
          finishTurn(draft, events);
        break;
      }
      case "devWinBattle": {
        for (const enemy of draft.battle!.enemies) enemy.health = 0;
        settle(draft, events);
        break;
      }
      case "endTurn": {
        finishTurn(draft, events);
        break;
      }
      case "setLineup": {
        const outgoing = [...draft.team, ...draft.reserves].find((c) => c.id === command.activeId)!;
        draft.lineup[draft.lineup.indexOf(outgoing.id)] = command.reserve;
        if (["teamSelection", "campfire", "support"].includes(draft.phase)) prepareLineup(draft);
        break;
      }
      case "swap": {
        swapBackup(draft, command.activeId, command.reserve, events);
        break;
      }
      case "recruit": {
        draft.discovery.recruited[command.species] = Math.min(
          MAX_CREATURE_STARS + 1,
          (draft.discovery.recruited[command.species] ?? 0) + 1,
        );
        const all = [...draft.team, ...draft.reserves];
        let id = `recruit-${draft.revision}`;
        for (let suffix = 1; all.some((creature) => creature.id === id); suffix++)
          id = `recruit-${draft.revision}-${suffix}`;
        const recruited = {
          id,
          species: command.species,
          health: species(command.species).health,
          block: 0,
          attacked: false,
        };
        if (command.replace) {
          const released = [...draft.team, ...draft.reserves].find((c) => c.id === command.replace)!;
          draft.roster[draft.roster.indexOf(released.species)] = command.species;
          draft.lineup = draft.lineup.map((id) => (id === command.replace ? recruited.id : id));
          const index = draft.team.findIndex((c) => c.id === command.replace);
          if (index >= 0) {
            const old = draft.team[index]!;
            draft.team[index] = recruited;
            const oldDefs = CARDS.filter((c) => c.species === old.species);
            const newDefs = CARDS.filter((c) => c.species === command.species);
            for (const card of draft.cards.filter((c) => c.ownerId === old.id)) {
              card.ownerId = recruited.id;
              card.definitionId = newDefs[oldDefs.findIndex((def) => def.id === card.definitionId)]!.id;
              card.level = 0;
            }
            if (draft.battle)
              for (const enemy of draft.battle.enemies)
                if (enemy.targetId === old.id) enemy.targetId = recruited.id;
          } else draft.reserves[draft.reserves.findIndex((c) => c.id === command.replace)] = recruited;
        } else {
          draft.roster.push(command.species);
          if (draft.lineup.length < 3) {
            draft.lineup.push(recruited.id);
            draft.team.push(recruited);
            const cards = ownedCards(recruited.id, recruited.species);
            draft.cards.push(...cards);
            // The settled battle remains a valid receipt through recruitment and boon choice.
            draft.battle?.discard.push(...cards.map((card) => card.id));
          } else draft.reserves.push(recruited);
        }
        afterRewards(draft);
        break;
      }
      case "skipRecruit":
        afterRewards(draft);
        break;
      case "chooseBoon":
        draft.boons.push(command.boon);
        afterRewards(draft);
        break;
      case "skipBoon":
        afterRewards(draft);
        break;
      case "buyTalent":
        draft.talents.push(command.talentId);
        break;
      case "resetTalents":
        draft.talents = draft.talents.filter((id) => !id.startsWith(`${command.keyword}.`));
        break;
      case "newRun": {
        const fresh = createGame(command.seed);
        Object.assign(draft, fresh, {
          revision: state.revision + 1,
          rng: command.seed >>> 0,
          unlocked: [...state.unlocked],
          discovery: {
            encountered: [...state.discovery.encountered],
            recruited: { ...state.discovery.recruited },
          },
          wins: state.wins,
          keywordXP: { ...state.keywordXP },
          talents: [...state.talents],
          currency: state.currency,
        });
        offerStarters(draft);
        break;
      }
      case "abandon":
        draft.support = null;
        if (draft.phase === "draft") {
          draft.selected = [];
          offerStarters(draft);
          break;
        }
        bankBattleXP(draft);
        if (draft.journey) draft.journey.outcome = "returned";
        draft.reward = null;
        draft.phase = "defeat";
        events.push({ kind: "knockout", text: "You return from the wilds. Discoveries are kept." });
        break;
    }
  });
  return { accepted: true, state: next, events };
}

import { merchantPrice } from "./destinations";
import { collectedSpecies, starterCount, creaturePassive, KEYWORDS, hasTalent } from "./progression";
import { BOONS, SPECIES, FIRST_RUN_STARTERS } from "./content";
import {
  grantArmor,
  freshCombat,
  grantStatus,
  grantBlock,
  restoreHealth,
  TURN_MANA,
  TURN_DRAW,
} from "./combat/index";
import { shuffle, roll } from "./random";
import { draw, drawKeyword } from "./card-zones";
import { bossEncounter, encounterSource, finalEncounter, encounterPacks } from "./encounters";
import type { GameEvent, GameState, Lifecycle, BattleState, RewardState, StateAt } from "./types";
import { living, rebuildCards, prepareLineup } from "./team";
const OPTIONAL_DESTINATION_CHANCE = 0.25;

export function offerStarters(state: GameState) {
  const collected = collectedSpecies(state);
  const pool = collected.length ? collected : FIRST_RUN_STARTERS;
  if (state.selected.length === starterCount(state)) {
    state.starterOffers = [];
    return;
  }
  const shuffled = shuffle(state, [...pool]);
  state.starterOffers = Array.from({ length: 3 }, (_, index) => shuffled[index % shuffled.length]!);
}
function prepareEncounter(state: GameState) {
  const route = state.expedition!;
  route.pack = Math.floor(roll(state) * encounterPacks(state.encounter).length);
  const kind =
    route.lastRoom !== "merchant" &&
    state.currency >= merchantPrice(state) &&
    roll(state) < OPTIONAL_DESTINATION_CHANCE
      ? "merchant"
      : null;
  route.recruit =
    route.lastRoom !== "recruit" && state.roster.length < 5 && roll(state) < OPTIONAL_DESTINATION_CHANCE
      ? SPECIES[Math.floor(roll(state) * SPECIES.length)]!.id
      : null;
  const stock =
    kind === "merchant"
      ? shuffle(
          state,
          BOONS.filter((b) => !state.boons.includes(b.id)),
        )
          .slice(0, 3)
          .map((b, i) => ({
            slot: `slot-${i}`,
            boon: b.id,
            price: merchantPrice(state),
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
export function intents(state: BattleState) {
  const alive = living(state);
  for (const enemy of state.battle.enemies) {
    if (enemy.health > 0)
      enemy.targetId = alive.length ? alive[Math.floor(roll(state) * alive.length)]!.id : state.team[0]!.id;
  }
}
export function beginBattle(state: StateAt<"teamSelection">, events: GameEvent[] = []) {
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
  const battle = {
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
        power: e.power,
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
  const active = enterPhase(state, {
    phase: "battle",
    battle,
    reward: null,
    support: null,
    expedition: state.expedition,
    journey: { ...state.journey, outcome: null },
  });
  draw(active, TURN_DRAW + (state.boons.includes("tattered-pages") ? 1 : 0));
  if (hasTalent(state, "nature.ecosystem")) drawKeyword(active, "nature");
  for (const unit of state.team) {
    if (hasTalent(state, "armor.bulwark")) grantArmor(state, unit, 2, events);
    for (const effect of creaturePassive(state, unit.species).effects) {
      if (effect.kind !== "battleStart") continue;
      if (effect.effect === "block") grantBlock(state, unit, effect.amount, events);
      else if (effect.effect === "armor") grantArmor(state, unit, effect.amount, events);
      else grantStatus(unit, "thorns", effect.amount, events, state);
    }
    if (hasTalent(state, "mana.mana-bulwark")) grantBlock(state, unit, active.battle.maxMana, events);
    if (hasTalent(state, "mana.mana-shell")) grantArmor(state, unit, active.battle.maxMana, events);
    if (hasTalent(state, "health.combat-surge")) restoreHealth(unit, 4, events, false, state);
  }
  state.battleXP = {};
  intents(active);
}
function bankBattleXP(state: Exclude<GameState, StateAt<"draft">>) {
  const xp: GameState["battleXP"] = {};
  for (const keyword of KEYWORDS) {
    const previous = state.keywordXP[keyword] ?? 0;
    const total = Math.min(1_000_000, previous + (state.battleXP[keyword] ?? 0));
    state.keywordXP[keyword] = total;
    if (total > previous) {
      xp[keyword] = total - previous;
      state.journey.xp[keyword] = (state.journey.xp[keyword] ?? 0) + total - previous;
    }
  }
  state.battleXP = {};
  return xp;
}
function finishBattle(state: BattleState, defeated: boolean) {
  const xp = bankBattleXP(state);
  const earnedGold = state.battle.earnedGold;
  const previousCurrency = state.currency;
  state.currency = Math.min(
    1_000_000,
    state.currency +
      (defeated ? 0 : (bossEncounter(state) ? 40 : 20) + (state.boons.includes("smugglers-map") ? 2 : 0)),
  );
  const currency = state.currency - previousCurrency + earnedGold;
  const outcome = defeated ? "defeat" : finalEncounter(state) ? "victory" : "next";
  state.journey.currency = Math.min(1_000_000, state.journey.currency + currency - earnedGold);
  state.journey.lastBattle = { xp, currency, encounter: state.encounter, outcome };
  if (!defeated) state.journey.victories++;
  if (outcome === "victory") {
    state.wins = Math.min(1_000_000, state.wins + 1);
  }
  const boons =
    defeated || outcome === "victory" || !bossEncounter(state)
      ? []
      : shuffle(
          state,
          BOONS.filter((r) => !state.boons.includes(r.id)).map((r) => r.id),
        ).slice(0, 3);
  const receipt = {
    xp,
    currency,
    outcome,
    recruits:
      defeated || outcome === "victory" || bossEncounter(state)
        ? []
        : encounterSource(state).enemies.map((enemy) => enemy.species),
    boons,
  };
  // Combat identity ends here. Receipts never refer to mutable roster or enemy objects.
  clearCombat(state);
  const finished = { battle: null, support: null, expedition: state.expedition };
  if (outcome === "defeat")
    enterPhase(state, {
      ...finished,
      phase: "defeat",
      journey: { ...state.journey, outcome },
      reward: { ...receipt, outcome, recruits: [], boons: [] },
    });
  else if (outcome === "victory")
    enterPhase(state, {
      ...finished,
      phase: "victory",
      journey: { ...state.journey, outcome },
      reward: { ...receipt, outcome, recruits: [], boons: [] },
    });
  else if (receipt.recruits.length)
    enterPhase(state, {
      ...finished,
      phase: "recruit",
      journey: state.journey,
      reward: { ...receipt, outcome: "next", boons: [] },
    });
  else if (boons.length)
    enterPhase(state, {
      ...finished,
      phase: "boon",
      journey: state.journey,
      reward: { ...receipt, outcome: "next", recruits: [] },
    });
  else advanceEncounter(state);
}

export function settle(state: BattleState, events: GameEvent[]): boolean {
  if (![...state.team, ...state.reserves].some((c) => c.health > 0)) {
    finishBattle(state, true);
    events.push({ kind: "knockout", text: "Your journey has ended." });
    return true;
  }
  if (state.battle.enemies.every((e) => e.health <= 0)) {
    for (const creature of [...state.team, ...state.reserves]) {
      if (hasTalent(state, "health.vitality")) restoreHealth(creature, 4, events, false, state);
      creature.block = 0;
      creature.combat = freshCombat();
    }
    for (const enemy of state.battle.enemies) {
      enemy.combat = freshCombat();
      enemy.block = 0;
    }
    finishBattle(state, false);
    events.push({
      kind: finalEncounter(state) ? "victory" : "reward",
      text: "Battle complete. Rewards saved.",
    });
    return true;
  }
  return false;
}
export function afterRewards(state: RewardState) {
  advanceEncounter(state);
}
function advanceEncounter(state: BattleState | RewardState) {
  state.encounter++;
  if (state.expedition) prepareEncounter(state);
  enterDestination(state);
  prepareLineup(state);
}

/** Only complete lifecycle payloads cross this synchronous draft mutation boundary. */
function enterPhase<T extends Lifecycle>(state: GameState, next: T): GameState & T {
  return Object.assign(state, next);
}
function clearCombat(state: GameState) {
  for (const creature of [...state.team, ...state.reserves]) {
    creature.block = 0;
    creature.combat = freshCombat();
  }
}
function enterDestination(state: Exclude<GameState, StateAt<"draft">>) {
  enterPhase(state, {
    phase: "teamSelection",
    battle: null,
    reward: null,
    support: state.support,
    expedition: state.expedition,
    journey: { ...state.journey, outcome: null },
  });
}
export function startJourney(state: StateAt<"draft">) {
  enterPhase(state, {
    phase: "teamSelection",
    battle: null,
    reward: null,
    support: null,
    expedition: state.expedition,
    journey: { outcome: null, victories: 0, currency: 0, xp: {}, unlocks: [], lastBattle: null },
  });
  if (state.expedition) prepareEncounter(state);
}
export function enterMerchant(state: StateAt<"teamSelection">) {
  if (!state.support || !state.expedition) throw new Error("Missing Merchant visit.");
  enterPhase(state, { ...state, phase: "support", support: state.support, expedition: state.expedition });
}
export function leaveMerchant(state: StateAt<"support">) {
  state.support.resolved = true;
  state.expedition.lastRoom = "merchant";
  prepareEncounter(state);
  enterDestination(state);
}
export function enterCampfire(state: StateAt<"teamSelection">) {
  if (!state.expedition) throw new Error("Missing Campfire route.");
  enterPhase(state, { ...state, phase: "campfire", expedition: state.expedition });
}
export function leaveCampfire(state: StateAt<"campfire">) {
  state.expedition.lastRoom = "campfire";
  enterDestination(state);
}
export function returnHome(state: Exclude<GameState, StateAt<"draft" | "victory" | "defeat">>) {
  if (state.expedition) state.expedition.recruit = null;
  bankBattleXP(state);
  clearCombat(state);
  enterPhase(state, {
    phase: "defeat",
    battle: null,
    reward: null,
    support: null,
    expedition: state.expedition,
    journey: { ...state.journey, outcome: "returned" },
  });
}

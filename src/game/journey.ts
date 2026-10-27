import {
  battleMana,
  enemyBattleStart,
  playerBattleStart,
  victoryRecovery,
  victoryGoldBonus,
} from "./combat/battle-modifiers";
import { battlefieldView } from "./battlefield";
import { wellProvisioned } from "./combat/food";
import { bossDeck, removeDepartedMinions } from "./combat/legendary";
import { species } from "./content";
import { merchantPriceRange } from "./destinations";
import { starterCount, starterOfferPool, STARTER_OFFER_COUNT, KEYWORDS } from "./progression";
import { BOONS, SPECIES } from "./content";
import { freshCombat } from "./combat/index";
import { highestHealth } from "./combat/state";
import { shuffle, roll } from "./random";
import { bossEncounter, encounterSource, finalEncounter, generateEncounterPack } from "./encounters";
import type { GameEvent, GameState, Lifecycle, BattleState, RewardState, StateAt } from "./types";
import { rebuildCards } from "./team";
const OPTIONAL_DESTINATION_CHANCE = 0.25;
const recruitSpecies = SPECIES.filter((entry) => !entry.legendary);

export function offerStarters(state: GameState) {
  if (state.selected.length === starterCount(state)) {
    state.starterOffers = [];
    return;
  }
  const shuffled = shuffle(state, starterOfferPool(state));
  state.starterOffers = shuffled.slice(0, STARTER_OFFER_COUNT);
}
function prepareEncounter(state: GameState) {
  const route = state.expedition;
  route.pack = generateEncounterPack(state);
  const prices = route.lastRoom !== "merchant" ? merchantPriceRange(state) : undefined;
  const kind =
    prices && state.currency >= prices.min && roll(state) < OPTIONAL_DESTINATION_CHANCE ? "merchant" : null;
  route.recruit =
    route.lastRoom !== "recruit" &&
    state.team.length + state.reserves.length < 5 &&
    roll(state) < OPTIONAL_DESTINATION_CHANCE
      ? recruitSpecies[Math.floor(roll(state) * recruitSpecies.length)]!.id
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
            price: prices!.min + Math.floor(roll(state) * (prices!.max - prices!.min + 1)),
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
  const target = highestHealth(battlefieldView(state, "player"));
  for (const enemy of state.battle.enemies) {
    if (enemy.health > 0) enemy.targetId = target?.id ?? state.team[0]!.id;
  }
}
export function beginBattle(state: StateAt<"teamSelection">, events: GameEvent[] = []) {
  const encounter = encounterSource(state);
  for (const enemy of encounter.enemies)
    if (!state.discovery.encountered.includes(enemy.species)) state.discovery.encountered.push(enemy.species);
  rebuildCards(state);
  for (const row of [state.team, state.reserves])
    for (const c of row) {
      c.combat = freshCombat();
      c.block = 0;
      c.attacked = false;
    }
  const mana = battleMana(state);
  const battle = {
    metronomeActor: null,
    encoreProgress: 0,
    puzzleProgress: [],
    repeatNext: { player: false, enemy: false },
    copySerial: 0,
    earnedGold: 0,
    freeBurnUsed: false,
    meteoriteUsed: false,
    cardsPlayedThisTurn: 0,
    turn: 1,
    mana,
    maxMana: mana,
    draw: state.cards.map((c) => c.id),
    hand: [],
    buffer: [],
    discard: [],
    enemies: encounter.enemies.map((e, i) => {
      const enemy: import("./types").Enemy = {
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
      enemyBattleStart(enemy);
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
  wellProvisioned(active, events);
  active.battle.draw = shuffle(active, active.battle.draw);
  for (const enemy of active.battle.enemies)
    if (species(enemy.species).legendary) {
      enemy.deck = bossDeck(active, enemy);
    }
  playerBattleStart(active, events);
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
  const boss = !defeated && bossEncounter(state);
  state.currency = Math.min(
    1_000_000,
    state.currency + (defeated ? 0 : (boss ? 40 : 20) + victoryGoldBonus(state)),
  );
  const currency = state.currency - previousCurrency + earnedGold;
  const outcome = defeated ? "defeat" : finalEncounter(state) ? "victory" : "next";
  state.journey.currency = Math.min(1_000_000, state.journey.currency + currency - earnedGold);
  state.journey.lastBattle = { xp, currency, encounter: state.encounter, outcome };
  if (!defeated) state.journey.victories++;
  if (outcome === "victory") {
    state.wins = Math.min(1_000_000, state.wins + 1);
  }
  const availableBoons: typeof state.boons = [];
  if (!defeated && outcome !== "victory" && boss)
    for (const boon of BOONS) if (!state.boons.includes(boon.id)) availableBoons.push(boon.id);
  const boons = availableBoons.length ? shuffle(state, availableBoons).slice(0, 3) : [];
  const receipt = {
    xp,
    currency,
    outcome,
    recruits: defeated ? [] : encounterSource(state).enemies.map((enemy) => enemy.species),
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
  else
    enterPhase(state, {
      ...finished,
      phase: "recruit",
      journey: state.journey,
      reward: { ...receipt, outcome },
    });
}

export function settle(state: BattleState, events: GameEvent[]): boolean {
  removeDepartedMinions(state);
  if (!state.team.some((c) => c.health > 0) && !state.reserves.some((c) => c.health > 0)) {
    finishBattle(state, true);
    events.push({ kind: "knockout", text: "Your journey has ended." });
    return true;
  }
  if (state.battle.enemies.every((e) => e.health <= 0)) {
    for (const creature of [...state.team, ...state.reserves]) {
      victoryRecovery(state, creature, events);
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
  if (state.phase === "recruit") delete state.reward.selectedRecruit;
  if (state.phase === "recruit" && state.reward.outcome === "next" && state.reward.boons.length) {
    enterPhase(state, {
      ...state,
      phase: "boon",
      reward: { ...state.reward, outcome: "next", recruits: [] },
    });
  } else if (state.reward.outcome === "victory") {
    enterPhase(state, {
      ...state,
      phase: "victory",
      journey: { ...state.journey, outcome: "victory" },
      reward: { ...state.reward, outcome: "victory", recruits: [], boons: [] },
    });
  } else advanceEncounter(state);
}
function advanceEncounter(state: BattleState | RewardState) {
  state.encounter++;
  prepareEncounter(state);
  enterDestination(state);
  rebuildCards(state);
}

/** Only complete lifecycle payloads cross this synchronous draft mutation boundary. */
function enterPhase<T extends Lifecycle>(state: GameState, next: T): GameState & T {
  return Object.assign(state, next);
}
function clearCombat(state: GameState) {
  let kept: GameState["cards"] | undefined;
  for (let index = 0; index < state.cards.length; index++) {
    const card = state.cards[index]!;
    if (card.temporary) kept ??= state.cards.slice(0, index);
    else kept?.push(card);
  }
  if (kept) state.cards = kept;
  for (const row of [state.team, state.reserves])
    for (const creature of row) {
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
    journey: { outcome: null, victories: 0, currency: 0, xp: {}, lastBattle: null },
  });
  prepareEncounter(state);
}
export function enterMerchant(state: StateAt<"teamSelection">) {
  if (!state.support) throw new Error("Missing Merchant visit.");
  enterPhase(state, { ...state, phase: "support", support: state.support, expedition: state.expedition });
}
export function leaveMerchant(state: StateAt<"support">) {
  state.support.resolved = true;
  state.expedition.lastRoom = "merchant";
  prepareEncounter(state);
  enterDestination(state);
}
export function enterCampfire(state: StateAt<"teamSelection">) {
  enterPhase(state, { ...state, phase: "campfire", expedition: state.expedition });
}
export function leaveCampfire(state: StateAt<"campfire">) {
  state.expedition.lastRoom = "campfire";
  enterDestination(state);
}
export function returnHome(state: Exclude<GameState, StateAt<"draft" | "victory" | "defeat">>) {
  state.expedition.recruit = null;
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

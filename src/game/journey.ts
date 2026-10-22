import { merchantPrice } from "./support";
import { collectedSpecies, starterCount, creaturePassive, KEYWORDS, BOONS, hasTalent } from "./progression";
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
import { SPECIES, FIRST_RUN_STARTERS } from "./content";
import { bossEncounter, encounterSource, finalEncounter, encounterPacks } from "./encounters";
import type { GameEvent, GameState } from "./types";
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
export function prepareEncounter(state: GameState) {
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
export function intents(state: GameState) {
  const alive = living(state);
  for (const enemy of state.battle!.enemies) {
    if (enemy.health > 0)
      enemy.targetId = alive.length ? alive[Math.floor(roll(state) * alive.length)]!.id : state.team[0]!.id;
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
export function bankBattleXP(state: GameState) {
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
    state.wins = Math.min(1_000_000, state.wins + 1);
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
export function settle(state: GameState, events: GameEvent[]): boolean {
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
export function afterRewards(state: GameState) {
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

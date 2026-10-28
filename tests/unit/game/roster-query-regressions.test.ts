import { expect, it } from "vitest";
import { BOONS, CARDS, FOOD_CARDS, SPECIES, species } from "../../../src/game/content";
import { BOON_KEYWORDS } from "../../../src/game/content/boon-keywords";
import { offerBoons, rosterBoonKeywords } from "../../../src/game/boon-offers";
import { campfireRecovery, needsCampfire } from "../../../src/game/destinations";
import { scoopBonus } from "../../../src/game/combat/healing-values";
import { boonRule } from "../../../src/game/rules/boons";
import { definitionKeywords } from "../../../src/game/keywords";
import {
  abilityKeywords,
  cardKeywordView,
  creaturePassiveTier,
  passiveAmount,
} from "../../../src/game/progression";
import { addRecruit, pendingReplacement, swapBackup } from "../../../src/game/team";
import { roll } from "../../../src/game/random";
import type { GameEvent, GameState } from "../../../src/game/types";
import { requireBattle, teamRun } from "../../support/game";

it("leaves roster, cards, events and RNG intact for unknown replacement IDs", () => {
  const state = structuredClone(teamRun(42, ["mossguard", "prismram"]));
  state.reserves.push(state.team.pop()!);
  const before = structuredClone(state);
  addRecruit(state, "emberback", "missing");
  expect(state).toEqual(before);
  expect(Object.hasOwn(state.reserves, "-1")).toBe(false);
  const events: GameEvent[] = [];
  swapBackup(state, state.team[0]!.id, "missing", events, true);
  expect(state).toEqual(before);
  expect(events).toEqual([]);
});

it("still replaces active and reserve recruits and admits valid swaps", () => {
  for (const destination of ["team", "reserves"] as const) {
    const state = structuredClone(teamRun(42, ["mossguard", "prismram"]));
    state.reserves.push(state.team.pop()!);
    const outgoing = state[destination][0]!;
    addRecruit(state, "emberback", outgoing.id);
    expect(state[destination][0]!.species).toBe("emberback");
    expect([...state.team, ...state.reserves].some((unit) => unit.id === outgoing.id)).toBe(false);
    const backup = state.reserves[0]!;
    swapBackup(state, state.team[0]!.id, backup.id, []);
    expect(state.team[0]).toBe(backup);
  }
});

it("requires a living reserve and returns the first fallen active creature", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram", "emberback"])));
  state.reserves.push(state.team.pop()!);
  expect(pendingReplacement(state)).toBeUndefined();
  state.team[0]!.health = 0;
  state.team[1]!.health = 0;
  expect(pendingReplacement(state)).toBe(state.team[0]);
  state.reserves[0]!.health = 0;
  expect(pendingReplacement(state)).toBeUndefined();
});

function referenceOffers(state: GameState) {
  const keywords = rosterBoonKeywords(state);
  const pool = BOONS.filter((boon) => !state.boons.includes(boon.id)).map((boon) => ({
    id: boon.id,
    weight: BOON_KEYWORDS[boon.id]?.some((keyword) => keywords.has(keyword)) ? 2 : 1,
  }));
  const result = [];
  while (pool.length && result.length < 3) {
    let choice = roll(state) * pool.reduce((sum, boon) => sum + boon.weight, 0);
    let index = 0;
    while (index < pool.length - 1 && choice >= pool[index]!.weight) choice -= pool[index++]!.weight;
    result.push(pool.splice(index, 1)[0]!.id);
  }
  return result;
}

it("preserves weighted Boon selections and RNG for empty, partial and exhausted pools", () => {
  const base = structuredClone(teamRun(42, ["mossguard", "prismram"]));
  base.reserves.push(base.team.pop()!);
  const activeKeywords = rosterBoonKeywords({ ...base, reserves: [] });
  const reserveKeywords = rosterBoonKeywords({ ...base, team: [] });
  expect([...rosterBoonKeywords(base)]).toEqual([...new Set([...activeKeywords, ...reserveKeywords])]);
  for (const seed of [0, 1, 42, 0xffffffff])
    for (const owned of [0, 5, BOONS.length - 2, BOONS.length]) {
      const actual = { ...base, rng: seed, boons: BOONS.slice(0, owned).map((boon) => boon.id) };
      const expected = structuredClone(actual);
      expect(offerBoons(actual)).toEqual(referenceOffers(expected));
      expect(actual.rng).toBe(expected.rng);
    }
});

it("counts control and buildup once per harmful status for Scoop healing", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  state.boons = ["clover-measuring-scoop"];
  const unit = state.team[0]!;
  unit.combat!.controlled = "freeze";
  unit.combat!.freeze = 3;
  unit.combat!.poison = 2;
  expect(scoopBonus(state, unit, 1)).toBe(2 * boonRule("clover-measuring-scoop").healing);
  expect(scoopBonus(state, unit, 0)).toBe(0);
  expect(scoopBonus(state, state.battle.enemies[0]!, 1)).toBe(0);
});

it("shares immutable authored keyword views while keeping adapted effects live", () => {
  for (const definition of [...CARDS, ...FOOD_CARDS]) {
    const view = cardKeywordView({ definitionId: definition.id });
    expect(view).toBe(abilityKeywords(definition));
    expect(view).toEqual(definitionKeywords(definition));
    expect(Object.isFrozen(view)).toBe(true);
  }
  const effects = [{ kind: "status" as const, status: "burn" as const, amount: 1 }];
  const adapted = Object.freeze({ ...CARDS[0]!, effects });
  expect(abilityKeywords(adapted)).toContain("burn");
  effects.splice(0);
  expect(abilityKeywords(adapted)).toEqual(definitionKeywords(adapted));
});

it("reads passive values from each current tier", () => {
  const state = structuredClone(teamRun(42, ["mossguard"]));
  for (const rank of [1, 3, 6]) {
    state.discovery.recruited.mossguard = rank;
    const tier = creaturePassiveTier(state, "mossguard");
    for (const effect of tier.effects)
      expect(passiveAmount(state, "mossguard", effect.kind)).toBe(
        tier.effects.reduce((sum, entry) => sum + (entry.kind === effect.kind ? entry.amount : 0), 0),
      );
  }
});

it("keeps campfire rounding and eligibility at every authored health boundary", () => {
  const state = structuredClone(teamRun(42, ["mossguard"]));
  for (const entry of SPECIES) {
    const maximum = species(entry.id).health;
    const missing = Math.ceil(maximum * 0.3);
    for (const damage of [0, missing - 1, missing, maximum]) {
      const unit = { ...state.team[0]!, species: entry.id, health: maximum - damage };
      expect(campfireRecovery(unit)).toBe(Math.min(damage, Math.round(maximum * 0.3)));
      expect(needsCampfire({ ...state, team: [unit], reserves: [] })).toBe(damage * 10 >= maximum * 3);
      expect(needsCampfire({ ...state, team: [], reserves: [unit] })).toBe(damage * 10 >= maximum * 3);
    }
  }
});

import { produce } from "immer";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { generateEncounterPack, JOURNEY_LENGTH } from "../../../src/game/encounters";
import { canVisitCampfire } from "../../../src/game/destinations";
import { availablePlays } from "../../../src/game/play-queries";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { BattleState, Command, GameState, RewardState } from "../../../src/game/types";
import { accept, starterJourney, winBattle } from "../../support/game";

describe("journey lifecycle and deterministic replay", () => {
  it.each([3, 10, 98])("replays a complete journey and resumes each command for seed %s", (seed) => {
    let state = createGame(seed);
    let replay = createGame(seed);
    const step = (command: Command, accepted = true, development = false) => {
      expect(replay).toEqual(state);
      const before = state;
      const saved = encodeSave(before);
      const result = dispatch(before, command, development);
      const resumed = dispatch(decodeSave(encodeSave(replay)), command, development);
      expect(result).toEqual(resumed);
      expect(result.accepted).toBe(accepted);
      expect(encodeSave(before)).toBe(saved);
      if (accepted) {
        expect(result.state.revision).toBe(before.revision + 1);
      } else {
        expect(result.state).toBe(before);
        expect(result.state.rng).toBe(before.rng);
        expect(result.events).toEqual([]);
      }
      state = result.state;
      replay = resumed.state;
      expect(decodeSave(encodeSave(state))).toEqual(state);
      return result;
    };

    step({ type: "endTurn" }, false);
    step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "start" });
    expect(state.phase).toBe("teamSelection");
    for (let steps = 0; steps < 100 && state.phase !== "victory"; steps++) {
      expect(state.phase).toBe("teamSelection");
      if (state.support && state.support.stock.some((slot) => slot.price <= state.currency)) {
        const visit = state.support;
        const slot = visit.stock.find((offer) => offer.price <= state.currency)!;
        const previousCurrency = state.currency;
        step({ type: "enterSupport", visit: visit.id });
        step({ type: "buyBoon", visit: visit.id, slot: slot.slot });
        expect(state.currency).toBe(previousCurrency - slot.price);
        expect(state.boons).toContain(slot.boon);
        step({ type: "buyBoon", visit: visit.id, slot: slot.slot }, false);
        step({ type: "leaveSupport", visit: visit.id });
        continue;
      }
      if (state.expedition?.recruit && state.team.length + state.reserves.length < 5) {
        const species = state.expedition.recruit;
        const count = state.discovery.recruited[species] ?? 0;
        step({ type: "recruitDestination", species });
        expect(state.discovery.recruited[species]).toBe(Math.min(6, count + 1));
        continue;
      }
      const room = state.encounter;
      const victories = state.journey!.victories;
      const pack = state.expedition!.pack;
      step({ type: "beginBattle" });
      expect(state.phase).toBe("battle");
      const battle = state as GameState;
      if (battle.phase !== "battle") throw new Error("Expected a battle");
      expect(battle.battle.enemies.map((enemy) => enemy.species)).toEqual(pack);
      const command = availablePlays(battle, false)[0]?.commands[0];
      expect(command).toBeDefined();
      if (!command) throw new Error("Expected a playable card");
      const savedBeforePreview = encodeSave(state);
      expect(previewCard(state, command.cardId, command.targetId).accepted).toBe(true);
      expect(encodeSave(state)).toBe(savedBeforePreview);
      step(command);
      if (state.phase === "battle") {
        // Check a real turn on a saved branch without making the journey depend on combat balance.
        const ended = dispatch(state, { type: "endTurn" });
        expect(ended.accepted).toBe(true);
        expect(ended).toEqual(dispatch(decodeSave(encodeSave(state)), { type: "endTurn" }));
        expect(decodeSave(encodeSave(ended.state))).toEqual(ended.state);
        step({ type: "devWinBattle" }, true, true);
      }
      expect(state.phase).toBe("recruit");
      expect(state.battle).toBeNull();
      expect(state.reward!.recruits).toEqual(pack);
      expect(state.journey!.lastBattle?.outcome).toBe(room === JOURNEY_LENGTH - 1 ? "victory" : "next");
      expect(state.journey!.victories).toBe(victories + 1);
      step({ type: "endTurn" }, false);
      const reward = state as GameState;
      if (reward.phase !== "recruit") throw new Error("Expected a recruit reward");
      const species = reward.reward.recruits[0]!;
      const count = state.discovery.recruited[species] ?? 0;
      step({ type: "recruit", species });
      expect(state.discovery.recruited[species]).toBe(Math.min(6, count + 1));
      if (state.phase === "recruit" && state.reward.selectedRecruit !== undefined)
        step({ type: "confirmRecruit", replace: state.team[0]!.id });
      if (state.phase === "boon") {
        const boon = state.reward.boons[0]!;
        step({ type: "chooseBoon", boon });
        expect(state.boons).toContain(boon);
      }
      if (room === JOURNEY_LENGTH - 1) break;
      state = produce(state, (draft) => {
        draft.team[0]!.health = 1;
      });
      replay = decodeSave(encodeSave(state));
      if (canVisitCampfire(state)) {
        step({ type: "visitCampfire" });
        expect(state.phase).toBe("campfire");
        step({ type: room % 2 ? "leaveCampfire" : "rest" });
        expect(state.phase).toBe("teamSelection");
        if (room % 2 === 0) expect(state.team[0]!.health).toBeGreaterThan(1);
        else expect(state.team[0]!.health).toBe(1);
      }
    }
    expect(state.phase).toBe("victory");
    step({ type: "newRun", seed: seed + 1 });
    expect(state.phase).toBe("draft");
    step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "abandon" });
    expect(state.selected).toEqual([]);
    while (state.phase === "draft" && state.starterOffers.length)
      step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "start" });
    step({ type: "abandon" });
    expect(state.phase).toBe("defeat");
  });
});

it("completes the final Boss reward after removing the former Legendary", () => {
  const ready = produce(starterJourney(7, "captoad"), (draft) => {
    draft.encounter = 29;
    draft.journey!.victories = 29;
    draft.expedition!.pack = generateEncounterPack(draft, ["chronora"]);
    draft.expedition.recruit = null;
    draft.support = null;
  });
  expect(ready.expedition!.pack).toEqual(["chronora"]);
  const battle = accept(decodeSave(encodeSave(ready)), { type: "beginBattle" });
  expect(battle.battle!.enemies[0]!.species).toBe("chronora");
  const won = winBattle(battle);
  expect(won.reward!.recruits).toEqual(["chronora"]);
  const recruited = accept(decodeSave(encodeSave(won)), { type: "recruit", species: "chronora" });
  expect(recruited.phase).toBe("victory");
  expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
});

it("allows an owned Legendary as the final Boss", () => {
  const ready = produce(starterJourney(7, "chronora"), (draft) => {
    draft.encounter = 29;
    draft.journey!.victories = 29;
    draft.expedition!.pack = generateEncounterPack(draft, ["chronora"]);
    draft.expedition.recruit = null;
    draft.support = null;
  });
  expect(ready.expedition!.pack).toEqual(["chronora"]);
  const battle = accept(decodeSave(encodeSave(ready)), { type: "beginBattle" });
  const result = dispatch(battle, { type: "devWinBattle" }, true);
  expect(result.accepted).toBe(true);
  const won = result.state;
  expect(won.reward!.recruits).toEqual(ready.expedition!.pack);
  expect(accept(won, { type: "recruit", species: won.reward!.recruits[0]! }).phase).toBe("victory");
});

it("keeps a completed receipt detached from recruitment and rejects repeated settlement", () => {
  const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
  expect(won.phase).toBe("recruit");
  expect(won.battle).toBeNull();
  const receipt = won.journey!.lastBattle;
  expect(Object.isFrozen(receipt)).toBe(true);
  const saved = encodeSave(won);
  const resumed = decodeSave(saved);
  const next = accept(resumed, { type: "recruit", species: resumed.reward!.recruits[0]! });
  expect(next.journey!.lastBattle).toEqual(receipt);
  expect(next.currency).toBe(won.currency);
  expect(next.keywordXP).toEqual(won.keywordXP);
  expect(next.battle).toBeNull();
  expect(decodeSave(encodeSave(next))).toEqual(next);
  expect(encodeSave(won)).toBe(saved);
  for (const command of [
    { type: "endTurn" },
    { type: "devWinBattle" },
    { type: "recruit", species: won.reward!.recruits[0]! },
  ] as const) {
    const rejected = dispatch(next, command, true);
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(next);
    expect(rejected.events).toEqual([]);
  }
});

it("rejects phase payload mismatches and contradictory completed receipts", () => {
  const ready = starterJourney(3, "captoad");
  const battle = accept(ready, { type: "beginBattle" });
  const won = winBattle(battle);
  const cases = [
    { ...ready, phase: "battle" },
    { ...battle, reward: won.reward },
    { ...won, battle: battle.battle },
    { ...won, reward: null },
    { ...won, journey: null },
    { ...won, phase: "boon" },
    { ...won, reward: { ...won.reward, currency: won.reward!.currency + 1 } },
    { ...won, journey: { ...won.journey, lastBattle: { ...won.journey!.lastBattle, encounter: 7 } } },
    { ...won, version: 68 },
  ];
  for (const candidate of cases) expect(() => decodeSave(JSON.stringify(candidate))).toThrow();
});

it("preserves the returned result before combat and after a completed reward", () => {
  const ready = starterJourney(3, "captoad");
  const won = winBattle(accept(ready, { type: "beginBattle" }));
  for (const state of [ready, won]) {
    const returned = accept(state, { type: "abandon" });
    expect(returned.journey!.outcome).toBe("returned");
    expect(returned.reward).toBeNull();
    expect(returned.battle).toBeNull();
    expect(returned.currency).toBe(state.currency);
    expect(returned.journey!.lastBattle).toEqual(state.journey!.lastBattle);
    expect(decodeSave(encodeSave(returned))).toEqual(returned);
  }
});

it("exposes required phase payloads in the shared schema types", () => {
  expectTypeOf<BattleState["battle"]>().toEqualTypeOf<NonNullable<GameState["battle"]>>();
  expectTypeOf<BattleState["reward"]>().toEqualTypeOf<null>();
  expectTypeOf<RewardState["battle"]>().toEqualTypeOf<null>();
  expectTypeOf<RewardState["reward"]>().toEqualTypeOf<NonNullable<RewardState["reward"]>>();
});

it("resumes a return home from the final Recruit reward without losing the earned victory", () => {
  const ready = produce(starterJourney(3, "captoad"), (draft) => {
    draft.encounter = 29;
    draft.journey!.victories = 29;
    draft.expedition!.pack = generateEncounterPack(draft);
    draft.expedition.recruit = null;
    draft.support = null;
  });
  const won = winBattle(accept(ready, { type: "beginBattle" }));
  expect(won.phase).toBe("recruit");
  expect(decodeSave(encodeSave(won))).toEqual(won);
  const returned = accept(won, { type: "abandon" });
  expect(returned.journey!.outcome).toBe("returned");
  expect(returned.journey!.lastBattle).toEqual(won.journey!.lastBattle);
  expect(returned.wins).toBe(won.wins);
  expect(returned.currency).toBe(won.currency);
  expect(decodeSave(encodeSave(returned))).toEqual(returned);
});

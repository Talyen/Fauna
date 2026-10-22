import { createHash } from "node:crypto";
import { produce } from "immer";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { chooseBattleCommand } from "../../../src/application/battle-policy";
import type { BattleState, Command, GameState, RewardState } from "../../../src/game/types";

// Compare gameplay, RNG and ordered output while deliberately excluding the obsolete live
// battle receipt and out-of-combat status data that the lifecycle refactor retires.
function fingerprint(state: GameState, events: unknown) {
  const { version: _version, battle, ...rest } = state;
  const projected = {
    ...rest,
    journey: state.journey
      ? {
          ...state.journey,
          lastBattle: state.journey.lastBattle
            ? { xp: state.journey.lastBattle.xp, currency: state.journey.lastBattle.currency }
            : null,
        }
      : null,
    battle: state.phase === "battle" ? battle : null,
    team: state.team.map(({ combat, block, ...unit }) =>
      state.phase === "battle" ? { ...unit, combat, block } : unit,
    ),
    reserves: state.reserves.map(({ combat, block, ...unit }) =>
      state.phase === "battle" ? { ...unit, combat, block } : unit,
    ),
    events,
  };
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return createHash("sha256")
    .update(JSON.stringify(canonical(projected)))
    .digest("hex");
}

import { accept, starterJourney, winBattle } from "../../support/game";

describe("journey lifecycle behavior baseline", () => {
  it.each([3, 10, 98])("preserves seeded commands and outputs for seed %s", (seed) => {
    let state = createGame(seed);
    const trace: unknown[] = [];
    const step = (command: Command, development = false) => {
      const before = state;
      const result = dispatch(state, command, development);
      if (result.accepted) state = result.state;
      else {
        expect(result.state).toBe(before);
        expect(result.state.rng).toBe(before.rng);
      }
      expect(decodeSave(encodeSave(state))).toEqual(state);
      trace.push([command, result.accepted, state.phase, fingerprint(state, result.events)]);
    };
    step({ type: "endTurn" });
    step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "start" });
    for (let room = 0; room < 8; room++) {
      if (state.support && state.support.stock.some((slot) => slot.price <= state.currency)) {
        const visit = state.support;
        const slot = visit.stock.find((offer) => offer.price <= state.currency)!;
        step({ type: "enterSupport", visit: visit.id });
        step({ type: "buyBoon", visit: visit.id, slot: slot.slot });
        step({ type: "buyBoon", visit: visit.id, slot: slot.slot });
        step({ type: "leaveSupport", visit: visit.id });
      }
      if (state.expedition?.recruit && state.roster.length < 5)
        step({ type: "recruitDestination", species: state.expedition.recruit });
      step({ type: "beginBattle" });
      const command = chooseBattleCommand(state, false);
      if (command.type === "play") {
        const preview = previewCard(state, command.cardId, command.targetId);
        expect(state).toEqual(decodeSave(encodeSave(state)));
        trace.push(["preview", preview.accepted, fingerprint(preview.state, preview.events)]);
        step(command);
      }
      if (state.phase === "battle") step({ type: "endTurn" });
      if (state.phase === "battle") step({ type: "devWinBattle" }, true);
      step({ type: "endTurn" });
      if (state.phase === "recruit") {
        step({
          type: "recruit",
          species: state.reward!.recruits[0]!,
          ...(state.roster.length === 5 ? { replace: state.lineup[0]! } : {}),
        });
      } else if (state.phase === "boon") step({ type: "chooseBoon", boon: state.reward!.boons[0]! });
      if (state.phase === "victory" || state.phase === "defeat") break;
      state = produce(state, (draft) => {
        draft.team[0]!.health = 1;
      });
      step({ type: "visitCampfire" });
      if (state.phase === "campfire") step({ type: room % 2 ? "leaveCampfire" : "rest" });
    }
    expect(state.phase).toBe("victory");
    step({ type: "newRun", seed: seed + 1 });
    step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "abandon" });
    step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "start" });
    step({ type: "abandon" });
    expect(trace).toMatchSnapshot();
  });
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
    { ...won, version: 44 },
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

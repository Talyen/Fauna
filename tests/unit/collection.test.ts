import { expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { decodeSave, encodeSave } from "../../src/game/save";
import { creatureStars, talentPoints, xpThreshold, keywordProgress } from "../../src/game/progression";
import { accept, teamRun, winBattle } from "./helpers";

it("discovers only committed encounters and retains knowledge independently of starter unlocks", () => {
  const fresh = createGame();
  const starter = fresh.starterOffers[0]!;
  let state = accept(accept(fresh, { type: "draft", species: starter }), { type: "start" });
  expect(state.discovery.encountered).toEqual([starter]);
  const rejected = dispatch(state, { type: "endTurn" });
  expect(rejected.state).toBe(state);
  state = accept(state, { type: "beginBattle" });
  expect(state.discovery.encountered).toEqual([
    ...new Set([starter, ...state.battle!.enemies.map((enemy) => enemy.species)]),
  ]);
  const unlocked = state.unlocked;
  state = winBattle(state);
  const kind = state.reward!.recruits[0]!;
  state = accept(state, { type: "recruit", species: kind });
  expect(state.discovery.recruited).toEqual(
    kind === starter ? { [starter]: 2 } : { [starter]: 1, [kind]: 1 },
  );
  expect(state.unlocked).toEqual(unlocked);
  state = accept(state, { type: "abandon" });
  const knowledge = state.discovery;
  expect(decodeSave(encodeSave(state)).discovery).toEqual(knowledge);
  state = accept(state, { type: "newRun", seed: 8 });
  expect(state.discovery).toEqual(knowledge);
  const corrupt = produce(state, (draft) => {
    draft.discovery.recruited = { prismram: 1 };
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});
it("uses discounted early XP thresholds without granting points early at large boundaries", () => {
  expect([1, 2, 3, 4, 5].map(xpThreshold)).toEqual([10, 40, 100, 180, 280]);
  for (const points of [1, 2, 3, 4, 5, 316, 1_000_000, 30_000_000]) {
    const threshold = xpThreshold(points);
    expect(talentPoints(threshold - 1)).toBe(points - 1);
    expect(talentPoints(threshold)).toBe(points);
    expect(talentPoints(threshold + 1)).toBe(points);
    expect(keywordProgress(threshold).current).toBe(0);
  }
  expect(talentPoints(Infinity)).toBe(0);
  expect(talentPoints(-1)).toBe(0);
});

it("collects only accepted recruits, caps stars at five, and retains ranks across saves and journeys", () => {
  let state = createGame(42);
  const first = state.starterOffers[0]!;
  state = accept(accept(state, { type: "draft", species: first }), { type: "start" });
  expect(state.discovery.recruited).toEqual({ [first]: 1 });
  for (let copy = 1; copy <= 8; copy++) {
    state = winBattle(
      accept(
        produce(state, (draft) => {
          draft.expedition!.pack = 0;
        }),
        { type: "beginBattle" },
      ),
    );
    const kind = state.reward!.recruits[0]!;
    const before = state.discovery;
    const invalid = dispatch(state, { type: "recruit", species: kind, replace: "missing" });
    expect(invalid.accepted).toBe(false);
    expect(invalid.state).toBe(state);
    expect(dispatch(state, { type: "skipRecruit" }).state).toBe(state);
    const expected = Math.min((before.recruited[kind] ?? 0) + 1, 6);
    state = accept(state, { type: "recruit", species: kind });
    expect(state.discovery.recruited[kind]).toBe(expected);
    expect(creatureStars(state, kind)).toBe(expected - 1);
    const repeated = dispatch(state, { type: "recruit", species: kind });
    expect(repeated.accepted).toBe(false);
    expect(repeated.state).toBe(state);
    state = decodeSave(encodeSave(accept(state, { type: "abandon" })));
    const retained = state.discovery;
    state = accept(state, { type: "newRun", seed: 42 });
    for (let pick = 0; pick < 3; pick++) {
      state = accept(state, { type: "draft", species: state.starterOffers[0]! });
    }
    state = accept(state, { type: "start" });
    expect(state.discovery).toEqual(retained);
  }
  expect(Object.values(state.discovery.recruited)).toContain(6);
});

it.each([1, 2, 3, 4, 5, 6])("accepts permanent recruitment count %i without changing it", (count) => {
  const state = produce(teamRun(42, ["mossguard"]), (draft) => {
    draft.discovery.recruited.mossguard = count;
  });
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

it.each([0, -1, 7, 1.5, "2", null])("rejects invalid permanent recruitment counts: %s", (count) => {
  const state = teamRun(42, ["mossguard"]);
  expect(decodeSave(encodeSave(state))).toEqual(state);
  const data = JSON.parse(encodeSave(state));
  data.discovery.recruited.mossguard = count;
  expect(() => decodeSave(JSON.stringify(data))).toThrow();
});
it("rejects obsolete and unknown collection records", () => {
  const state = teamRun(42, ["mossguard"]);
  expect(decodeSave(encodeSave(state))).toEqual(state);
  for (const change of [
    { discovery: { ...state.discovery, recruited: { ...state.discovery.recruited, unknown: 1 } } },
    { discovery: { ...state.discovery, recruited: [] } },
    { version: 20 },
  ])
    expect(() => decodeSave(JSON.stringify({ ...state, ...change }))).toThrow();
});

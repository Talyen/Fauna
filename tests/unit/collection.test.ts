import { expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { decodeSave, encodeSave } from "../../src/game/save";
import { talentPoints, xpThreshold, keywordProgress } from "../../src/game/progression";
import { accept, winBattle } from "./helpers";

it("discovers only committed encounters and retains knowledge independently of starter unlocks", () => {
  let state = accept(accept(createGame(), { type: "draft", species: "emberfox" }), { type: "start" });
  expect(state.discovery.encountered).toEqual([]);
  const rejected = dispatch(state, { type: "beginBattle", destination: "missing" });
  expect(rejected.state).toBe(state);
  state = accept(state, { type: "beginBattle" });
  expect(state.discovery.encountered).toEqual([
    ...new Set(state.battle!.enemies.map((enemy) => enemy.species)),
  ]);
  const unlocked = state.unlocked;
  state = winBattle(state);
  const kind = state.reward!.recruits[0]!;
  state = accept(state, { type: "recruit", species: kind });
  expect(state.discovery.recruited).toEqual([kind]);
  expect(state.unlocked).toEqual(unlocked);
  state = accept(state, { type: "abandon" });
  const knowledge = state.discovery;
  expect(decodeSave(encodeSave(state)).discovery).toEqual(knowledge);
  state = accept(state, { type: "newRun", seed: 8 });
  expect(state.discovery).toEqual(knowledge);
  const corrupt = produce(state, (draft) => {
    draft.discovery.recruited = ["moonhart"];
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

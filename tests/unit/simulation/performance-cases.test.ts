import { it, expect } from "vitest";
import { performanceCases, reachablePerformanceCases } from "../../../src/tooling/performance";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { dispatch } from "../../../src/game/engine";
import type { Command } from "../../../src/game/types";

it("retains replayable current-format performance checkpoints", () => {
  expect(performanceCases(17)[0]!.initial).not.toBe(performanceCases(42)[0]!.initial);
  for (const scenario of performanceCases()) {
    let state = decodeSave(scenario.initial);
    for (const action of scenario.actions) {
      if ("command" in action) {
        const result = dispatch(state, action.command as Command);
        expect(result.accepted).toBe(true);
        state = result.state;
      }
      expect(encodeSave(state)).toBe(action.checkpoint);
    }
  }
});
it("repeats artwork navigation without changing gameplay checkpoints or broadening ordinary captures", () => {
  const scenarios = performanceCases(42, false, true);
  expect(scenarios).toHaveLength(1);
  const scenario = scenarios[0]!;
  expect(scenario.id).toBe("resource-menus");
  expect(scenario.actions).toHaveLength(24);
  expect(scenario.actions.every((action) => action.checkpoint === scenario.initial)).toBe(true);
  expect(performanceCases().some((row) => row.id === "resource-menus")).toBe(false);
});
it("previews an ability with an explicit target instead of immediately playing an area attack", () => {
  const scenario = performanceCases().find((row) => row.id === "preview")!;
  const target = scenario.actions.find((action) => action.kind === "target");
  expect(target).toMatchObject({ targetId: expect.any(String), checkpoint: scenario.initial });
});
// Constructing and replaying three full journeys can exceed the default deadline on hosted CPUs
it("derives reachable early and late inventories from replay evidence without fixture grants", async () => {
  const scenarios = await reachablePerformanceCases(15);
  expect(scenarios).toHaveLength(2);
  const journey = scenarios[0]!.journey;
  expect(journey.complete).toBe(true);
  let state = decodeSave(journey.initial);
  for (const step of journey.steps) {
    const result = dispatch(state, step.command);
    expect(result.accepted).toBe(step.accepted);
    expect(decodeSave(encodeSave(result.state))).toEqual(decodeSave(step.checkpoint));
    state = result.state;
  }
  for (const scenario of scenarios) {
    expect(journey.steps.some((step) => step.checkpoint === scenario.initial)).toBe(true);
    state = decodeSave(scenario.initial);
    expect(scenario.inventory.talents).toEqual(state.talents);
    for (const action of scenario.actions) {
      const result = dispatch(state, action.command);
      expect(result.accepted).toBe(true);
      expect(encodeSave(result.state)).toBe(action.checkpoint);
      state = result.state;
    }
  }
}, 30000);

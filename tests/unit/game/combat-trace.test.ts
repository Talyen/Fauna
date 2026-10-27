import { expect, it } from "vitest";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { traceCombat } from "../../../src/tooling/combat-trace";
import type { GameEvent } from "../../../src/game/types";
import { run } from "../../support/game";

it("records nested reactions and detached state, events and RNG without changing the outcome", () => {
  const make = () => {
    const state = structuredClone(run());
    const source = state.team[0]!;
    const target = state.battle!.enemies[0]!;
    source.combat = freshCombat();
    target.combat = { ...freshCombat(), thorns: 5 };
    target.block = 20;
    const events: GameEvent[] = [];
    return { state, source, target, events };
  };
  const normal = make();
  const traced = make();
  hit(normal.state, normal.source, normal.target, 4, "nature", normal.events);
  const result = traceCombat(
    "hit",
    [traced.state, traced.source, traced.target, 4, "nature", traced.events],
    traced.state,
    traced.events,
  );
  expect(traced.events.map(({ kind }) => kind)).toEqual(["block", "damage", "damage"]);
  expect(
    result.steps.filter(({ phase }) => phase === "enter").map(({ kind, depth }) => [kind, depth]),
  ).toEqual([
    ["hit", 0],
    ["negateAttack", 1],
    ["resolveHit", 1],
    ["applyHarmfulStatus", 2],
    ["hit", 2],
    ["resolveHit", 3],
    ["healthThresholds", 4],
  ]);
  expect(traced.state).toEqual(normal.state);
  expect(traced.events).toEqual(normal.events);
  expect(result.steps[0]).toMatchObject({ kind: "hit", phase: "enter", depth: 0 });
  expect(result.steps.at(-1)).toMatchObject({
    kind: "hit",
    phase: "exit",
    depth: 0,
    state: normal.state,
    events: normal.events,
  });
  expect(result.steps.some((step) => step.depth > 0)).toBe(true);
  expect(result.steps[0]!.state).not.toEqual(traced.state);
  expect(result.steps.at(-1)!.state.rng).toBe(normal.state.rng);
});

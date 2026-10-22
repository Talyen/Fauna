import { createHash } from "node:crypto";
import { produce } from "immer";
import { expect, it } from "vitest";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { BOONS, TALENTS, KEYWORDS } from "../../../src/game/progression";
import { freshCombat } from "../../../src/game/combat/index";
import { policy, teamRun, victoryReady } from "../../support/game";
import type { SpeciesId } from "../../../src/game/content";

const cases: { name: string; seed: number; team: SpeciesId[] }[] = [
  { name: "Armor bursts and status thresholds", seed: 42, team: ["emberback", "mossguard", "prismram"] },
  { name: "retaliation and exact absorption", seed: 1972, team: ["coralcurl", "captoad", "emberback"] },
  { name: "bounce and healing", seed: 1, team: ["glintstride", "ringpalm", "dawncall"] },
  { name: "repeats and control", seed: 123, team: ["chimecricket", "cadenza", "wickwaltz"] },
];

it.each(cases)("preserves committed command traces for $name", ({ seed, team }) => {
  let state = produce(teamRun(seed, team), (draft) => {
    draft.talents = TALENTS.map((talent) => talent.id);
    draft.keywordXP = Object.fromEntries(KEYWORDS.map((keyword) => [keyword, 1_000_000]));
    draft.boons = BOONS.map((boon) => boon.id);
    for (const unit of draft.team) {
      unit.health = Math.max(2, Math.round(unit.health / 2));
      unit.block = 3;
      unit.combat = freshCombat();
      unit.combat.armor = 2;
      unit.combat.burn = 1;
    }
    for (const enemy of draft.battle!.enemies) {
      enemy.combat.armor = 2;
      enemy.combat.thorns = 1;
      enemy.block = 2;
    }
  });
  const trace = [];
  for (let step = 0; step < 20 && state.phase === "battle"; step++) {
    const command = policy(state);
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    const resumed = dispatch(decodeSave(encodeSave(state)), command);
    expect(resumed).toEqual(result);
    // The recorded oracle predates format 43; save/resume above validates the live format.
    // Keep format metadata at its baseline value so format bumps do not recapture combat outcomes.
    const baselineResult = { ...result, state: { ...result.state, version: 42 } };
    trace.push({
      command,
      phase: result.state.phase,
      rng: result.state.rng,
      digest: createHash("sha256").update(JSON.stringify(baselineResult)).digest("hex"),
    });
    state = result.state;
  }
  expect(trace.length).toBeGreaterThan(0);
  expect(trace).toMatchSnapshot();
});

it("keeps the shared victory checkpoint resumable before its final play", () => {
  const checkpoint = victoryReady(teamRun(42, ["mossguard", "emberback", "prismram"]));
  const resumed = decodeSave(encodeSave(checkpoint));
  expect(resumed).toEqual(checkpoint);
  expect(
    resumed.battle!.enemies.map((enemy) => [enemy.combat.controlled, enemy.combat.controlTurns]),
  ).toEqual([["stun", 1], ...resumed.battle!.enemies.slice(1).map(() => [null, 0])]);
  const command = { type: "play" as const, cardId: checkpoint.battle!.hand[0]!, targetId: "enemy-0" };
  expect(dispatch(resumed, command)).toEqual(dispatch(checkpoint, command));
});

import { expect, it } from "vitest";
import { reviewScenario } from "../../../scripts/dev/review-scenarios.mjs";
import { reviewOptions } from "../../../scripts/dev/review-options.mjs";
import { uiGuide } from "../../../scripts/agent/ui-guide.mjs";
import * as fixtures from "../../support/game";
import * as save from "../../../src/game/save";
import * as content from "../../../src/game/content";
import * as random from "../../../src/game/random";

const modules = {
  "/tests/support/game.ts": fixtures,
  "/src/game/save.ts": save,
  "/src/game/content.ts": content,
  "/src/game/random.ts": random,
};
const server = {
  ssrLoadModule: async (path) => {
    if (!modules[path]) throw new Error(`Unexpected module: ${path}`);
    return modules[path];
  },
};

it("varies both battle lineups across seeds and replays each complete checkpoint", async () => {
  const lineups = new Set();
  for (const seed of [0, 1, 42, 2026, 0xffffffff]) {
    const scenario = await reviewScenario(server, "battle", { seed });
    const replay = await reviewScenario(server, "battle", { seed });
    expect(replay.save).toBe(scenario.save);
    expect(replay.lineup).toEqual(scenario.lineup);
    expect(scenario.seed).toBe(seed);
    const game = save.decodeSave(scenario.save);
    expect(game.phase).toBe("battle");
    expect(game.team).toHaveLength(3);
    expect(game.battle.enemies).toHaveLength(3);
    const kinds = [...game.team, ...game.battle.enemies].map((unit) => unit.species);
    expect(new Set(kinds).size).toBe(6);
    expect(kinds.every((id) => !content.species(id).legendary)).toBe(true);
    expect(scenario.lineup).toEqual({
      allies: game.team.map((unit) => unit.species),
      enemies: game.battle.enemies.map((unit) => unit.species),
    });
    lineups.add(JSON.stringify(scenario.lineup));
  }
  expect(lineups.size).toBe(5);
});

it("records a generated seed that reproduces a default sample", async () => {
  const sample = await reviewScenario(server, "battle");
  expect(Number.isInteger(sample.seed)).toBe(true);
  expect(sample.seed).toBeGreaterThanOrEqual(0);
  expect(sample.seed).toBeLessThanOrEqual(0xffffffff);
  expect((await reviewScenario(server, "battle", { seed: sample.seed })).save).toBe(sample.save);
});

it("preserves the shared fixed fixture and non-battle review scenarios", async () => {
  const standard = fixtures.run();
  expect(standard.team.map((unit) => unit.species)).toEqual(["mossguard", "emberback", "prismram"]);
  expect(standard.battle.enemies.map((unit) => unit.species)).toEqual([
    "emberback",
    "pollenmoth",
    "mossguard",
  ]);
  expect((await reviewScenario(server, "pause")).save).toBe(save.encodeSave(standard));
  await expect(reviewScenario(server, "pause", { seed: 1 })).rejects.toThrow("battle sample");
});

it("validates replay seeds and gives both guided captures the same random lineup seed", () => {
  expect(reviewOptions(["--seed", "0"], { capture: true }).seed).toBe(0);
  expect(reviewOptions(["--browser", "--scenario", "battle", "--seed", "4294967295"]).seed).toBe(0xffffffff);
  for (const value of ["-1", "1.5", "4294967296", "0x10", "1e3", " 1", "01"])
    expect(() => reviewOptions(["--seed", value], { capture: true })).toThrow();
  expect(() => reviewOptions(["--scenario", "pause", "--seed", "1"], { capture: true })).toThrow(
    "battle sample",
  );
  const guide = uiGuide("layout", "battle");
  const seeds = [...guide.matchAll(/--seed (\d+)/g)].map((match) => match[1]);
  expect(seeds).toHaveLength(2);
  expect(seeds[0]).toBe(seeds[1]);
  expect(uiGuide("layout", "pause")).not.toContain("--seed");
});

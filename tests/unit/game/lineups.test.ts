import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { SPECIES } from "../../../src/game/content";
import { ordinaryLineups } from "../../support/lineups";
import { LINEUP_SHARDS, lineupShard } from "../../../scripts/ci/unit-shards.mjs";

it("partitions every ordinary lineup once without changing seeds, order or scenarios", () => {
  const scenarios = ordinaryLineups();
  expect(lineupShard(scenarios, undefined)).toBe(scenarios);
  const shards = Array.from({ length: LINEUP_SHARDS }, (_, index) =>
    lineupShard(scenarios, String(index + 1)),
  );
  const combined = shards.flat();
  expect(combined).toHaveLength(scenarios.length);
  expect(new Set(combined).size).toBe(scenarios.length);
  expect(new Set(combined)).toEqual(new Set(scenarios));
  expect(
    Math.max(...shards.map((shard) => shard.length)) - Math.min(...shards.map((shard) => shard.length)),
  ).toBeLessThanOrEqual(1);
  for (const shard of ["", "0", "5", "1.5", "01", "wrong"])
    expect(() => lineupShard(scenarios, shard)).toThrow("Invalid lineup shard");
});

it("covers every distinct ordinary trio once with stable seeded identities", () => {
  const ordinary = SPECIES.filter((entry) => !entry.legendary).map((entry) => entry.id);
  const count = (ordinary.length * (ordinary.length - 1) * (ordinary.length - 2)) / 6;
  const scenarios = ordinaryLineups();
  expect(scenarios).toHaveLength(count);
  expect(new Set(scenarios.map(({ kinds }) => [...kinds].sort().join(","))).size).toBe(count);
  for (const { kinds } of scenarios) {
    expect(kinds).toHaveLength(3);
    expect(new Set(kinds).size).toBe(3);
    expect(kinds.every((kind) => ordinary.includes(kind))).toBe(true);
  }
  expect(scenarios.slice(0, 2)).toEqual([
    { name: "Rookhaven, Cadenza, Stillara", seed: 12, kinds: ["rookhaven", "cadenza", "stillara"] },
    { name: "Rookhaven, Cadenza, Neradora", seed: 13, kinds: ["rookhaven", "cadenza", "neradora"] },
  ]);
});

it("collects every generated lineup in the full suite without executing the simulations", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const cases = JSON.parse(
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/vitest/vitest.mjs"),
        "list",
        "tests/exhaustive/roster-combinations.test.ts",
        "--json",
        "--staticParse=false",
        "--maxWorkers=1",
        "--no-file-parallelism",
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1024" },
      },
    ),
  ) as { name: string }[];
  expect(cases.map(({ name }) => name).sort()).toEqual(
    ordinaryLineups()
      .map(
        ({ name }) =>
          `all ordinary creature combinations > supports ${name} without engine failures or invalid saves`,
      )
      .sort(),
  );
  // Collection launches a subprocess with its own 30-second deadline.
}, 35_000);

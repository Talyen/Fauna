import { expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { temporaryDirectory, put } from "../../support/tooling.mjs";
import {
  parsePlaythroughArgs,
  runPlaythrough,
  runPlaythroughWorker,
  validatePlaythroughComparison,
  validatePlaythroughReplay,
} from "../../../scripts/balance/run-playthrough.mjs";
import { shrinkTrace, finishInteractionRun } from "../../../scripts/lib/interaction-replay.mjs";

const config = { seed: 42, runs: 1, starter: "emberback", policy: "heuristic" };
const bundle = () => ({
  format: 4,
  complete: true,
  identity: "source",
  policyVersion: 1,
  initial: "save",
  config,
  steps: [],
});

it("rejects malformed numeric and policy options before spawning a worker", async () => {
  const spawnWorker = vi.fn();
  for (const args of [
    ["--seed", "0x10"],
    ["--seed", "1e2"],
    ["--seed", "4294967296"],
    ["--runs", "0"],
    ["--runs", "21"],
    ["--runs", " 2"],
    ["--policy", "unknown"],
  ])
    await expect(runPlaythrough(args, { spawnWorker })).rejects.toThrow();
  expect(spawnWorker).not.toHaveBeenCalled();
  expect(parsePlaythroughArgs(["--seed", "0", "--runs", "20"])).toMatchObject({
    "--seed": "0",
    "--runs": "20",
  });
});
it("compares scenario values independently of JSON property order", () => {
  const reordered = Object.fromEntries(Object.entries(config).reverse());
  expect(() =>
    validatePlaythroughComparison({ ...bundle(), config: reordered }, bundle(), config),
  ).not.toThrow();
});
it("rejects candidate configurations that differ from the claimed comparison", () => {
  expect(() =>
    validatePlaythroughComparison(bundle(), { ...bundle(), config: { ...config, seed: 3 } }, config),
  ).toThrow();
  expect(() =>
    validatePlaythroughComparison({ ...bundle(), config: undefined }, { ...bundle(), config: undefined }),
  ).toThrow();
});
it("rejects blank comparison provenance and checkpoints", () => {
  for (const patch of [{ identity: "  " }, { initial: "\n" }])
    expect(() =>
      validatePlaythroughComparison({ ...bundle(), ...patch }, { ...bundle(), ...patch }, config),
    ).toThrow();
});
it("rejects obsolete or malformed replay journals before setup", () => {
  expect(() => validatePlaythroughReplay(bundle(), "source", 1)).not.toThrow();
  for (const patch of [
    { format: 3 },
    { identity: "other" },
    { policyVersion: 2 },
    { initial: null },
    { config: null },
    { steps: {} },
    { steps: Array(5001) },
  ])
    expect(() => validatePlaythroughReplay({ ...bundle(), ...patch }, "source", 1)).toThrow();
});

async function preflight(args, files = {}) {
  mkdirSync("reports", { recursive: true });
  const root = temporaryDirectory("fauna-replay-input-", path.resolve("reports"));
  for (const [file, value] of Object.entries(files)) put(root, file, value);
  const out = path.join(root, "output");
  const runJourney = vi.fn();
  const close = vi.fn();
  const modules = {
    "/src/tooling/playthrough.ts": { runJourney },
    "/src/game/content.ts": { FIRST_RUN_STARTERS: ["emberback"] },
    "/src/application/battle-policy.ts": { BATTLE_POLICY_VERSION: 1 },
    "/src/game/engine.ts": { createGame: () => ({ valid: true }) },
    "/src/game/save.ts": {
      decodeSave: (value) => {
        if (value === "broken") throw new Error("Invalid save");
      },
    },
  };
  const result = runPlaythroughWorker([...args(root), "--out", out], {
    readIdentity: async () => "source",
    createServer: async () => ({ ssrLoadModule: async (id) => modules[id], close }),
  });
  await expect(result).rejects.toThrow();
  expect(runJourney).not.toHaveBeenCalled();
  expect(existsSync(out)).toBe(false);
  expect(close).toHaveBeenCalledOnce();
}
it("rejects invalid replays without reserving or writing output", async () => {
  await preflight((root) => ["--replay", path.join(root, "replay.json")], {
    "replay.json": JSON.stringify({ ...bundle(), identity: "old" }),
  });
});
it("decodes supplied saves before creating output evidence", async () => {
  await preflight((root) => ["--save", path.join(root, "save.json")], { "save.json": "broken" });
});
it("rejects mismatched and unreadable baselines before running a journey or writing output", async () => {
  await preflight((root) => ["--compare", path.join(root, "baseline.json")], {
    "baseline.json": JSON.stringify({ ...bundle(), complete: false }),
  });
  await preflight((root) => ["--compare", path.join(root, "missing.json")]);
});
it("retains an incomplete summary and journal when source changes during a journey", async () => {
  mkdirSync("reports", { recursive: true });
  const root = temporaryDirectory("fauna-replay-drift-", path.resolve("reports"));
  const out = path.join(root, "output");
  const close = vi.fn();
  const modules = {
    "/src/tooling/playthrough.ts": { runJourney: async () => bundle() },
    "/src/game/content.ts": { FIRST_RUN_STARTERS: ["emberback"] },
    "/src/application/battle-policy.ts": { BATTLE_POLICY_VERSION: 1 },
    "/src/game/engine.ts": { createGame: () => ({ valid: true }) },
    "/src/game/save.ts": { decodeSave: () => {} },
  };
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await expect(
      runPlaythroughWorker(["--out", out], {
        readIdentity: vi.fn().mockResolvedValueOnce("source").mockResolvedValueOnce("changed"),
        createServer: async () => ({ ssrLoadModule: async (id) => modules[id], close }),
      }),
    ).rejects.toThrow("source changed");
  } finally {
    log.mockRestore();
  }
  expect(JSON.parse(readFileSync(path.join(out, "summary.json"), "utf8")).complete).toBe(false);
  expect(existsSync(path.join(out, "journey.json"))).toBe(false);
  expect(readdirSync(out).some((name) => name.startsWith("journal-"))).toBe(true);
  expect(existsSync(path.join(out, ".playthrough-writing"))).toBe(false);
  expect(close).toHaveBeenCalledOnce();
});
it("isolates shrink candidates and retained evidence from mutating replay callbacks", async () => {
  const actions = [{ kind: "battle", command: { type: "endTurn" } }, { kind: "reload" }];
  const original = structuredClone(actions);
  const result = await shrinkTrace(actions, "failure", async (candidate) => {
    candidate[0].kind = "mutated";
    return { valid: true, failure: "failure" };
  });
  expect(actions).toEqual(original);
  expect(result.actions).toEqual([{ kind: "reload" }]);
});
it("closes the server and saves evidence even when browser shutdown fails", async () => {
  const calls = [];
  await expect(
    finishInteractionRun(
      async () => {
        calls.push("browser");
        throw new Error("close failed");
      },
      async () => {
        calls.push("server");
      },
      async () => {
        calls.push("report");
      },
    ),
  ).rejects.toThrow("close failed");
  expect(calls).toEqual(["browser", "server", "report"]);
});
it("saves evidence even when server shutdown fails", async () => {
  const save = vi.fn();
  await expect(
    finishInteractionRun(
      async () => {},
      async () => {
        throw new Error("server failed");
      },
      save,
    ),
  ).rejects.toThrow("server failed");
  expect(save).toHaveBeenCalledOnce();
});

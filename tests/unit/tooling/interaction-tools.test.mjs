import { it, expect } from "vitest";
import {
  parseInteractionArgs,
  reserveInteractionReport,
  shrinkTrace,
  validateInteractionReport,
} from "../../../scripts/lib/interaction-replay.mjs";
import { routeArguments, routes } from "../../../scripts/performance/routes.mjs";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
it("shrinks only fresh valid replays of the same failure within its attempt budget", async () => {
  const trace = [{ kind: "collection" }, { kind: "settings" }, { kind: "battle" }, { kind: "reload" }];
  const replay = async (actions) => ({
    valid: actions.some((a) => a.kind === "battle"),
    failure: actions.some((a) => a.kind === "reload") ? "original" : "different",
  });
  const result = await shrinkTrace(trace, "original", replay);
  expect(result.actions).toEqual([{ kind: "battle" }, { kind: "reload" }]);
  const bounded = await shrinkTrace(trace, "original", replay, { attempts: 1 });
  expect(bounded.attempts).toBe(1);
  expect(bounded.bounded).toBe(true);
  const invalid = await shrinkTrace(trace, "original", async () => ({ valid: false, failure: "original" }));
  expect(invalid.actions).toEqual(trace);
});
it("rejects obsolete, malformed, and unbounded interaction traces", () => {
  const report = {
    format: 1,
    seed: 42,
    identity: "test",
    initial: "checkpoint",
    complete: true,
    actions: [{ kind: "reload", checkpointHash: "a".repeat(64) }],
  };
  expect(validateInteractionReport(report)).toBe(report);
  for (const change of [
    { format: 0 },
    { seed: -1 },
    { actions: [] },
    { actions: Array(101).fill({ kind: "reload" }) },
    { actions: [{ kind: "battle" }] },
    { actions: [{ kind: "constructor" }] },
  ])
    expect(() => validateInteractionReport({ ...report, ...change })).toThrow();
});
it("named browser routes select existing files and reject arbitrary forwarding", () => {
  for (const [name, route] of Object.entries(routes)) {
    expect(route.files.every((file) => existsSync(file))).toBe(true);
    expect(routeArguments(name, ["--list"])).toContain(route.grep);
  }
  expect(() => routeArguments("constructor")).toThrow();
  expect(() => routeArguments("battle", ["--grep", "anything"])).toThrow();
});

it("rejects malformed and duplicate interaction flags", () => {
  for (const args of [
    ["xxseed", "1"],
    ["--seed", "1", "--seed", "2"],
    ["--out", "--family", "battle"],
  ])
    expect(() => parseInteractionArgs(args)).toThrow("Invalid or duplicate");
});

it("rejects scenario overrides during an exact replay", () => {
  for (const args of [
    ["--seed", "1"],
    ["--steps", "2"],
    ["--family", "battle"],
  ])
    expect(() => parseInteractionArgs(["--replay", "report.json", ...args])).toThrow("Replay cannot");
  expect(parseInteractionArgs(["--replay", "report.json", "--out", "reports/new"]).replay).toBe(
    "report.json",
  );
});

it("rejects malformed numeric seed and step values", () => {
  for (const value of ["", "0x10", "1e2", " 2", "1.0"])
    expect(() => parseInteractionArgs(["--seed", value])).toThrow();
  expect(parseInteractionArgs(["--seed", "0", "--steps", "100"]).steps).toBe(100);
});

it("preserves existing reports and admits only one concurrent writer", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-interactions-"));
  try {
    const report = { complete: false, failure: "interrupted" };
    const attempts = await Promise.allSettled([
      reserveInteractionReport(directory, report),
      reserveInteractionReport(directory, report),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect(JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"))).toEqual(report);
    await writeFile(path.join(directory, "other-evidence.json"), "retained");
    await expect(reserveInteractionReport(directory, report)).rejects.toThrow("existing evidence");
    expect(await readFile(path.join(directory, "other-evidence.json"), "utf8")).toBe("retained");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("requires recorded hashes for exact replay while allowing explicit reduction candidates", () => {
  const hash = "a".repeat(64);
  const report = {
    format: 1,
    seed: 42,
    identity: "source",
    initial: "checkpoint",
    complete: true,
    actions: [
      { kind: "reload", checkpointHash: hash },
      { kind: "settings", checkpointHash: hash },
    ],
  };
  expect(validateInteractionReport(report)).toBe(report);
  expect(() => validateInteractionReport({ ...report, actions: [{ kind: "reload" }] })).toThrow(
    "checkpoint hash",
  );
  expect(() =>
    validateInteractionReport({ ...report, actions: [{ kind: "reload", checkpointHash: "bad" }] }),
  ).toThrow("checkpoint hash");
  const failed = {
    ...report,
    complete: false,
    actions: [{ kind: "reload", checkpointHash: hash }, { kind: "settings" }],
  };
  expect(validateInteractionReport(failed)).toBe(failed);
  expect(
    validateInteractionReport({ ...failed, checkpointMode: "recompute", actions: [{ kind: "reload" }] })
      .checkpointMode,
  ).toBe("recompute");
  expect(() =>
    validateInteractionReport({ ...failed, actions: [{ kind: "reload" }, { kind: "settings" }] }),
  ).toThrow("checkpoint hash");
});

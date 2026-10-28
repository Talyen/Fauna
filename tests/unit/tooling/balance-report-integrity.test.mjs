import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compareBalance } from "../../../scripts/balance/paired-balance.mjs";
import { experimentConfigs, main, parseBalanceSeeds } from "../../../scripts/balance/balance-compare.mjs";
import { main as findingsMain } from "../../../scripts/balance/balance-findings.mjs";
import { rankBalanceFindings } from "../../../scripts/balance/findings.mjs";
import { identity, reportDirectory } from "../../../scripts/lib/tool-runtime.mjs";

const metrics = { win: 1, turns: 4, health: 10, encounter: 1, swaps: 0, currency: -1, xp: 3 };
const report = () => ({
  format: 1,
  kind: "career",
  complete: true,
  identity: "source",
  settings: { policy: 1, budgets: { turns: 100, actions: 5000 } },
  failures: [],
  cases: [{ key: "mossguard-0", complete: true, baseHash: "base", initialHash: "initial", metrics }],
});
const directories = [];
const originalExitCode = process.exitCode;
afterEach(async () => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function outputDirectory() {
  const parent = await reportDirectory("reports/balance-integrity-tests");
  const directory = await mkdtemp(path.join(parent, "case-"));
  directories.push(directory);
  return directory;
}

it("compares settings by values while preserving array order and detecting changed budgets", () => {
  const baseline = report();
  const reordered = { ...baseline, settings: { budgets: { actions: 5000, turns: 100 }, policy: 1 } };
  expect(compareBalance(baseline, reordered).pairs).toHaveLength(1);
  expect(() =>
    compareBalance(baseline, { ...reordered, settings: { ...reordered.settings, policy: 2 } }),
  ).toThrow("incompatible");
  expect(() =>
    compareBalance(
      { ...baseline, settings: { order: [1, 2] } },
      { ...baseline, settings: { order: [2, 1] } },
    ),
  ).toThrow("incompatible");
});

it("requires meaningful source, case and checkpoint identities in imported reports", () => {
  const valid = report();
  expect(() => compareBalance(null, valid)).toThrow("incompatible");
  expect(() => compareBalance({ ...valid, identity: "   " }, valid)).toThrow("incompatible");
  for (const field of ["key", "baseHash", "initialHash"]) {
    const invalid = { ...valid, cases: [{ ...valid.cases[0], [field]: " \t " }] };
    expect(() => compareBalance(invalid, invalid)).toThrow("Incomplete/incompatible pair");
  }
});

it("rejects duplicate, out-of-range and excessive seed lists at the parser boundary", () => {
  expect(parseBalanceSeeds("0,4294967295")).toEqual([0, 4294967295]);
  for (const seeds of ["1,01", "4294967296", "9007199254740993", "", "0,1,2,3,4,5,6,7,8,9,10"])
    expect(() => parseBalanceSeeds(seeds)).toThrow("Invalid or excessive");
});

it("rejects ambiguous experiment loadout IDs before worker launch", () => {
  const checkpoint = JSON.stringify({ phase: "battle", rng: 1, team: [{ species: "mossguard" }] });
  const baseline = { talents: [], boons: [] };
  expect(experimentConfigs(checkpoint, { baseline, treatment: baseline })).toHaveLength(2);
  for (const ids of [["cornucopia", "cornucopia"], [" "], [" cornucopia"], ["cornucopia "]])
    for (const field of ["talents", "boons"])
      expect(() =>
        experimentConfigs(checkpoint, { baseline, treatment: { ...baseline, [field]: ids } }),
      ).toThrow("ID arrays");
});

it("invalid suites neither prune retained reports nor create output", async () => {
  const parent = await outputDirectory();
  const out = path.join(parent, "output");
  const pruneReports = vi.fn();
  const runCase = vi.fn();
  for (const args of [
    ["run", "--seeds", "4294967296"],
    ["run", "--starters", "mossguard,"],
    ["run", "--checkpoint", "missing"],
    ["experiment", "--checkpoint", "missing", "--loadouts", "missing"],
  ])
    await expect(main([...args, "--out", out], { pruneReports, runCase })).rejects.toThrow();
  expect(pruneReports).not.toHaveBeenCalled();
  expect(runCase).not.toHaveBeenCalled();
  expect(await readdir(parent)).toEqual([]);
});

async function runFixture({ cases = [{}], sourceIdentity = async () => "source" } = {}) {
  const out = await outputDirectory();
  vi.spyOn(console, "log").mockImplementation(() => {});
  let index = 0;
  await main(["run", "--starters", "mossguard", "--seeds", cases.map((_, i) => i).join(","), "--out", out], {
    pruneReports: async () => {},
    sourceIdentity,
    runCase: async (_input, output) => {
      const result = {
        identity: "source",
        complete: true,
        settings: { policy: 1, turns: 100 },
        base: "base",
        initial: "initial",
        metrics,
        replay: { steps: [{ accepted: true, command: { type: "draft", species: "mossguard" } }] },
        ...cases[index++],
      };
      await writeFile(output, JSON.stringify(result));
      await writeFile(`${output}.journal.jsonl`, "retained journal\n");
    },
  });
  return { out, result: JSON.parse(await readFile(path.join(out, "report.json"), "utf8")) };
}

it("refuses mixed worker settings and retains the rejected case journal", async () => {
  const { out, result } = await runFixture({ cases: [{}, { settings: { policy: 2, turns: 100 } }] });
  expect(result.complete).toBe(false);
  expect(result.settings).toEqual({ policy: 1, turns: 100 });
  expect(result.failures[0].reason).toContain("settings differ");
  expect(await readFile(path.join(out, "case-1.json.journal.jsonl"), "utf8")).toContain("retained journal");
});

it("accepts semantically identical worker settings and compacts valid completed evidence", async () => {
  const { out, result } = await runFixture({ cases: [{}, { settings: { turns: 100, policy: 1 } }] });
  expect(result.complete).toBe(true);
  expect(result.cases).toHaveLength(2);
  expect((await readdir(out)).some((name) => name.endsWith("journal.jsonl"))).toBe(false);
});

it("retains malformed completed metrics instead of deleting the diagnosis journal", async () => {
  const { out, result } = await runFixture({ cases: [{ metrics: { ...metrics, win: 2 } }] });
  expect(result.complete).toBe(false);
  expect(result.cases).toEqual([]);
  expect(result.failures[0].reason).toContain("Invalid metric");
  const saved = JSON.parse(await readFile(path.join(out, "case-0.json"), "utf8"));
  expect(saved.replay.steps).toHaveLength(1);
  expect(saved.metrics.win).toBe(2);
  expect(await readFile(path.join(out, "case-0.json.journal.jsonl"), "utf8")).toContain("retained journal");
});

it("does not relabel a worker's different source identity as the suite source", async () => {
  const { out, result } = await runFixture({ cases: [{ identity: "different-source" }] });
  expect(result.complete).toBe(false);
  expect(result.failures[0].reason).toContain("Source identity changed");
  expect(JSON.parse(await readFile(path.join(out, "case-0.json"), "utf8")).identity).toBe("different-source");
  expect(await readFile(path.join(out, "case-0.json.journal.jsonl"), "utf8")).toContain("retained journal");
});

it("preserves the just-finished case when the suite source changes during its worker", async () => {
  const sourceIdentity = vi.fn().mockResolvedValueOnce("source").mockResolvedValue("changed");
  const { out, result } = await runFixture({ sourceIdentity });
  expect(result.complete).toBe(false);
  expect(result.cases).toEqual([]);
  expect(await readFile(path.join(out, "case-0.json.journal.jsonl"), "utf8")).toContain("retained journal");
});

it("marks source drift between cases and suite completion as incomplete", async () => {
  const sourceIdentity = vi
    .fn()
    .mockResolvedValueOnce("source")
    .mockResolvedValueOnce("source")
    .mockResolvedValue("changed");
  const { result } = await runFixture({ sourceIdentity });
  expect(result.complete).toBe(false);
  expect(result.failures).toContainEqual({
    key: "source-identity",
    reason: "Source identity changed during the suite.",
  });
});

it("fingerprints runner, platform and dependency changes as well as gameplay", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fauna-identity-"));
  directories.push(root);
  const files = [
    "src/game/game.ts",
    "src/application/session.ts",
    "src/platform/ports.ts",
    "src/tooling/balance.ts",
    "scripts/balance/run.mjs",
    "scripts/lib/tool-runtime.mjs",
    "scripts/lib/worker.mjs",
    "package.json",
    "package-lock.json",
  ];
  for (const name of files) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), "original");
  }
  const original = await identity({ root });
  for (const name of files) {
    await writeFile(path.join(root, name), "changed");
    expect(await identity({ root })).not.toBe(original);
    await writeFile(path.join(root, name), "original");
  }
  expect(await identity({ root })).toBe(original);
});

it("standalone findings preserve existing output and release the writer after success", async () => {
  const directory = await outputDirectory();
  const input = path.join(directory, "report.json");
  await writeFile(input, JSON.stringify(report()));
  const out = await reportDirectory(path.join(directory, "findings"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  await findingsMain([input, out]);
  const original = await readFile(path.join(out, "findings.json"), "utf8");
  await expect(findingsMain([input, out])).rejects.toThrow("existing balance evidence");
  expect(await readFile(path.join(out, "findings.json"), "utf8")).toBe(original);
  expect(await readdir(out)).not.toContain(".balance-writing");
});

it("keeps perfect paired success rates tentative despite zero observed variance", () => {
  const pairs = Array.from({ length: 5 }, (_, i) => ({
    key: `seed-${i}`,
    baseline: { ...metrics, win: 0 },
    treatment: metrics,
  }));
  const findings = rankBalanceFindings({ format: 1, kind: "comparison", pairs }).findings;
  expect(findings.find((finding) => finding.id === "paired-win")).toMatchObject({ severity: "watch" });
  expect(findings.find((finding) => finding.id === "paired-win").detail).toContain("Extreme");
});

import { temporaryDirectory } from "../../support/tooling.mjs";
import { it, expect } from "vitest";
import { mkdir, writeFile, readFile, readdir, access, cp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pruneBalanceReports, sealBalanceReport } from "../../../scripts/balance/report-retention.mjs";

const day = 86_400_000;
async function bundle(root, name, complete, finished) {
  const directory = path.join(root, "reports/balance", name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "report.json"), JSON.stringify({ name, complete }));
  await sealBalanceReport(directory, complete, { root, now: finished });
  return directory;
}

async function recoveries(quarantine) {
  return Promise.all(
    (await readdir(quarantine)).map(async (name) => {
      const entry = path.join(quarantine, name);
      return { entry, ...JSON.parse(await readFile(path.join(entry, "recovery.json"), "utf8")) };
    }),
  );
}

it("keeps expiry effective after a generated report is archived with a retired worktree", async () => {
  const root = temporaryDirectory("fauna-retention-");
  const now = Date.now();

  execFileSync("git", ["init", "-q", root]);
  const original = await bundle(root, "passed", true, now - 2 * day);
  const archived = path.join(root, ".git/fauna-worktree-archives/task/files/reports/balance/passed");
  await cp(original, archived, { recursive: true, preserveTimestamps: true });
  await bundle(root, "latest", true, now);
  const result = await pruneBalanceReports(root, { now, includeArchives: true });
  await expect(access(original)).rejects.toThrow();
  await expect(access(archived)).rejects.toThrow();
  const retained = await recoveries(result.quarantine);
  expect(retained.map((item) => item.original).sort()).toEqual([original, archived].sort());
  for (const item of retained)
    expect(JSON.parse(await readFile(path.join(item.entry, "bundle/report.json"), "utf8"))).toEqual({
      name: path.basename(item.original),
      complete: item.complete,
    });
});

it("quarantines old records without losing unique failure evidence", async () => {
  const root = temporaryDirectory("fauna-retention-");
  const now = Date.now();

  const passed = await bundle(root, "passed", true, now - 2 * day);
  const recentFailure = await bundle(root, "failure", false, now - 2 * day);
  const oldFailure = await bundle(root, "old-failure", false, now - 4 * day);
  await bundle(root, "latest", true, now);
  const result = await pruneBalanceReports(root, { now });
  await expect(access(passed)).rejects.toThrow();
  await expect(access(oldFailure)).rejects.toThrow();
  await expect(access(recentFailure)).resolves.toBeUndefined();
  const retained = await recoveries(result.quarantine);
  expect(retained.map((item) => item.original).sort()).toEqual([passed, oldFailure].sort());
  for (const item of retained) {
    expect(item.permanentDeletionApproved).toBe(false);
    expect(JSON.parse(await readFile(path.join(item.entry, "bundle/report.json"), "utf8"))).toEqual({
      name: path.basename(item.original),
      complete: item.complete,
    });
  }
  await expect(pruneBalanceReports(root, { now, budget: 1 })).rejects.toThrow("budget");
  expect((await recoveries(result.quarantine)).length).toBe(2);
});

it("preserves legacy records, changed data and explicit pins", async () => {
  const root = temporaryDirectory("fauna-retention-");
  const now = Date.now();

  const changed = await bundle(root, "changed", true, now - 4 * day);
  await writeFile(path.join(changed, "report.json"), "changed result");
  const pinned = await bundle(root, "pinned", true, now - 4 * day);
  await writeFile(path.join(pinned, ".retention-keep"), "retained investigation");
  const legacy = path.join(root, "reports/balance/legacy");
  await mkdir(legacy);
  await writeFile(path.join(legacy, "unique.txt"), "preserved");
  await pruneBalanceReports(root, { now });
  for (const directory of [changed, pinned, legacy]) await expect(access(directory)).resolves.toBeUndefined();
});

it("refuses another capture when fresh diagnostics fill the budget", async () => {
  const root = temporaryDirectory("fauna-retention-");
  const now = Date.now();

  const fresh = await bundle(root, "fresh", false, now);
  await expect(pruneBalanceReports(root, { now, budget: 1 })).rejects.toThrow("budget");
  await expect(access(fresh)).resolves.toBeUndefined();
});

it("dry-runs age and size selection while retaining latest success, latest failure and pins", async () => {
  const root = temporaryDirectory("fauna-retention-dry-");
  const now = Date.now();

  const old = await bundle(root, "old", true, now - 3 * day);
  const pass = await bundle(root, "latest-pass", true, now - 2 * day);
  const fail = await bundle(root, "latest-fail", false, now - 4 * day);
  const result = await pruneBalanceReports(root, { now, dryRun: true, budget: 1 });
  expect(result.moved.map((item) => item.path)).toEqual([old]);
  expect(result.reclaimedBytes).toBe(0);
  for (const directory of [old, pass, fail]) await expect(access(directory)).resolves.toBeUndefined();
});

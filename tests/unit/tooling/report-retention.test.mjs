import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, access, rm, cp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pruneBalanceReports, sealBalanceReport } from "../../../scripts/balance/report-retention.mjs";

const day = 86_400_000;
async function bundle(root, name, complete, finished) {
  const directory = path.join(root, "reports/balance", name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "report.json"), "{}");
  await sealBalanceReport(directory, complete, { root, now: finished });
  return directory;
}

it("keeps expiry effective after a generated report is archived with a retired worktree", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fauna-retention-"));
  const now = Date.now();
  try {
    execFileSync("git", ["init", "-q", root]);
    const original = await bundle(root, "passed", true, now - 2 * day);
    const archived = path.join(root, ".git/fauna-worktree-archives/task/files/reports/balance/passed");
    await cp(original, archived, { recursive: true, preserveTimestamps: true });
    await pruneBalanceReports(root, { now, includeArchives: true });
    await expect(access(original)).rejects.toThrow();
    await expect(access(archived)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("expires successful records sooner while retaining recent failure diagnostics", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fauna-retention-"));
  const now = Date.now();
  try {
    const passed = await bundle(root, "passed", true, now - 2 * day);
    const recentFailure = await bundle(root, "failure", false, now - 2 * day);
    const oldFailure = await bundle(root, "old-failure", false, now - 4 * day);
    await pruneBalanceReports(root, { now });
    await expect(access(passed)).rejects.toThrow();
    await expect(access(oldFailure)).rejects.toThrow();
    await expect(access(recentFailure)).resolves.toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("preserves legacy records, changed data and explicit pins", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fauna-retention-"));
  const now = Date.now();
  try {
    const changed = await bundle(root, "changed", true, now - 4 * day);
    await writeFile(path.join(changed, "report.json"), "changed result");
    const pinned = await bundle(root, "pinned", true, now - 4 * day);
    await writeFile(path.join(pinned, ".retention-keep"), "retained investigation");
    const legacy = path.join(root, "reports/balance/legacy");
    await mkdir(legacy);
    await writeFile(path.join(legacy, "unique.txt"), "preserved");
    await pruneBalanceReports(root, { now });
    for (const directory of [changed, pinned, legacy])
      await expect(access(directory)).resolves.toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("refuses another capture when fresh diagnostics fill the budget", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fauna-retention-"));
  const now = Date.now();
  try {
    const fresh = await bundle(root, "fresh", false, now);
    await expect(pruneBalanceReports(root, { now, budget: 1 })).rejects.toThrow("budget");
    await expect(access(fresh)).resolves.toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

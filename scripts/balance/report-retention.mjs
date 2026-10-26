import { lstat, readdir, readFile, writeFile, mkdir, mkdtemp, rename } from "node:fs/promises";
import path from "node:path";
import { git } from "../lib/git.mjs";

const receiptName = ".balance-retention.json";
const day = 86_400_000;
const generatedName =
  /^(?:case-\d+(?:-config)?\.json(?:\.journal\.jsonl)?|report\.json|comparison\.json|findings\.(?:json|md))$/u;

async function quarantineBytes(directory) {
  let bytes = 0,
    entries = 0;
  async function visit(file) {
    if (++entries > 100_000)
      throw new Error("Quarantine inventory is too large; review it before another capture.");
    const item = await lstat(file);
    if (item.isSymbolicLink())
      throw new Error("Quarantine contains a symlink; review it before another capture.");
    if (item.isDirectory()) {
      for (const name of await readdir(file)) await visit(path.join(file, name));
    } else if (item.isFile()) bytes += item.size;
    else throw new Error("Quarantine contains an unexpected file type; review required.");
  }
  try {
    await visit(directory);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return bytes;
}

export async function sealBalanceReport(directory, complete, { root, now = Date.now() } = {}) {
  if (path.dirname(directory) !== path.join(root, "reports/balance")) return;
  const files = [];
  for (const name of await readdir(directory)) {
    if (!generatedName.test(name)) return; // User additions make the bundle caller-owned.
    const item = await lstat(path.join(directory, name));
    if (!item.isFile() || item.isSymbolicLink()) return;
    files.push({ name, bytes: item.size, modified: Math.trunc(item.mtimeMs) });
  }
  await writeFile(
    path.join(directory, receiptName),
    JSON.stringify({
      schema: 1,
      kind: "fauna-generated-balance",
      complete,
      finished: now,
      files,
    }),
    { flag: "wx" },
  );
}

export async function pruneBalanceReports(
  root,
  { now = Date.now(), budget = 1024 ** 3, includeArchives = false, dryRun = false } = {},
) {
  const roots = [root];
  let quarantine = path.join(root, "reports/balance-quarantine");
  if (includeArchives) {
    const common = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
    quarantine = path.join(common, "fauna-balance-quarantine");
    const archives = path.join(common, "fauna-worktree-archives");
    const info = await lstat(archives).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (info?.isDirectory() && !info.isSymbolicLink()) {
      for (const entry of await readdir(archives, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const files = path.join(archives, entry.name, "files");
        const item = await lstat(files).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (item?.isDirectory() && !item.isSymbolicLink()) roots.push(files);
      }
    }
  }
  const bundles = [];
  for (const collection of roots) {
    const base = path.join(collection, "reports/balance");
    let entries;
    try {
      for (const directory of [path.join(collection, "reports"), base]) {
        const item = await lstat(directory);
        if (!item.isDirectory() || item.isSymbolicLink())
          throw new Error("Balance report root cannot be a symlink.");
      }
      entries = await readdir(base, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const directory = path.join(base, entry.name);
      try {
        const marker = path.join(directory, receiptName);
        const receipt = await lstat(marker);
        if (receipt.isSymbolicLink() || !receipt.isFile()) continue;
        const record = JSON.parse(await readFile(marker, "utf8"));
        if (
          !record ||
          typeof record !== "object" ||
          record.schema !== 1 ||
          record.kind !== "fauna-generated-balance" ||
          typeof record.complete !== "boolean" ||
          !Number.isFinite(record.finished) ||
          record.finished < 0 ||
          record.finished > now ||
          !Array.isArray(record.files) ||
          !record.files.length
        )
          continue;
        const expected = new Set(record.files.map((file) => file.name));
        const names = await readdir(directory);
        if (
          expected.size !== record.files.length ||
          names.length !== expected.size + 1 ||
          names.some((name) => name !== receiptName && !expected.has(name))
        )
          continue;
        let bytes = 0,
          unchanged = true;
        for (const file of record.files) {
          if (typeof file.name !== "string" || !generatedName.test(file.name)) {
            unchanged = false;
            break;
          }
          const item = await lstat(path.join(directory, file.name));
          if (
            !item.isFile() ||
            item.isSymbolicLink() ||
            item.size !== file.bytes ||
            Math.abs(item.mtimeMs - file.modified) >= 2
          ) {
            unchanged = false;
            break;
          }
          bytes += item.size;
        }
        if (unchanged)
          bundles.push({
            ...record,
            directory,
            bytes,
            inode: (await lstat(directory)).ino,
            receipt: [receipt.ino, receipt.size, receipt.mtimeMs],
          });
      } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes(error.code) && !(error instanceof SyntaxError)) throw error;
      }
    }
  }
  const retained = bundles.reduce((sum, item) => sum + item.bytes, 0) + (await quarantineBytes(quarantine));
  const moved = [];
  const latest = new Set(
    [true, false]
      .map(
        (complete) =>
          bundles.filter((bundle) => bundle.complete === complete).sort((a, b) => b.finished - a.finished)[0]
            ?.directory,
      )
      .filter(Boolean),
  );
  for (const bundle of bundles.sort((a, b) => a.finished - b.finished)) {
    if (latest.has(bundle.directory)) continue;
    const age = now - bundle.finished;
    const expired = age >= (bundle.complete ? day : 3 * day);
    if (!expired && !(retained > budget && age >= day)) continue;
    // Added pins, changed bytes and replaced directories invalidate selection.
    const current = await lstat(bundle.directory).catch(() => null);
    const receipt = await lstat(path.join(bundle.directory, receiptName)).catch(() => null);
    const names = await readdir(bundle.directory).catch(() => []);
    if (
      !receipt?.isFile() ||
      receipt.isSymbolicLink() ||
      JSON.stringify([receipt.ino, receipt.size, receipt.mtimeMs]) !== JSON.stringify(bundle.receipt) ||
      !current?.isDirectory() ||
      current.isSymbolicLink() ||
      current.ino !== bundle.inode ||
      names.length !== bundle.files.length + 1 ||
      names.some((name) => name !== receiptName && !bundle.files.some((file) => file.name === name))
    )
      continue;
    const checks = await Promise.all(
      bundle.files.map(async (file) => {
        const item = await lstat(path.join(bundle.directory, file.name)).catch(() => null);
        return (
          item?.isFile() &&
          !item.isSymbolicLink() &&
          item.size === file.bytes &&
          Math.abs(item.mtimeMs - file.modified) < 2
        );
      }),
    );
    if (checks.some((matches) => !matches)) continue;
    if (dryRun) {
      moved.push({
        path: bundle.directory,
        bytes: bundle.bytes,
        recovery: "Review only; no bytes moved or deleted",
      });
      continue;
    }
    await mkdir(quarantine, { recursive: true });
    const destination = await lstat(quarantine);
    if (!destination.isDirectory() || destination.isSymbolicLink())
      throw new Error("Unsafe quarantine directory.");
    const entry = await mkdtemp(path.join(quarantine, "retained-"));
    await writeFile(
      path.join(entry, "recovery.json"),
      JSON.stringify({
        schema: 1,
        original: bundle.directory,
        quarantinedAt: now,
        complete: bundle.complete,
        reason: expired ? "age policy" : "size budget",
        permanentDeletionApproved: false,
      }),
      { flag: "wx" },
    );
    // Same-filesystem rename retains every byte and never empties quarantine.
    // If it fails, the original bundle remains and the capture stops.
    await rename(bundle.directory, path.join(entry, "bundle"));
    moved.push(entry);
  }
  if (!dryRun && retained >= budget)
    throw new Error(
      "Retained and quarantined balance evidence fills the 1 GiB budget. Review an exact deletion batch before another capture; no diagnostics were permanently removed.",
    );
  return { quarantine, moved, retainedBytes: retained, dryRun, reclaimedBytes: 0 };
}

import { lstat, readdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { git } from "../lib/git.mjs";

const receiptName = ".balance-retention.json";
const day = 86_400_000;
const generatedName =
  /^(?:case-\d+(?:-config)?\.json(?:\.journal\.jsonl)?|report\.json|comparison\.json|findings\.(?:json|md))$/u;

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
  { now = Date.now(), budget = 1024 ** 3, includeArchives = false } = {},
) {
  const roots = [root];
  if (includeArchives) {
    const common = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
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
            Math.trunc(item.mtimeMs) !== file.modified
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
  let retained = bundles.reduce((sum, item) => sum + item.bytes, 0);
  for (const bundle of bundles.sort((a, b) => a.finished - b.finished)) {
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
          Math.trunc(item.mtimeMs) === file.modified
        );
      }),
    );
    if (checks.some((matches) => !matches)) continue;
    await rm(bundle.directory, { recursive: true, force: true });
    retained -= bundle.bytes;
  }
  if (retained >= budget)
    throw new Error(
      "Fresh balance evidence fills the 1 GiB budget. Review retained reports before another capture; nothing fresh was removed.",
    );
}

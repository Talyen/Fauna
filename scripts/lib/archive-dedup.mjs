import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  copyFileSync,
  chmodSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  utimesSync,
} from "node:fs";
import path from "node:path";
import { nativeClones } from "./worktree-storage.mjs";

const minimum = 64 * 1024;
// Retirement holds the integration lock; bound extra clone verification work.
const cloneBudget = 64 * 1024 * 1024;
const cloneLimit = 128;
export function archiveFileHash(file) {
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const digest = createHash("sha256"),
      buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (!count) return digest.digest("hex");
      digest.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(fd);
  }
}

// Only the new, unpublished archive is changed. Every candidate is a copy-on-write
// clone, independently verified against the recorded bytes; hard links are never used.
export function deduplicateArchive(archives, archive, records, { cloneFile } = {}) {
  const previous = new Map();
  for (const entry of readdirSync(archives, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !entry.name.startsWith("task-")) continue;
    const root = path.join(archives, entry.name);
    if (root === archive) continue;
    try {
      const manifest = path.join(root, "manifest.json");
      if (!lstatSync(manifest).isFile() || lstatSync(manifest).isSymbolicLink()) continue;
      const data = JSON.parse(readFileSync(manifest, "utf8"));
      if (!Array.isArray(data.dedup)) continue;
      for (const item of data.dedup) {
        if (
          !item ||
          !/^[a-f0-9]{64}$/.test(item.hash) ||
          !Number.isSafeInteger(item.size) ||
          item.size < minimum ||
          typeof item.path !== "string" ||
          !item.path.startsWith("files/") ||
          item.path.split("/").some((part) => !part || part === "." || part === "..")
        )
          continue;
        const file = path.join(root, item.path);
        const matches = previous.get(item.hash) ?? [];
        matches.push({ file, size: item.size });
        previous.set(item.hash, matches);
      }
    } catch {
      /* Unknown archives are not modified. */
    }
  }
  const plans = [];
  let plannedBytes = 0;
  for (const record of records) {
    if (plans.length >= cloneLimit || plannedBytes + record.size > cloneBudget) continue;
    const candidates = previous.get(record.hash) ?? [];
    const target = path.join(archive, record.path);
    for (const candidate of candidates) {
      try {
        const info = lstatSync(candidate.file);
        if (
          !info.isFile() ||
          info.isSymbolicLink() ||
          info.size !== record.size ||
          realpathSync(candidate.file) !== candidate.file
        )
          continue;
        plans.push({ from: candidate.file, to: `${target}.fauna-clone-${randomUUID()}`, target, record });
        plannedBytes += record.size;
        break;
      } catch {
        /* A retired or changed candidate is not a source. */
      }
    }
  }
  let results;
  if (!cloneFile && process.platform === "darwin") {
    try {
      results = nativeClones(plans);
    } catch {
      results = plans.map(() => "clone failed");
    }
  }
  let clonedBytes = 0;
  for (const [index, plan] of plans.entries()) {
    let owned;
    try {
      if (cloneFile) cloneFile(plan.from, plan.to);
      else if (results) {
        if (results[index]) continue;
      } else copyFileSync(plan.from, plan.to, constants.COPYFILE_FICLONE_FORCE | constants.COPYFILE_EXCL);
      const target = lstatSync(plan.target);
      const clone = lstatSync(plan.to);
      owned = clone.ino;
      if (
        !target.isFile() ||
        target.isSymbolicLink() ||
        !clone.isFile() ||
        clone.isSymbolicLink() ||
        target.size !== plan.record.size ||
        target.ino !== plan.record.ino ||
        target.mtimeMs !== plan.record.mtimeMs ||
        target.ctimeMs !== plan.record.ctimeMs ||
        clone.size !== plan.record.size ||
        archiveFileHash(plan.to) !== plan.record.hash
      )
        continue;
      chmodSync(plan.to, target.mode & 0o777);
      utimesSync(plan.to, target.atime, target.mtime);
      const current = lstatSync(plan.target);
      if (
        current.ino !== target.ino ||
        current.size !== target.size ||
        current.mtimeMs !== target.mtimeMs ||
        current.ctimeMs !== target.ctimeMs
      )
        continue;
      renameSync(plan.to, plan.target);
      clonedBytes += plan.record.size;
    } catch {
      /* Keep the original verified archive copy when cloning is unavailable. */
    } finally {
      const current = lstatSync(plan.to, { throwIfNoEntry: false });
      if (owned !== undefined && current?.ino === owned) rmSync(plan.to, { force: true });
    }
  }
  return { clonedBytes, candidates: plans.length };
}

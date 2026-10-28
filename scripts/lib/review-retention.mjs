import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { archiveFileHash } from "./archive-dedup.mjs";

const DAY = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const commit = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const info = (file) => {
  const s = lstatSync(file, { bigint: true });
  if (!s.isFile() || s.isSymbolicLink()) throw new Error("Unsafe report file");
  return [s.ino, s.size, s.mtimeNs, s.ctimeNs].join(":");
};

function inactive(files) {
  if (process.platform !== "darwin") return false;
  const result = spawnSync("lsof", ["-n", "-P", "-F", "n", "--", ...files], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return !result.error && result.status === 1 && !result.stdout && !result.stderr;
}

function reachable(root, base, head) {
  for (const [ancestor, descendant] of [
    [base, head],
    [head, "refs/heads/main"],
  ]) {
    const result = spawnSync("git", ["-C", root, "merge-base", "--is-ancestor", ancestor, descendant], {
      timeout: 10_000,
    });
    if (result.error || result.status !== 0) return false;
  }
  return true;
}

// Clean committed reviews in main are reproducible. Keep their index and a receipt;
// unknown, changed, pinned or possibly open reports are never retired.
export function expireCheckoutReviews(root, { now = Date.now(), isInactive = inactive } = {}) {
  const reports = path.join(root, "reports"),
    diffs = path.join(reports, "agent-diff"),
    seals = path.join(reports, ".review-retention");
  const removed = [];
  try {
    const safeDirs = (dirs) =>
      dirs.every((dir) => {
        const s = lstatSync(dir);
        return (
          s.isDirectory() &&
          !s.isSymbolicLink() &&
          !lstatSync(path.join(dir, ".retention-keep"), { throwIfNoEntry: false })
        );
      });
    if (!safeDirs([root, reports, diffs, seals])) return removed;
    const branch = spawnSync("git", ["-C", root, "branch", "--show-current"], { encoding: "utf8" });
    if (branch.error || branch.status !== 0 || branch.stdout.trim() !== "main") return removed;
    for (const entry of readdirSync(diffs, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !uuid.test(entry.name)) continue;
      const dir = path.join(diffs, entry.name),
        index = path.join(dir, "index.json"),
        patch = path.join(dir, "patches.txt"),
        sealPath = path.join(seals, `${entry.name}.json`),
        marker = path.join(dir, "patches-expired.json"),
        claim = path.join(dir, `.patches-expiring-${randomUUID()}`);
      let claimed = false,
        marked = false,
        markerInfo;
      try {
        if (readdirSync(dir).sort().join("\n") !== "index.json\npatches.txt") continue;
        const sealInfo = info(sealPath),
          indexInfo = info(index),
          patchInfo = info(patch);
        const sealBytes = readFileSync(sealPath),
          indexBytes = readFileSync(index),
          seal = JSON.parse(sealBytes),
          record = JSON.parse(indexBytes);
        if (
          seal.version !== 1 ||
          !Number.isFinite(seal.createdAt) ||
          seal.createdAt > now - DAY ||
          typeof seal.layers !== "boolean" ||
          !commit.test(seal.base) ||
          !commit.test(seal.head) ||
          record.retention?.version !== 1 ||
          record.retention.base !== seal.base ||
          record.retention.head !== seal.head ||
          record.patches !== patch ||
          !Array.isArray(record.selected) ||
          !Array.isArray(record.inventory) ||
          seal.indexHash !== sha(indexBytes) ||
          !/^[0-9a-f]{64}$/.test(seal.patchHash) ||
          !reachable(root, seal.base, seal.head) ||
          !safeDirs([root, reports, diffs, seals, dir]) ||
          !isInactive([dir, index, patch, sealPath]) ||
          archiveFileHash(patch) !== seal.patchHash ||
          info(index) !== indexInfo ||
          info(patch) !== patchInfo ||
          info(sealPath) !== sealInfo
        )
          continue;
        renameSync(patch, claim);
        claimed = true;
        const claimInfo = info(claim);
        if (
          claimInfo.split(":").slice(0, 3).join(":") !== patchInfo.split(":").slice(0, 3).join(":") ||
          info(index) !== indexInfo ||
          info(sealPath) !== sealInfo ||
          !safeDirs([root, reports, diffs, seals, dir]) ||
          !isInactive([dir, index, claim, sealPath]) ||
          archiveFileHash(claim) !== seal.patchHash ||
          info(claim) !== claimInfo ||
          info(index) !== indexInfo ||
          info(sealPath) !== sealInfo ||
          lstatSync(path.join(dir, ".retention-keep"), { throwIfNoEntry: false })
        )
          continue;
        writeFileSync(
          marker,
          JSON.stringify(
            {
              ...seal,
              expiredAt: now,
              recovery: `git diff --binary ${seal.base} ${seal.head}`,
            },
            null,
            2,
          ) + "\n",
          { flag: "wx" },
        );
        marked = true;
        markerInfo = info(marker);
        if (
          !safeDirs([root, reports, diffs, seals, dir]) ||
          info(claim) !== claimInfo ||
          info(index) !== indexInfo ||
          info(sealPath) !== sealInfo ||
          !isInactive([dir, index, claim, sealPath, marker])
        )
          continue;
        rmSync(claim);
        claimed = false;
        removed.push(patch);
      } catch {
        // Preserve reports whenever identification or inactivity is uncertain.
      } finally {
        if (claimed) {
          if (marked) {
            try {
              if (info(marker) === markerInfo) rmSync(marker);
            } catch {
              // Preserve both receipt and claim if a filesystem error prevents cleanup.
            }
          }
          try {
            if (!lstatSync(patch, { throwIfNoEntry: false })) renameSync(claim, patch);
          } catch {
            // Keep the claim if a replacement or a filesystem error prevents restoration.
          }
        }
      }
    }
  } catch {
    // Missing or inaccessible report directories are not cleanup candidates.
  }
  return removed;
}

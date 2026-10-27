import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const DAY = 24 * 60 * 60 * 1000;
const eligible = (name) =>
  /^(?:playwright-report|blob-report|all-blob-reports|test-results)$/.test(name) ||
  /^reports\/review\/[a-z0-9-]+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    name,
  );

function captureEvidence(file) {
  const record = JSON.parse(readFileSync(path.join(file, "evidence.json"), "utf8"));
  if (record.complete !== true || record.runtime !== "Vite browser preview" || !Array.isArray(record.frames))
    return false;
  const names = ["checkpoint.json", "evidence.json", ...record.frames.map((frame) => frame.file)];
  if (names.some((name) => typeof name !== "string" || path.basename(name) !== name)) return false;
  const actual = readdirSync(file).sort();
  return names.length === actual.length && names.sort().every((name, index) => name === actual[index]);
}

function safeParents(archive, relative) {
  let current = path.join(archive, "files");
  for (const part of relative.split("/").slice(0, -1)) {
    if (lstatSync(path.join(current, ".retention-keep"), { throwIfNoEntry: false })) return false;
    current = path.join(current, part);
    const item = lstatSync(current);
    if (!item.isDirectory() || item.isSymbolicLink()) return false;
  }
  return !lstatSync(path.join(current, ".retention-keep"), { throwIfNoEntry: false });
}

// Identity and directory entries detect later edits without reading large artifacts again.
// Any unusual entry or keep marker makes the whole tree caller-owned.
export function evidenceSnapshot(file) {
  const hash = createHash("sha256");
  function visit(item, relative) {
    const stat = lstatSync(item, { bigint: true });
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
      throw new Error("Unsupported evidence");
    hash.update(
      JSON.stringify([
        relative,
        String(stat.ino),
        String(stat.mode),
        String(stat.size),
        String(stat.mtimeNs),
        relative ? String(stat.ctimeNs) : "",
      ]),
    );
    if (stat.isDirectory()) {
      const names = readdirSync(item).sort();
      if (names.includes(".retention-keep")) throw new Error("Evidence explicitly retained");
      for (const name of names) visit(path.join(item, name), path.join(relative, name));
    }
  }
  visit(file, "");
  return hash.digest("hex");
}

export function expiringEvidence(archive, ignored, now = Date.now()) {
  const entries = [];
  const names = ignored.map((name) => name.replace(/\/$/u, "")).filter(eligible);
  if (ignored.includes("reports/")) {
    try {
      const review = path.join(archive, "files/reports/review");
      if (safeParents(archive, "reports/review/item")) {
        for (const name of readdirSync(review)) {
          const relative = `reports/review/${name}`;
          try {
            const item = lstatSync(path.join(review, name));
            if (
              eligible(relative) &&
              item.isDirectory() &&
              !item.isSymbolicLink() &&
              captureEvidence(path.join(review, name))
            )
              names.push(relative);
          } catch {
            // Preserve malformed or concurrently changed captures.
          }
        }
      }
    } catch {
      // Missing or unusual report trees are retained.
    }
  }
  for (const relative of names) {
    try {
      if (!safeParents(archive, relative)) continue;
      const root = lstatSync(path.join(archive, "files", relative));
      if (!root.isDirectory() || root.isSymbolicLink()) continue;
      entries.push({ path: relative, snapshot: evidenceSnapshot(path.join(archive, "files", relative)) });
    } catch {
      // Unknown or explicitly retained evidence remains archived indefinitely.
    }
  }
  return { version: 1, expiresAt: now + DAY, entries };
}

// Only archives explicitly sealed by this policy qualify; legacy archives never do.
export function expireEvidence(archives, { now = Date.now() } = {}) {
  const removed = [];
  const info = lstatSync(archives, { throwIfNoEntry: false });
  if (!info) return removed;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe evidence archive root");
  for (const entry of readdirSync(archives, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !entry.name.startsWith("task-")) continue;
    const archive = path.join(archives, entry.name);
    let retention;
    try {
      const files = lstatSync(path.join(archive, "files"));
      if (
        !files.isDirectory() ||
        files.isSymbolicLink() ||
        lstatSync(path.join(archive, ".retention-keep"), { throwIfNoEntry: false }) ||
        lstatSync(path.join(archive, "files", ".retention-keep"), { throwIfNoEntry: false })
      )
        continue;
      const manifest = lstatSync(path.join(archive, "manifest.json"));
      if (!manifest.isFile() || manifest.isSymbolicLink()) continue;
      retention = JSON.parse(readFileSync(path.join(archive, "manifest.json"), "utf8")).retention;
    } catch {
      continue;
    }
    if (
      retention?.version !== 1 ||
      !Number.isFinite(retention.expiresAt) ||
      retention.expiresAt > now ||
      !Array.isArray(retention.entries)
    )
      continue;
    for (const item of retention.entries) {
      if (!item || !eligible(item.path) || typeof item.snapshot !== "string") continue;
      const source = path.join(archive, "files", item.path);
      const claim = path.join(path.dirname(source), `.fauna-expiring-${randomUUID()}`);
      try {
        if (!safeParents(archive, item.path)) continue;
        if (evidenceSnapshot(source) !== item.snapshot) continue;
        renameSync(source, claim);
        if (evidenceSnapshot(claim) !== item.snapshot) {
          if (!lstatSync(source, { throwIfNoEntry: false })) renameSync(claim, source);
          continue;
        }
        rmSync(claim, { recursive: true });
        removed.push(source);
      } catch (error) {
        // Preserve an interrupted or changed claim for inspection; never overwrite a replacement.
        if (lstatSync(claim, { throwIfNoEntry: false }) && !lstatSync(source, { throwIfNoEntry: false })) {
          try {
            renameSync(claim, source);
          } catch {
            /* Preserve claim. */
          }
        }
        if (
          error.code !== "ENOENT" &&
          !["Unsupported evidence", "Evidence explicitly retained"].includes(error.message)
        )
          throw error;
      }
    }
  }
  return removed;
}

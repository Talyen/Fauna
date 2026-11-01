import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { generatedName } from "../balance/report-retention.mjs";
import { readReceipt, eligible as eligibleDevelopmentPackage } from "./development-package-receipt.mjs";

const DAY = 24 * 60 * 60 * 1000;
const PREPARED = /^reports\/(?:[a-z0-9][a-z0-9._-]*\/){1,3}prepared$/;
const PREPARED_BUDGET = 1024 ** 3;
function inactive(file) {
  const result = spawnSync("lsof", ["-nP", "+D", file], { encoding: "utf8", timeout: 5000 });
  return !result.error && result.status === 1 && !result.stdout && !result.stderr;
}
// Only the generated build-media layout qualifies; unknown originals remain.
function preparedCopy(file) {
  const receipt = JSON.parse(readFileSync(path.join(file, "manifest.json"), "utf8"));
  if (receipt.version !== 2 || !/^[a-f0-9]{64}$/.test(receipt.manifestHash ?? "") || !receipt.records)
    return null;
  const expected = new Set(["manifest.json"]);
  for (const record of Object.values(receipt.records)) {
    if (
      !/^\.\/prepared\/objects\/[a-f0-9]{64}\/asset\.(?:webp|png|svg|mp3|wav|ogg)$/.test(record.url ?? "") ||
      !/^[a-f0-9]{64}$/.test(record.outputHash ?? "")
    )
      return null;
    expected.add(record.url.slice("./prepared/".length));
  }
  let bytes = 0;
  const actual = [];
  function visit(dir) {
    for (const name of readdirSync(dir)) {
      const item = path.join(dir, name),
        stat = lstatSync(item);
      if (stat.isSymbolicLink()) throw new Error("Unsupported evidence");
      if (stat.isDirectory()) visit(item);
      else if (stat.isFile()) {
        actual.push(path.relative(file, item).split(path.sep).join("/"));
        bytes += stat.size;
      } else throw new Error("Unsupported evidence");
    }
  }
  visit(file);
  return expected.size > 1 && actual.length === expected.size && actual.every((name) => expected.has(name))
    ? bytes
    : null;
}
const eligible = (name) =>
  PREPARED.test(name) ||
  /^(?:playwright-report|blob-report|all-blob-reports|test-results)$/.test(name) ||
  /^reports\/balance\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) ||
  /^reports\/(?:performance\/capture|interactions\/run)-[0-9]+$/.test(name) ||
  /^reports\/agent-diff\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(name) ||
  /^release\/\.fauna-development\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/output$/.test(
    name,
  ) ||
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

function committedReview(file) {
  const record = JSON.parse(readFileSync(path.join(file, "index.json"), "utf8"));
  if (
    record.retention?.version !== 1 ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(record.retention.base) ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(record.retention.head) ||
    !Array.isArray(record.inventory) ||
    !Array.isArray(record.selected)
  )
    return false;
  const names = readdirSync(file).sort();
  if (record.patches === undefined) return names.length === 1 && names[0] === "index.json";
  return (
    typeof record.patches === "string" &&
    path.basename(record.patches) === "patches.txt" &&
    names.length === 2 &&
    names[0] === "index.json" &&
    names[1] === "patches.txt"
  );
}

function balanceEvidence(file) {
  const marker = path.join(file, ".balance-retention.json");
  if (!lstatSync(marker).isFile() || lstatSync(marker).isSymbolicLink()) return false;
  const record = JSON.parse(readFileSync(marker, "utf8"));
  if (
    record.schema !== 1 ||
    record.kind !== "fauna-generated-balance" ||
    record.complete !== true ||
    !Array.isArray(record.files) ||
    !record.files.length
  )
    return false;
  const expected = new Set(record.files.map((entry) => entry.name));
  const names = readdirSync(file);
  if (
    expected.size !== record.files.length ||
    names.length !== expected.size + 1 ||
    names.some((name) => name !== ".balance-retention.json" && !expected.has(name))
  )
    return false;
  for (const entry of record.files) {
    if (typeof entry.name !== "string" || !generatedName.test(entry.name)) return false;
    const item = lstatSync(path.join(file, entry.name));
    if (
      !item.isFile() ||
      item.isSymbolicLink() ||
      item.size !== entry.bytes ||
      Math.abs(item.mtimeMs - entry.modified) >= 2
    )
      return false;
  }
  const report = JSON.parse(readFileSync(path.join(file, "report.json"), "utf8"));
  return report.complete === true && report.evidencePolicy !== "full";
}

function generatedRun(file, kind) {
  const reportFile = path.join(file, "report.json");
  const info = lstatSync(reportFile);
  if (!info.isFile() || info.isSymbolicLink()) return false;
  const report = JSON.parse(readFileSync(reportFile, "utf8"));
  if (report.complete !== true) return false;
  let expected = ["report.json"];
  if (kind === "interactions") {
    if (report.format !== 1 || !Array.isArray(report.actions)) return false;
  } else {
    if (
      report.format !== 3 ||
      !Array.isArray(report.cases) ||
      !report.cases.length ||
      report.environment?.trace
    )
      return false;
    for (const item of report.cases) {
      if (typeof item.id !== "string" || !/^[a-z0-9-]+$/.test(item.id)) return false;
      expected.push(`${item.id}-sample.json`, `${item.id}-summary.json`, `${item.id}-hitches.md`);
    }
  }
  const names = readdirSync(file).sort();
  expected = expected.sort();
  return names.length === expected.length && names.every((name, index) => name === expected[index]);
}

function pinned(directory) {
  // Persistent advisory-lock files are not proof of a live owner. Explicit
  // retention controls are; native open-file checks guard the actual payload.
  return readdirSync(directory).some(
    (name) =>
      name === ".retention-keep" || name === ".retention-lock" || name.endsWith(".retention-owner.json"),
  );
}

function safeParents(archive, relative) {
  if (pinned(archive) || pinned(path.dirname(archive))) return false;
  let current = path.join(archive, "files");
  for (const part of relative.split("/").slice(0, -1)) {
    if (pinned(current)) return false;
    current = path.join(current, part);
    const item = lstatSync(current);
    if (!item.isDirectory() || item.isSymbolicLink()) return false;
  }
  return !pinned(current);
}

// Identity and directory entries detect later edits without reading large artifacts again.
// Any unusual entry or keep marker makes the whole tree caller-owned.
function evidenceSnapshot(file, { compiled = false } = {}) {
  const hash = createHash("sha256");
  function visit(item, relative) {
    const stat = lstatSync(item, { bigint: true });
    if (
      /(?:^|\/)(?:sources?|originals?|saves?|backups?|masters?|finals?|trailers?)(?:\/|$)|\.(?:sqlite(?:-wal|-shm)?|save|db|mp4|mov|ipa|xcarchive|patch|diff)$/i.test(
        relative,
      ) ||
      (!compiled && /\.(?:swift|tsx?|jsx?)$/i.test(relative))
    )
      throw new Error("Unsupported evidence");
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
      if (
        names.some(
          (name) =>
            name === ".retention-keep" || name.endsWith(".retention-owner.json") || name.endsWith(".lock"),
        )
      )
        throw new Error("Evidence explicitly retained");
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
    const reports = path.join(archive, "files/reports");
    function findPrepared(directory, depth = 0) {
      if (depth > 4) return;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const item = path.join(directory, entry.name),
          relative = path.relative(path.join(archive, "files"), item).split(path.sep).join("/");
        if (PREPARED.test(relative)) {
          if (preparedCopy(item) !== null) names.push(relative);
        } else if (!/^(?:source|assets?|art|saves?|backups?|trailers?|finals?|masters?)$/i.test(entry.name))
          findPrepared(item, depth + 1);
      }
    }
    try {
      findPrepared(reports);
    } catch {
      /* Unknown or modified build copies remain. */
    }
    try {
      const review = path.join(archive, "files/reports/agent-diff");
      if (safeParents(archive, "reports/agent-diff/item")) {
        for (const name of readdirSync(review)) {
          const relative = `reports/agent-diff/${name}`;
          try {
            const item = lstatSync(path.join(review, name));
            if (
              eligible(relative) &&
              item.isDirectory() &&
              !item.isSymbolicLink() &&
              committedReview(path.join(review, name))
            )
              names.push(relative);
          } catch {
            // Preserve incomplete, modified or unclassified review output.
          }
        }
      }
    } catch {
      // Missing or unusual report trees are retained.
    }
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
    try {
      const balance = path.join(archive, "files/reports/balance");
      if (safeParents(archive, "reports/balance/item")) {
        for (const name of readdirSync(balance)) {
          const relative = `reports/balance/${name}`;
          try {
            const item = lstatSync(path.join(balance, name));
            if (
              eligible(relative) &&
              item.isDirectory() &&
              !item.isSymbolicLink() &&
              balanceEvidence(path.join(balance, name))
            )
              names.push(relative);
          } catch {
            /* Unsealed, modified or incomplete runs are retained. */
          }
        }
      }
    } catch {
      /* Missing or unusual report trees are retained. */
    }
    for (const kind of ["performance", "interactions"]) {
      try {
        const base = path.join(archive, "files/reports", kind);
        if (!safeParents(archive, `reports/${kind}/item`)) continue;
        for (const name of readdirSync(base)) {
          const relative = `reports/${kind}/${name}`;
          try {
            const item = lstatSync(path.join(base, name));
            if (
              eligible(relative) &&
              item.isDirectory() &&
              !item.isSymbolicLink() &&
              generatedRun(path.join(base, name), kind)
            )
              names.push(relative);
          } catch {
            /* Retain incomplete, modified and unknown runs. */
          }
        }
      } catch {
        /* Missing or unusual report trees are retained. */
      }
    }
  }
  if (ignored.includes("release/")) {
    try {
      const managed = path.join(archive, "files/release/.fauna-development");
      if (safeParents(archive, "release/.fauna-development/item")) {
        for (const id of readdirSync(managed)) {
          const relative = `release/.fauna-development/${id}/output`;
          try {
            const entry = path.join(managed, id);
            const receipt = readReceipt(entry, id);
            if (eligible(relative) && receipt && eligibleDevelopmentPackage(entry, receipt))
              names.push(relative);
          } catch {
            /* Preserve unknown, changed, pinned or leased packages. */
          }
        }
      }
    } catch {
      /* Unmanaged releases remain preserved. */
    }
  }
  for (const relative of names) {
    try {
      if (!safeParents(archive, relative)) continue;
      const root = lstatSync(path.join(archive, "files", relative));
      if (!root.isDirectory() || root.isSymbolicLink()) continue;
      const item = path.join(archive, "files", relative);
      if (relative.startsWith("reports/agent-diff/") && !committedReview(item)) continue;
      const snapshot = evidenceSnapshot(item, {
        compiled: relative.startsWith("release/.fauna-development/"),
      });
      const review = relative.startsWith("reports/agent-diff/")
        ? JSON.parse(readFileSync(path.join(item, "index.json"), "utf8"))
        : undefined;
      const prepared = PREPARED.test(relative) ? preparedCopy(item) : null;
      entries.push({
        path: relative,
        snapshot,
        ...(review ? { review } : {}),
        ...(prepared === null ? {} : { prepared: { bytes: prepared, sealedAt: now } }),
      });
    } catch {
      // Unknown or explicitly retained evidence remains archived indefinitely.
    }
  }
  return { version: 1, expiresAt: now + DAY, entries };
}

// Only archives explicitly sealed by this policy qualify; legacy archives never do.
export function expireEvidence(
  archives,
  { now = Date.now(), dryRun = false, budget = PREPARED_BUDGET, isInactive = inactive } = {},
) {
  if (!Number.isFinite(budget) || budget < 1) throw new Error("Invalid archive budget");
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
    const prepared = retention.entries.filter(
      (item) =>
        PREPARED.test(item?.path ?? "") &&
        Number.isFinite(item.prepared?.bytes) &&
        Number.isFinite(item.prepared?.sealedAt),
    );
    let preparedBytes = prepared.reduce((sum, item) => sum + item.prepared.bytes, 0);
    for (const item of [...retention.entries].sort(
      (a, b) => (a.prepared?.sealedAt ?? 0) - (b.prepared?.sealedAt ?? 0),
    )) {
      if (removed.length >= 64) return removed;
      if (!item || !eligible(item.path) || typeof item.snapshot !== "string") continue;
      const source = path.join(archive, "files", item.path);
      if (
        PREPARED.test(item.path) &&
        (!item.prepared ||
          now < item.prepared.sealedAt + DAY ||
          (now < item.prepared.sealedAt + 3 * DAY && preparedBytes <= budget))
      )
        continue;
      const claim = path.join(path.dirname(source), `.fauna-expiring-${randomUUID()}`);
      try {
        if (!safeParents(archive, item.path)) continue;
        if (
          !isInactive(source) ||
          evidenceSnapshot(source, { compiled: item.path.startsWith("release/.fauna-development/") }) !==
            item.snapshot
        )
          continue;
        if (dryRun) {
          removed.push(source);
          preparedBytes -= item.prepared?.bytes ?? 0;
          continue;
        }
        renameSync(source, claim);
        if (
          !isInactive(claim) ||
          evidenceSnapshot(claim, { compiled: item.path.startsWith("release/.fauna-development/") }) !==
            item.snapshot
        ) {
          if (!lstatSync(source, { throwIfNoEntry: false })) renameSync(claim, source);
          continue;
        }
        rmSync(claim, { recursive: true });
        removed.push(source);
        preparedBytes -= item.prepared?.bytes ?? 0;
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

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.slice(2).join(" ") !== "--dry-run")
    throw new Error("Usage: node scripts/lib/evidence-retention.mjs --dry-run");
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) throw new Error("Cannot identify repository archive root");
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        eligible: expireEvidence(path.join(result.stdout.trim(), "fauna-worktree-archives"), {
          dryRun: true,
        }),
      },
      null,
      2,
    ),
  );
}

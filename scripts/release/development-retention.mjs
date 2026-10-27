import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tryLock } from "fs-native-extensions";
import { snapshot, readReceipt, eligible } from "../lib/development-package-receipt.mjs";

const home = (root) => path.join(root, "release", ".fauna-development");
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const present = (file) => lstatSync(file, { throwIfNoEntry: false });

function directory(file) {
  try {
    mkdirSync(file);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const item = lstatSync(file);
  if (!item.isDirectory() || item.isSymbolicLink()) throw new Error(`Unsafe retention directory: ${file}`);
}

// A shared advisory lock covers selection, leases, publication, and deletion.
export function withDevelopmentLock(root, action) {
  directory(path.join(root, "release"));
  directory(home(root));
  const file = path.join(home(root), ".lock");
  if (present(file) && !present(file).isFile()) throw new Error("Unsafe development retention lock.");
  const fd = openSync(
    file,
    constants.O_RDWR | constants.O_CREAT | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    if (!tryLock(fd)) throw new Error("Development retention is busy; its owner remains undisturbed.");
    return action();
  } finally {
    closeSync(fd);
  }
}

function records(root) {
  return readdirSync(home(root))
    .filter((id) => idPattern.test(id))
    .flatMap((id) => {
      const entry = path.join(home(root), id),
        receipt = readReceipt(entry, id);
      return receipt ? [{ entry, receipt }] : [];
    });
}

// Called only under the same lock as producers and lease operations.
function latestSuccess(found) {
  return found
    .filter(({ receipt }) => receipt.result === "success")
    .sort((a, b) => b.receipt.finished - a.receipt.finished || b.receipt.id.localeCompare(a.receipt.id))[0];
}

// Unknown or denied process inventory is not evidence of inactivity.
export function idleDevelopmentOutput(output) {
  if (process.platform !== "darwin")
    return { idle: false, reason: "Process inventory unavailable on this platform" };
  const result = spawnSync("lsof", ["-n", "-P", "+D", output], { encoding: "utf8", timeout: 30_000 });
  if (!result.error && result.status === 1 && !result.stdout.trim() && !result.stderr.trim())
    return { idle: true };
  if (!result.error && result.status === 0 && !result.stderr.trim())
    return { idle: false, reason: "Output is in use" };
  const reason = result.error?.message || result.stderr.trim() || `lsof exited with status ${result.status}`;
  return {
    idle: false,
    reason: `Process inventory failed: ${reason}`,
    denied: /EPERM|EACCES|permission denied/i.test(reason),
  };
}

export function pruneDevelopmentLocked(
  root,
  { dryRun = true, idle = idleDevelopmentOutput, now = Date.now(), graceMs = 86_400_000 } = {},
) {
  const found = records(root);
  const latest = latestSuccess(found);
  const candidates = [];
  const known = new Set(found.map(({ receipt }) => receipt.id));
  const preserved = readdirSync(home(root))
    .filter((name) => name !== ".lock" && name !== ".retention-keep" && !known.has(name))
    .map((name) => ({ path: path.join(home(root), name), reason: "Unknown or incomplete run" }));
  if (
    [root, path.join(root, "release"), home(root)].some((base) => present(path.join(base, ".retention-keep")))
  )
    return {
      latest: latest?.entry ?? null,
      candidates,
      preserved: [{ path: home(root), reason: "Keep marker" }],
      dryRun,
    };
  let inventoryDenied = false;
  for (const { entry, receipt } of found) {
    if (entry === latest?.entry) continue;
    if (receipt.finished > now || now - receipt.finished < graceMs) {
      preserved.push({ path: entry, reason: "Within the 24-hour retention period" });
      continue;
    }
    if (!eligible(entry, receipt)) {
      preserved.push({ path: entry, reason: "Protected, changed, leased or already removed" });
      continue;
    }
    if (inventoryDenied) {
      preserved.push({ path: entry, reason: "Process inventory previously denied; not retried" });
      continue;
    }
    const check = idle(path.join(entry, "output"));
    if (!(typeof check === "boolean" ? check : check.idle)) {
      preserved.push({ path: entry, reason: check.reason ?? "Process inventory did not confirm inactivity" });
      if (check.denied) inventoryDenied = true;
      continue;
    }
    candidates.push(entry);
    if (!dryRun) rmSync(path.join(entry, "output"), { recursive: true });
  }
  return { latest: latest?.entry ?? null, candidates, preserved, dryRun };
}

export function inspectDevelopment(root, options) {
  return withDevelopmentLock(root, () => pruneDevelopmentLocked(root, options));
}

export function createDevelopmentRun(root, { commit, dirty, now = Date.now() } = {}) {
  const id = randomUUID(),
    entry = path.join(home(root), id);
  mkdirSync(entry);
  mkdirSync(path.join(entry, "leases"));
  mkdirSync(path.join(entry, "output"));
  writeFileSync(
    path.join(entry, "owner.json"),
    JSON.stringify({ id, pid: process.pid, commit, dirty, started: now }),
    { flag: "wx" },
  );
  return { id, root, entry, output: path.join(entry, "output"), commit, dirty };
}

export function finishDevelopmentRun(run, result, { now = Date.now() } = {}) {
  if (!["success", "failed"].includes(result)) throw new Error("Unknown package result.");
  const files = snapshot(run.output);
  const finished = records(run.root).reduce((time, { receipt }) => Math.max(time, receipt.finished + 1), now);
  const receipt = {
    schema: 1,
    kind: "fauna-development-package",
    id: run.id,
    result,
    distributed: false,
    finished,
    commit: run.commit,
    dirty: run.dirty,
    files,
  };
  writeFileSync(path.join(run.entry, "receipt.json"), JSON.stringify(receipt), { flag: "wx" });
  rmSync(path.join(run.entry, "owner.json"));
  return receipt;
}

// Consumers hold a named lease until finished. An abandoned or malformed lease
// remains protective; it is never guessed stale from its age or PID.
export function leaseDevelopment(root, directory) {
  if (!present(path.join(root, "release")) || !present(home(root))) {
    if (directory) throw new Error("Managed package receipt unavailable; package preserved.");
    return null;
  }
  return withDevelopmentLock(root, () => {
    const found = records(root);
    const target = directory
      ? found.find(({ entry }) => path.resolve(directory) === path.join(entry, "output", "win-unpacked"))
      : latestSuccess(found);
    if (!target && directory) throw new Error("Managed package receipt unavailable; package preserved.");
    if (!target) return null;
    const outputRoot = path.join(target.entry, "output"),
      output = path.join(outputRoot, "win-unpacked"),
      leases = path.join(target.entry, "leases");
    const safeDirectory = (file) => {
      const info = present(file);
      if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe managed package: ${file}`);
      return info;
    };
    safeDirectory(outputRoot);
    safeDirectory(output);
    const leasesInfo = safeDirectory(leases);
    const token = randomUUID(),
      lease = path.join(leases, token);
    writeFileSync(lease, JSON.stringify({ pid: process.pid, created: Date.now() }), { flag: "wx" });
    const leaseInfo = lstatSync(lease);
    return {
      directory: output,
      release: () =>
        withDevelopmentLock(root, () => {
          if (safeDirectory(leases).ino !== leasesInfo.ino || lstatSync(lease).ino !== leaseInfo.ino)
            throw new Error("Package lease changed; preserved it.");
          rmSync(lease);
        }),
    };
  });
}

export const leaseLatestDevelopment = (root) => leaseDevelopment(root);
export function leasePackage(root, directory) {
  if (!directory) return leaseLatestDevelopment(root);
  const relative = path.relative(home(root), path.resolve(directory));
  if (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))
    return leaseDevelopment(root, directory);
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--apply"))
    throw new Error("Usage: development:retention -- [--apply]");
  console.log(
    JSON.stringify(
      inspectDevelopment(path.resolve(import.meta.dirname, "../.."), {
        dryRun: args[0] !== "--apply",
      }),
      null,
      2,
    ),
  );
}

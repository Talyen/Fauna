import { createHash } from "node:crypto";
import { closeSync, constants, lstatSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import path from "node:path";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const present = (file) => lstatSync(file, { throwIfNoEntry: false });

// Hash a closed, generated tree; a changed, pinned, linked, or unexpected tree
// is not eligible. Retain empty directories in the identity as well.
export function snapshot(root) {
  const entries = [];
  let buffer;
  function visit(file, relative) {
    const info = lstatSync(file);
    if (info.isSymbolicLink()) throw new Error("Output contains a symlink");
    if (relative && path.basename(file) === ".retention-keep") throw new Error("Output is pinned");
    if (info.isDirectory()) {
      entries.push([relative, "directory"]);
      for (const name of readdirSync(file).sort()) visit(path.join(file, name), path.join(relative, name));
    } else if (info.isFile()) {
      const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const hash = createHash("sha256");
      try {
        buffer ??= Buffer.allocUnsafe(1024 * 1024);
        for (;;) {
          const n = readSync(fd, buffer, 0, buffer.length, null);
          if (!n) break;
          hash.update(buffer.subarray(0, n));
        }
      } finally {
        closeSync(fd);
      }
      const after = lstatSync(file);
      if (
        after.ino !== info.ino ||
        after.size !== info.size ||
        after.mtimeMs !== info.mtimeMs ||
        after.ctimeMs !== info.ctimeMs
      )
        throw new Error("Output changed while hashing");
      entries.push([relative, "file", info.size, hash.digest("hex")]);
    } else throw new Error("Unexpected output entry");
  }
  visit(root, "");
  return entries;
}

export function readReceipt(entry, id) {
  try {
    if (!idPattern.test(id) || !present(entry)?.isDirectory() || present(entry).isSymbolicLink()) return null;
    const file = path.join(entry, "receipt.json"),
      info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink()) return null;
    const record = JSON.parse(readFileSync(file, "utf8"));
    if (
      record.schema !== 1 ||
      record.kind !== "fauna-development-package" ||
      record.id !== id ||
      !["success", "failed"].includes(record.result) ||
      !Number.isFinite(record.finished) ||
      record.distributed !== false ||
      !Array.isArray(record.files)
    )
      return null;
    return record;
  } catch {
    return null;
  }
}

export function eligible(entry, receipt) {
  try {
    const names = readdirSync(entry).sort();
    if (names.some((name) => !["receipt.json", "output", "leases"].includes(name))) return false;
    const leases = path.join(entry, "leases"),
      info = present(leases);
    if (!info?.isDirectory() || info.isSymbolicLink() || readdirSync(leases).length) return false;
    return JSON.stringify(snapshot(path.join(entry, "output"))) === JSON.stringify(receipt.files);
  } catch {
    return false;
  }
}

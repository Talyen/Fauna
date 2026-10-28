import { createReadStream, openSync, readSync, closeSync, fstatSync } from "node:fs";
import { createHash } from "node:crypto";

export async function fileHash(file) {
  const digest = createHash("sha256");
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest("hex");
}

/** Bound memory when synchronous packaging callers hash large executables and archives. */
export function fileDigestSync(file) {
  const descriptor = openSync(file, "r");
  try {
    if (!fstatSync(descriptor).isFile()) throw new Error(`Expected a regular file: ${file}`);
    const digest = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let count;
    let size = 0;
    while ((count = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      digest.update(buffer.subarray(0, count));
      size += count;
    }
    return { size, sha256: digest.digest("hex") };
  } finally {
    closeSync(descriptor);
  }
}

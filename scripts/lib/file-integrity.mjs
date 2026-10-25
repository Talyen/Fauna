import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

export async function fileHash(file) {
  const digest = createHash("sha256");
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest("hex");
}

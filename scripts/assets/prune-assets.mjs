import { readFile, readdir, lstat, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assets, withAssetLock } from "./assets.mjs";
import { git } from "../lib/git.mjs";

/** Explicit maintenance only: active media, originals and referenced historical objects survive. */
export async function pruneAssets(repository, { apply = false } = {}) {
  return withAssetLock(repository, () => pruneLocked(repository, apply));
}

async function pruneLocked(repository, apply) {
  const receipt = await assets({ repository });
  const active = new Set(Object.values(receipt.records).map((record) => record.url.split("/")[3]));
  const texts = [];
  for (const file of git(repository, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)) {
    if (
      file.startsWith("public/prepared/objects/") ||
      !/\.(?:[cm]?js|tsx?|json|css|html|md|ya?ml)$/.test(file)
    )
      continue;
    texts.push(
      await readFile(path.join(repository, file), "utf8").catch((error) => {
        if (error.code === "ENOENT") return "";
        throw error;
      }),
    );
  }
  const directory = path.join(repository, "public/prepared/objects");
  const candidates = [],
    preserved = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name) || active.has(entry.name)) continue;
    const object = path.join(directory, entry.name);
    const files = await readdir(object);
    if (
      texts.some((text) => text.includes(entry.name)) ||
      files.some((name) => !/^(?:receipt\.json|asset\.(?:webp|png|svg|wav|ogg|mp3))$/.test(name))
    ) {
      preserved.push(entry.name);
      continue;
    }
    const snapshots = [];
    let bytes = 0,
      safe = true;
    for (const name of files) {
      const stat = await lstat(path.join(object, name));
      if (!stat.isFile()) safe = false;
      bytes += stat.size;
      snapshots.push({ name, bytes: stat.size, mtimeMs: stat.mtimeMs, ino: stat.ino });
    }
    if (!safe) {
      preserved.push(entry.name);
      continue;
    }
    candidates.push({ object: entry.name, bytes, files: snapshots });
  }
  if (apply) {
    // Recheck the publication pointer immediately before removing the exact retired set.
    const current = JSON.parse(await readFile(path.join(repository, "src/assets/prepared.json"), "utf8"));
    if (JSON.stringify(current) !== JSON.stringify(receipt))
      throw new Error("Prepared selection changed; pruning canceled.");
    for (const entry of candidates) {
      const object = path.join(directory, entry.object);
      for (const file of entry.files) {
        const current = await lstat(path.join(object, file.name));
        if (
          !current.isFile() ||
          current.size !== file.bytes ||
          current.mtimeMs !== file.mtimeMs ||
          current.ino !== file.ino
        )
          throw new Error(`Retired object changed; preserved ${entry.object}`);
      }
      // Remove only inventoried files; a newly added unique file prevents directory removal.
      for (const file of entry.files) await rm(path.join(object, file.name));
      await rmdir(object);
    }
  }
  return {
    applied: apply,
    candidates,
    preserved,
    bytes: candidates.reduce((sum, item) => sum + item.bytes, 0),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--apply"))
    throw new Error("Usage: assets:prune -- [--apply]");
  console.log(JSON.stringify(await pruneAssets(process.cwd(), { apply: args[0] === "--apply" }), null, 2));
}

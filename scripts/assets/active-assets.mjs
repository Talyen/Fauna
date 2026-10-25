import { readFile, readdir, mkdir, copyFile, writeFile, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assets } from "./assets.mjs";
import { fileHash } from "../lib/file-integrity.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
// Total prepared media, including music. JavaScript has its own measured budget.
// 199 active objects measure 140.53 MiB, including the Boon and Arabesca selections.
const MAX_MEDIA_BYTES = 144 * 1024 * 1024;
const MAX_ART_BYTES = 3 * 1024 * 1024;
const inventory = (receipt) =>
  [...new Set(Object.values(receipt.records).map((record) => record.url.slice(2)))].sort();

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isSymbolicLink()) throw new Error("Prepared build contains a symlink.");
      const name = path.join(directory, entry.name);
      return entry.isDirectory() ? files(name) : [name];
    }),
  );
  return nested.flat();
}

export async function verifyAssetBundle(directory, receipt) {
  const expected = [...inventory(receipt), "prepared/manifest.json"].sort();
  const actual = (await files(path.join(directory, "prepared")))
    .map((file) => path.relative(directory, file).split(path.sep).join("/"))
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Build media inventory differs from the active selection.");
  const published = JSON.parse(await readFile(path.join(directory, "prepared/manifest.json"), "utf8"));
  if (JSON.stringify(published) !== JSON.stringify(receipt))
    throw new Error("Build media receipt differs from the active selection.");
  // Remaining resources belong to Vite, release identity or the dependency inventory.
  const rootEntries = await readdir(directory);
  if (
    rootEntries.some(
      (name) =>
        ![
          "assets",
          "prepared",
          "index.html",
          "release.json",
          "dependencies.cdx.json",
          "THIRD-PARTY-NOTICES.txt",
        ].includes(name),
    )
  )
    throw new Error("Build contains unapproved public resources or authoring originals.");
  let total = 0;
  for (const url of inventory(receipt)) {
    const record = Object.values(receipt.records).find((item) => item.url.slice(2) === url);
    const file = path.join(directory, url);
    const size = (await stat(file)).size;
    if ((await fileHash(file)) !== record.outputHash) throw new Error(`Build media changed: ${url}`);
    if (/\.(webp|png|svg)$/.test(url) && size > MAX_ART_BYTES)
      throw new Error(`Prepared artwork exceeds 3 MiB: ${url}`);
    total += size;
  }
  if (total > MAX_MEDIA_BYTES)
    throw new Error("Prepared media exceeds 144 MiB; investigate growth before raising the budget.");
  return { files: expected.length - 1, bytes: total };
}

export function activeAssetsPlugin(repository = ROOT) {
  let receipt;
  return {
    name: "fauna-active-assets",
    apply: "build",
    enforce: "post",
    async buildStart() {
      receipt = await assets({ repository });
    },
    transform(_code, id) {
      if (
        id.replaceAll("\\", "/") !== path.join(repository, "src/assets/prepared.json").replaceAll("\\", "/")
      )
        return;
      // The renderer needs URLs; source hashes and encoder receipts remain in the media manifest.
      const records = Object.fromEntries(
        Object.entries(receipt.records).map(([key, record]) => [key, { url: record.url }]),
      );
      return { code: `export default ${JSON.stringify({ records })};`, map: null };
    },
    async generateBundle() {
      const current = JSON.parse(await readFile(path.join(repository, "src/assets/prepared.json"), "utf8"));
      if (JSON.stringify(current) !== JSON.stringify(receipt))
        throw new Error("Prepared lookup changed during build; retry from a stable selection.");
    },
    async writeBundle(options) {
      const directory = path.resolve(repository, options.dir);
      // Media URLs are already final. Copy outside the bundler's asset buffers,
      // validating the copied bytes before publishing the receipt last.
      for (const file of inventory(receipt)) {
        const target = path.join(directory, file);
        const temporary = `${target}.${randomUUID()}.tmp`;
        await mkdir(path.dirname(target), { recursive: true });
        try {
          await copyFile(path.join(repository, "public", file), temporary);
          const record = Object.values(receipt.records).find((item) => item.url.slice(2) === file);
          if ((await fileHash(temporary)) !== record.outputHash)
            throw new Error(`Prepared asset changed during build: ${file}`);
          await rename(temporary, target);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      const current = JSON.parse(await readFile(path.join(repository, "src/assets/prepared.json"), "utf8"));
      if (JSON.stringify(current) !== JSON.stringify(receipt))
        throw new Error("Prepared lookup changed during build; retry from a stable selection.");
      await writeFile(
        path.join(directory, "prepared/manifest.json"),
        JSON.stringify(receipt, null, 2) + "\n",
      );
      await verifyAssetBundle(directory, receipt);
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error("Usage: npm run assets:check:bundle");
  const result = await verifyAssetBundle(path.join(ROOT, "dist"), await assets());
  console.log(
    `Build media: ${result.files} active files; ${(result.bytes / 1048576).toFixed(2)} MiB; 144 MiB limit.`,
  );
}

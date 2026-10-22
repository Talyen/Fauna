import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assets, hash } from "./assets.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
// Total prepared media, including music. JavaScript has its own measured budget.
const MAX_MEDIA_BYTES = 128 * 1024 * 1024;
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
  // All remaining emitted resources belong to Vite or the release identity plugin.
  const rootEntries = await readdir(directory);
  if (rootEntries.some((name) => !["assets", "prepared", "index.html", "release.json"].includes(name)))
    throw new Error("Build contains unapproved public resources or authoring originals.");
  let total = 0;
  for (const url of inventory(receipt)) {
    const record = Object.values(receipt.records).find((item) => item.url.slice(2) === url);
    const bytes = await readFile(path.join(directory, url));
    if (hash(bytes) !== record.outputHash) throw new Error(`Build media changed: ${url}`);
    if (/\.(webp|png|svg)$/.test(url) && bytes.length > MAX_ART_BYTES)
      throw new Error(`Prepared artwork exceeds 3 MiB: ${url}`);
    total += bytes.length;
  }
  if (total > MAX_MEDIA_BYTES)
    throw new Error("Prepared media exceeds 128 MiB; investigate growth before raising the budget.");
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
      for (const file of inventory(receipt)) {
        const source = await readFile(path.join(repository, "public", file));
        const record = Object.values(receipt.records).find((item) => item.url.slice(2) === file);
        if (hash(source) !== record.outputHash)
          throw new Error(`Prepared asset changed during build: ${file}`);
        this.emitFile({ type: "asset", fileName: file, source });
      }
      this.emitFile({
        type: "asset",
        fileName: "prepared/manifest.json",
        source: JSON.stringify(receipt, null, 2) + "\n",
      });
    },
    async writeBundle(options) {
      await verifyAssetBundle(path.resolve(repository, options.dir), receipt);
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error("Usage: npm run assets:check:bundle");
  const result = await verifyAssetBundle(path.join(ROOT, "dist"), await assets());
  console.log(
    `Build media: ${result.files} active files; ${(result.bytes / 1048576).toFixed(2)} MiB; 128 MiB limit.`,
  );
}

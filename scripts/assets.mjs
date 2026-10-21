import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename, realpath, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
export const hash = (data) => createHash("sha256").update(data).digest("hex");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function imageDimensions(bytes, extension) {
  if (
    extension === ".png" &&
    bytes.length >= 33 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.readUInt32BE(8) === 13 &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  ) {
    const width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20);
    if (width && height) return [width, height];
  }
  if (extension === ".svg") {
    const source = bytes.toString();
    const view = source.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
    if (view) return [Number(view[1]), Number(view[2])];
    const width = source.match(/\bwidth=["']([\d.]+)/),
      height = source.match(/\bheight=["']([\d.]+)/);
    if (width && height) return [Number(width[1]), Number(height[1])];
  }
  if (
    extension === ".webp" &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const type = bytes.toString("ascii", 12, 16);
    if (type === "VP8X") return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (type === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    if (type === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
  }
  throw new Error(`Unsupported or corrupt image ${extension}`);
}
function safeRelative(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\\") &&
    !path.isAbsolute(value) &&
    value.split("/").every((part) => part && part !== "." && part !== "..")
  );
}
export function validateManifest(manifest) {
  if (manifest.version !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length)
    throw new Error("Invalid asset manifest.");
  const ids = new Set(),
    outputs = new Set();
  for (const entry of manifest.assets) {
    if (
      !/^[a-z0-9.-]+$/.test(entry.id) ||
      ids.has(entry.id) ||
      !safeRelative(entry.output) ||
      outputs.has(entry.output.toLowerCase()) ||
      !safeRelative(entry.source) ||
      !["repository", "library"].includes(entry.origin) ||
      entry.recipe !== "copy" ||
      !["art", "sound", "music", "interface"].includes(entry.kind) ||
      !entry.provenance ||
      !entry.rights
    )
      throw new Error(`Invalid or duplicate selection: ${entry.id}`);
    if (path.extname(entry.source) !== path.extname(entry.output))
      throw new Error(`Copy recipe cannot convert ${entry.id}`);
    ids.add(entry.id);
    outputs.add(entry.output.toLowerCase());
  }
}
function checkBytes(entry, bytes) {
  if (!bytes.length) throw new Error(`Empty source ${entry.id}`);
  if (entry.kind === "art" || entry.kind === "interface") {
    const [width, height] = imageDimensions(bytes, path.extname(entry.output));
    if (entry.aspect && Math.abs(width / height - entry.aspect[0] / entry.aspect[1]) > 0.005)
      throw new Error(`Aspect ratio mismatch for ${entry.id}: ${width}x${height}`);
  } else {
    const ext = path.extname(entry.output);
    if (
      (ext === ".wav" &&
        !(bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE")) ||
      (ext === ".ogg" && bytes.toString("ascii", 0, 4) !== "OggS") ||
      (ext === ".mp3" &&
        !(bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224))) ||
      ![".wav", ".ogg", ".mp3"].includes(ext)
    )
      throw new Error(`Invalid audio header ${entry.id}`);
  }
}
async function readSource(entry, repository, library) {
  const base = await realpath(entry.origin === "repository" ? repository : library);
  const source = await realpath(path.join(base, entry.source));
  if (!source.startsWith(base + path.sep) || !(await stat(source)).isFile())
    throw new Error(`Source escapes library: ${entry.id}`);
  const bytes = await readFile(source);
  checkBytes(entry, bytes);
  return bytes;
}
export async function assets({
  repository = root,
  library = process.env.ASSET_LIBRARY_ROOT ?? path.join(os.homedir(), "Documents", "Asset Library"),
  mode = "outputs",
} = {}) {
  const manifest = JSON.parse(await readFile(path.join(repository, "assets/manifest.json"), "utf8"));
  validateManifest(manifest);
  const manifestHash = hash(JSON.stringify(manifest));
  const pointer = path.join(repository, "src/assets/prepared.json");
  if (mode === "prepare") {
    // Validate every source before publishing an immutable generation. The pointer
    // switches only after the full generation is durable; old generations remain.
    const prepared = [];
    for (const entry of manifest.assets) {
      const bytes = await readSource(entry, repository, library);
      prepared.push({ entry, bytes, sourceHash: hash(bytes) });
    }
    const generation = hash(
      JSON.stringify({ manifestHash, sources: prepared.map(({ sourceHash }) => sourceHash) }),
    );
    const directory = path.join(repository, "public/prepared", generation);
    await mkdir(directory, { recursive: true });
    const records = {};
    for (const { entry, bytes, sourceHash } of prepared) {
      const output = path.join(directory, entry.output);
      await mkdir(path.dirname(output), { recursive: true });
      let existing;
      try {
        existing = await readFile(output);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (existing && hash(existing) !== sourceHash)
        throw new Error(`Corrupt immutable generation ${entry.id}; previous pointer preserved.`);
      if (!existing) {
        const temporary = `${output}.${randomUUID()}.tmp`;
        await writeFile(temporary, bytes, { flag: "wx", flush: true });
        await rename(temporary, output);
      }
      records[entry.id] = {
        url: `./prepared/${generation}/${entry.output}`,
        sourceHash,
        outputHash: sourceHash,
      };
    }
    await mkdir(path.dirname(pointer), { recursive: true });
    const temporary = `${pointer}.${randomUUID()}.tmp`;
    await writeFile(
      temporary,
      JSON.stringify({ version: 1, manifestHash, generation, records }, null, 2) + "\n",
      { flag: "wx", flush: true },
    );
    await rename(temporary, pointer);
  }
  const receipt = JSON.parse(await readFile(pointer, "utf8"));
  if (
    receipt.version !== 1 ||
    receipt.manifestHash !== manifestHash ||
    !/^[a-f0-9]{64}$/.test(receipt.generation) ||
    Object.keys(receipt.records).length !== manifest.assets.length
  )
    throw new Error("Prepared asset manifest is stale; run npm run assets:prepare.");
  if (
    hash(
      JSON.stringify({
        manifestHash,
        sources: manifest.assets.map((entry) => receipt.records[entry.id]?.sourceHash),
      }),
    ) !== receipt.generation
  )
    throw new Error("Prepared generation identity mismatch.");
  for (const entry of manifest.assets) {
    const record = receipt.records[entry.id];
    if (
      !record ||
      record.url !== `./prepared/${receipt.generation}/${entry.output}` ||
      record.sourceHash !== record.outputHash
    )
      throw new Error(`Invalid preparation record ${entry.id}`);
    const bytes = await readFile(path.join(repository, "public", record.url.slice(2)));
    checkBytes(entry, bytes);
    if (hash(bytes) !== record.outputHash) throw new Error(`Prepared output changed: ${entry.id}`);
    if (mode === "sources" && hash(await readSource(entry, repository, library)) !== record.sourceHash)
      throw new Error(`Source changed: ${entry.id}`);
  }
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const flag = process.argv[2] ?? "--outputs";
  if (!["--prepare", "--sources", "--outputs"].includes(flag) || process.argv.length > 3)
    throw new Error("Use --prepare, --sources, or --outputs.");
  const receipt = await assets({ mode: flag.slice(2) });
  console.log(`Assets ${flag}: ${Object.keys(receipt.records).length} selections verified.`);
}

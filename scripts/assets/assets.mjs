import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename, realpath, stat, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { recipeSettings, prepareBytes, rasterMetadata } from "./art-recipes.mjs";
export const hash = (data) => createHash("sha256").update(data).digest("hex");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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
  if (manifest.version !== 2 || !Array.isArray(manifest.assets) || !manifest.assets.length)
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
      !["copy", "card-webp"].includes(entry.recipe) ||
      !["art", "sound", "music", "interface"].includes(entry.kind) ||
      !entry.provenance ||
      !entry.rights
    )
      throw new Error(`Invalid or duplicate selection: ${entry.id}`);
    if (
      entry.aspect &&
      (!Array.isArray(entry.aspect) ||
        entry.aspect.length !== 2 ||
        !entry.aspect.every((value) => Number.isFinite(value) && value > 0))
    )
      throw new Error(`Invalid aspect ratio ${entry.id}`);
    if (
      entry.recipe === "card-webp" &&
      (entry.kind !== "art" ||
        ![".png", ".webp"].includes(path.extname(entry.source)) ||
        path.extname(entry.output) !== ".webp")
    )
      throw new Error(`Invalid artwork recipe ${entry.id}`);
    if (entry.recipe === "copy" && path.extname(entry.source) !== path.extname(entry.output))
      throw new Error(`Copy recipe cannot convert ${entry.id}`);
    ids.add(entry.id);
    outputs.add(entry.output.toLowerCase());
  }
}
async function checkBytes(entry, bytes, extension = path.extname(entry.output)) {
  if (!bytes.length) throw new Error(`Empty source ${entry.id}`);
  if (entry.kind === "art" || entry.kind === "interface") {
    const [width, height] = imageDimensions(bytes, extension);
    if (![width, height].every((value) => Number.isFinite(value) && value > 0))
      throw new Error(`Invalid image dimensions ${entry.id}`);
    if (entry.aspect && Math.abs(width / height - entry.aspect[0] / entry.aspect[1]) > 0.005)
      throw new Error(`Aspect ratio mismatch for ${entry.id}: ${width}x${height}`);
    if (extension !== ".svg") return rasterMetadata(bytes);
    return { width, height };
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
  await checkBytes(entry, bytes, path.extname(entry.source));
  return bytes;
}
async function installImmutable(filename, bytes) {
  await mkdir(path.dirname(filename), { recursive: true });
  try {
    if (hash(await readFile(filename)) !== hash(bytes))
      throw new Error(`Corrupt immutable output ${filename}; previous pointer preserved.`);
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: "wx", flush: true });
    await rename(temporary, filename);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function validateOutput(entry, record, repository) {
  const bytes = await readFile(path.join(repository, "public", record.url.slice(2)));
  if (hash(bytes) !== record.outputHash || bytes.length !== record.outputBytes)
    throw new Error(`Prepared output changed: ${entry.id}`);
  const geometry = await checkBytes(entry, bytes);
  if (
    geometry &&
    (record.width !== geometry.width || record.height !== geometry.height || record.alpha !== geometry.alpha)
  )
    throw new Error(`Prepared geometry changed: ${entry.id}`);
}

async function validateReceipt(manifest, receipt, repository) {
  const manifestHash = hash(JSON.stringify(manifest));
  if (
    receipt.version !== 2 ||
    receipt.manifestHash !== manifestHash ||
    !receipt.records ||
    Object.keys(receipt.records).length !== manifest.assets.length ||
    receipt.generation !== hash(JSON.stringify({ manifestHash, records: receipt.records }))
  )
    throw new Error("Prepared asset manifest is stale; run npm run assets:prepare.");
  for (const entry of manifest.assets) {
    const record = Object.hasOwn(receipt.records, entry.id) ? receipt.records[entry.id] : undefined;
    if (
      !record ||
      !/^[a-f0-9]{64}$/.test(record.sourceHash) ||
      !/^[a-f0-9]{64}$/.test(record.recipeHash) ||
      !/^[a-f0-9]{64}$/.test(record.outputHash) ||
      !Number.isSafeInteger(record.sourceBytes) ||
      record.sourceBytes <= 0 ||
      !Number.isSafeInteger(record.outputBytes) ||
      record.outputBytes <= 0
    )
      throw new Error(`Invalid preparation record ${entry.id}`);
    // Encoder versions are recorded in recipeHash on preparation. Output-only
    // checks need no matching native encoder version, but recipe changes must fail.
    const key = hash(
      JSON.stringify({
        sourceHash: record.sourceHash,
        recipeHash: record.recipeHash,
        extension: path.extname(entry.output),
      }),
    );
    if (
      record.url !== `./prepared/objects/${key}/asset${path.extname(entry.output)}` ||
      record.recipe !== entry.recipe ||
      record.settingsHash !== hash(JSON.stringify(recipeContract(entry)))
    )
      throw new Error(`Prepared recipe changed: ${entry.id}`);
    await validateOutput(entry, record, repository);
  }
}

function recipeContract(entry) {
  const settings = { ...recipeSettings(entry) };
  delete settings.encoder;
  return settings;
}

// Per-checkout admission prevents an older concurrent preparation from publishing
// after a newer one. The OS releases the listener on crash; no stale lock files.
export async function assets(options = {}) {
  if (options.mode !== "prepare") return runAssets(options);
  const repository = await realpath(options.repository ?? root);
  const port =
    10000 + (createHash("sha256").update(`fauna-assets:${repository}`).digest().readUInt32BE(0) % 50000);
  const server = net.createServer((socket) => socket.destroy());
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
    });
  } catch (error) {
    if (error.code === "EADDRINUSE")
      throw new Error("Asset preparation is occupied; retry after its owner finishes.");
    throw error;
  }
  try {
    return await runAssets({ ...options, repository });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function runAssets({
  repository = root,
  library = process.env.ASSET_LIBRARY_ROOT ?? path.join(os.homedir(), "Documents", "Asset Library"),
  mode = "outputs",
} = {}) {
  const manifest = JSON.parse(await readFile(path.join(repository, "assets/manifest.json"), "utf8"));
  validateManifest(manifest);
  const manifestHash = hash(JSON.stringify(manifest));
  const pointer = path.join(repository, "src/assets/prepared.json");
  if (!["prepare", "sources", "outputs"].includes(mode)) throw new Error("Invalid asset mode.");
  if (mode === "prepare") {
    // Preflight the entire selection before installing objects. The runtime
    // pointer is the only publication boundary and always switches last.
    const selections = [];
    for (const entry of manifest.assets) {
      const bytes = await readSource(entry, repository, library);
      selections.push({ entry, bytes });
    }
    const records = {};
    let cacheHits = 0;
    for (const { entry, bytes } of selections) {
      const sourceHash = hash(bytes);
      const settings = recipeSettings(entry);
      const recipeHash = hash(JSON.stringify(settings));
      const key = hash(JSON.stringify({ sourceHash, recipeHash, extension: path.extname(entry.output) }));
      const url = `./prepared/objects/${key}/asset${path.extname(entry.output)}`;
      const output = path.join(repository, "public", url.slice(2));
      const cache = path.join(path.dirname(output), "receipt.json");
      let cached;
      try {
        cached = JSON.parse(await readFile(cache, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      let record;
      if (cached) {
        if (cached.sourceHash !== sourceHash || cached.recipeHash !== recipeHash || cached.url !== url)
          throw new Error(`Invalid cached receipt ${entry.id}`);
        await validateOutput(entry, cached, repository);
        record = cached;
        cacheHits++;
      } else {
        const outputBytes = await prepareBytes(entry, bytes);
        const geometry = await checkBytes(entry, outputBytes);
        record = {
          url,
          sourceHash,
          recipeHash,
          recipe: entry.recipe,
          settingsHash: hash(JSON.stringify(recipeContract(entry))),
          outputHash: hash(outputBytes),
          sourceBytes: bytes.length,
          outputBytes: outputBytes.length,
          ...geometry,
        };
        await installImmutable(output, outputBytes);
        await installImmutable(cache, Buffer.from(JSON.stringify(record, null, 2) + "\n"));
      }
      records[entry.id] = record;
    }
    const generation = hash(JSON.stringify({ manifestHash, records }));
    const receipt = { version: 2, manifestHash, generation, records };
    // Verify every installed output before the atomic pointer replacement.
    await validateReceipt(manifest, receipt, repository);
    await mkdir(path.dirname(pointer), { recursive: true });
    const temporary = `${pointer}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", flush: true });
      if (
        hash(
          JSON.stringify(JSON.parse(await readFile(path.join(repository, "assets/manifest.json"), "utf8"))),
        ) !== manifestHash
      )
        throw new Error("Asset selection changed during preparation; previous pointer preserved.");
      await rename(temporary, pointer);
    } finally {
      await rm(temporary, { force: true });
    }
    console.log(
      `Prepared ${selections.length} selections; ${cacheHits} cache hits; ${selections.length - cacheHits} encoded/copied.`,
    );
  }
  const receipt = JSON.parse(await readFile(pointer, "utf8"));
  await validateReceipt(manifest, receipt, repository);
  if (mode === "sources") {
    for (const entry of manifest.assets) {
      if (hash(await readSource(entry, repository, library)) !== receipt.records[entry.id].sourceHash)
        throw new Error(`Source changed: ${entry.id}`);
    }
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

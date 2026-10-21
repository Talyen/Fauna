import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from "node:fs/promises";
import sharp from "sharp";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { assets, validateManifest, imageDimensions } from "../../scripts/assets.mjs";
it("preserves the published generation after a missing or invalid source and detects changed bytes", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "fauna-assets-"));
  try {
    await mkdir(path.join(repository, "assets"));
    const entry = {
      id: "creature.test",
      origin: "repository",
      source: "source.svg",
      output: "test.svg",
      kind: "art",
      aspect: [4, 3],
      recipe: "copy",
      provenance: "fixture",
      rights: "test",
    };
    const manifest = { version: 2, assets: [entry] };
    await writeFile(path.join(repository, "assets/manifest.json"), JSON.stringify(manifest));
    await writeFile(path.join(repository, "source.svg"), '<svg viewBox="0 0 800 600"/>');
    const original = await assets({ repository, mode: "prepare" });
    const pointer = await readFile(path.join(repository, "src/assets/prepared.json"), "utf8");
    await rm(path.join(repository, "source.svg"));
    await expect(assets({ repository, mode: "prepare" })).rejects.toThrow();
    expect(await readFile(path.join(repository, "src/assets/prepared.json"), "utf8")).toBe(pointer);
    expect(await assets({ repository })).toEqual(original);
    await writeFile(path.join(repository, "source.svg"), '<svg viewBox="0 0 800 800"/>');
    await expect(assets({ repository, mode: "prepare" })).rejects.toThrow("Aspect ratio");
    await writeFile(
      path.join(repository, "public", original.records[entry.id].url.slice(2)),
      '<svg viewBox="0 0 800 600">changed</svg>',
    );
    await expect(assets({ repository })).rejects.toThrow("changed");
    expect(() =>
      validateManifest({ ...manifest, assets: [entry, { ...entry, id: "other", output: "TEST.svg" }] }),
    ).toThrow("duplicate");
    expect(() =>
      validateManifest({ ...manifest, assets: [{ ...entry, source: "../elsewhere.svg" }] }),
    ).toThrow();
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

it("reads native PNG dimensions and rejects truncated or invalid PNG headers", async () => {
  const bytes = await readFile(new URL("../../public/art/emberback/emberback.png", import.meta.url));
  expect(imageDimensions(bytes, ".png")).toEqual([1448, 1086]);
  expect(() => imageDimensions(bytes.subarray(0, 24), ".png")).toThrow();
  const invalid = Buffer.from(bytes);
  invalid.writeUInt32BE(0, 16);
  expect(() => imageDimensions(invalid, ".png")).toThrow();
});

it("caches unchanged objects, publishes all selections atomically, and preserves originals and old objects", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "fauna-cache-"));
  try {
    await mkdir(path.join(repository, "assets"));
    const entry = {
      id: "creature.one",
      origin: "repository",
      source: "one.svg",
      output: "one.svg",
      recipe: "copy",
      kind: "art",
      aspect: [4, 3],
      provenance: "fixture",
      rights: "test",
    };
    const second = { ...entry, id: "creature.two", source: "two.svg", output: "two.svg" };
    await writeFile(
      path.join(repository, "assets/manifest.json"),
      JSON.stringify({ version: 2, assets: [entry, second] }),
    );
    const original = '<svg viewBox="0 0 800 600"/>';
    await writeFile(path.join(repository, "one.svg"), original);
    await writeFile(path.join(repository, "two.svg"), original);
    const first = await assets({ repository, mode: "prepare" });
    const url = first.records[entry.id].url;
    const output = path.join(repository, "public", url.slice(2));
    const before = await stat(output);
    expect(await assets({ repository, mode: "prepare" })).toEqual(first);
    expect((await stat(output)).mtimeMs).toBe(before.mtimeMs);
    await writeFile(path.join(repository, "two.svg"), '<svg viewBox="0 0 1600 1200"/>');
    const next = await assets({ repository, mode: "prepare" });
    expect(next.generation).not.toBe(first.generation);
    expect(next.records[entry.id].url).toBe(url);
    expect(await readFile(output, "utf8")).toBe(original);
    expect(await readFile(path.join(repository, "one.svg"), "utf8")).toBe(original);
    const pointer = await readFile(path.join(repository, "src/assets/prepared.json"), "utf8");
    await writeFile(output, '<svg viewBox="0 0 400 300"/>');
    await expect(assets({ repository, mode: "prepare" })).rejects.toThrow("changed");
    expect(await readFile(path.join(repository, "src/assets/prepared.json"), "utf8")).toBe(pointer);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

it("encodes retina-sized artwork without cropping, enlargement, alpha loss or lossy compression", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "fauna-retina-"));
  try {
    await mkdir(path.join(repository, "assets"));
    const entry = {
      id: "creature.test",
      origin: "repository",
      source: "source.png",
      output: "test.webp",
      kind: "art",
      aspect: [4, 3],
      recipe: "card-webp",
      provenance: "fixture",
      rights: "test",
    };
    await writeFile(
      path.join(repository, "assets/manifest.json"),
      JSON.stringify({ version: 2, assets: [entry] }),
    );
    const pixels = Buffer.alloc(1600 * 1200 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      const x = (i / 4) % 1600,
        y = Math.floor(i / 4 / 1600);
      pixels[i] = x % 80 < 40 ? 230 : 20;
      pixels[i + 1] = y % 80 < 40 ? 180 : 60;
      pixels[i + 2] = 140;
      pixels[i + 3] = x < 40 ? 0 : 255;
    }
    const png = await sharp(pixels, { raw: { width: 1600, height: 1200, channels: 4 } })
      .png()
      .toBuffer();
    await writeFile(path.join(repository, "source.png"), png);
    const receipt = await assets({ repository, mode: "prepare" });
    const record = receipt.records[entry.id];
    expect([record.width, record.height, record.alpha]).toEqual([960, 720, true]);
    const prepared = await readFile(path.join(repository, "public", record.url.slice(2)));
    const expected = await sharp(png)
      .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer();
    // Fully transparent pixels have no visible RGB meaning; compare flattened pixels.
    const expectedVisible = await sharp(expected, { raw: { width: 960, height: 720, channels: 4 } })
      .flatten({ background: "#11100f" })
      .raw()
      .toBuffer();
    expect(
      (await sharp(prepared).flatten({ background: "#11100f" }).raw().toBuffer()).equals(expectedVisible),
    ).toBe(true);
    expect(await readFile(path.join(repository, "source.png"))).toEqual(png);
    await writeFile(path.join(repository, "source.png"), await sharp(png).resize(400, 300).png().toBuffer());
    const small = (await assets({ repository, mode: "prepare" })).records[entry.id];
    expect([small.width, small.height]).toEqual([400, 300]);
    const pointer = await readFile(path.join(repository, "src/assets/prepared.json"), "utf8");
    await writeFile(path.join(repository, "source.png"), png.subarray(0, 60));
    await expect(assets({ repository, mode: "prepare" })).rejects.toThrow();
    expect(await readFile(path.join(repository, "src/assets/prepared.json"), "utf8")).toBe(pointer);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

it("rejects overlapping preparation and invalidates changed recipes without losing old objects", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "fauna-asset-admission-"));
  try {
    await mkdir(path.join(repository, "assets"));
    const entry = {
      id: "creature.one",
      origin: "repository",
      source: "one.png",
      output: "one.png",
      kind: "art",
      recipe: "copy",
      aspect: [4, 3],
      provenance: "fixture",
      rights: "test",
    };
    const manifestPath = path.join(repository, "assets/manifest.json");
    await writeFile(manifestPath, JSON.stringify({ version: 2, assets: [entry] }));
    await writeFile(
      path.join(repository, entry.source),
      await sharp({ create: { width: 400, height: 300, channels: 4, background: "#aabbcc" } })
        .png()
        .toBuffer(),
    );
    const results = await Promise.allSettled([
      assets({ repository, mode: "prepare" }),
      assets({ repository, mode: "prepare" }),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.find((item) => item.status === "rejected").reason.message).toContain("occupied");
    const original = results.find((item) => item.status === "fulfilled").value;
    await writeFile(
      manifestPath,
      JSON.stringify({ version: 2, assets: [{ ...entry, recipe: "card-webp", output: "one.webp" }] }),
    );
    await expect(assets({ repository })).rejects.toThrow("stale");
    const next = await assets({ repository, mode: "prepare" });
    expect(next.records[entry.id].url).not.toBe(original.records[entry.id].url);
    expect(await readFile(path.join(repository, "public", original.records[entry.id].url.slice(2)))).toEqual(
      await readFile(path.join(repository, entry.source)),
    );
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

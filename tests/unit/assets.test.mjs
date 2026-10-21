import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
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
    const manifest = { version: 1, assets: [entry] };
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

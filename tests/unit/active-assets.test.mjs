import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { assets } from "../../scripts/assets.mjs";
import { activeAssetsPlugin, verifyAssetBundle } from "../../scripts/active-assets.mjs";

it("emits exactly the active inventory without originals, old generations, receipts or a source library", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "fauna-build-assets-"));
  try {
    await mkdir(path.join(repository, "assets"));
    const entry = {
      id: "creature.one",
      origin: "repository",
      source: "original.svg",
      output: "one.svg",
      kind: "art",
      aspect: [4, 3],
      recipe: "copy",
      provenance: "fixture",
      rights: "test",
    };
    await writeFile(
      path.join(repository, "assets/manifest.json"),
      JSON.stringify({ version: 2, assets: [entry] }),
    );
    await writeFile(path.join(repository, entry.source), '<svg viewBox="0 0 800 600"/>');
    await assets({ repository, mode: "prepare" });
    await writeFile(path.join(repository, entry.source), '<svg viewBox="0 0 1600 1200"/>');
    const receipt = await assets({ repository, mode: "prepare" });
    await rm(path.join(repository, entry.source));
    const dist = path.join(repository, "dist");
    await mkdir(dist);
    const plugin = activeAssetsPlugin(repository);
    await plugin.buildStart();
    const emitted = [];
    await plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) });
    expect(emitted.map((file) => file.fileName).sort()).toEqual(
      [receipt.records[entry.id].url.slice(2), "prepared/manifest.json"].sort(),
    );
    for (const { fileName, source } of emitted) {
      await mkdir(path.dirname(path.join(dist, fileName)), { recursive: true });
      await writeFile(path.join(dist, fileName), source);
    }
    await plugin.writeBundle({ dir: dist });
    expect((await verifyAssetBundle(dist, receipt)).files).toBe(1);
    await mkdir(path.join(dist, "prepared/old-generation"));
    const extra = path.join(dist, "prepared/old-generation/original.svg");
    await writeFile(extra, "extra");
    await expect(verifyAssetBundle(dist, receipt)).rejects.toThrow("inventory");
    await rm(path.dirname(extra), { recursive: true });
    const output = path.join(dist, receipt.records[entry.id].url.slice(2));
    await writeFile(output, "corrupt");
    await expect(verifyAssetBundle(dist, receipt)).rejects.toThrow("changed");
    await writeFile(
      output,
      await readFile(path.join(repository, "public", receipt.records[entry.id].url.slice(2))),
    );
    await mkdir(path.join(dist, "art"));
    await expect(verifyAssetBundle(dist, receipt)).rejects.toThrow("unapproved");
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

it("refuses a lookup changed during bundling", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "fauna-build-race-"));
  try {
    await mkdir(path.join(repository, "assets"));
    const entry = {
      id: "creature.one",
      origin: "repository",
      source: "original.svg",
      output: "one.svg",
      kind: "art",
      aspect: [4, 3],
      recipe: "copy",
      provenance: "fixture",
      rights: "test",
    };
    await writeFile(
      path.join(repository, "assets/manifest.json"),
      JSON.stringify({ version: 2, assets: [entry] }),
    );
    await writeFile(path.join(repository, entry.source), '<svg viewBox="0 0 800 600"/>');
    await assets({ repository, mode: "prepare" });
    const plugin = activeAssetsPlugin(repository);
    await plugin.buildStart();
    await writeFile(path.join(repository, entry.source), '<svg viewBox="0 0 1600 1200"/>');
    await assets({ repository, mode: "prepare" });
    await expect(plugin.generateBundle.call({ emitFile() {} })).rejects.toThrow("during build");
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

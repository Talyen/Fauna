import { mkdtemp, mkdir, writeFile, readFile, rm, stat, unlink, realpath } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import { getNodeModuleFileMatcher } from "app-builder-lib/out/fileMatcher.js";
import { mediaInventory, evidenceDuplicates } from "../../../scripts/resources.mjs";
import { assets } from "../../../scripts/assets/assets.mjs";
import { pruneAssets } from "../../../scripts/assets/prune-assets.mjs";
import { activeAssetsPlugin } from "../../../scripts/assets/active-assets.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";
import { shareDependencies } from "../../../scripts/dependencies.mjs";
import { verifyDesktopDependencies } from "../../../scripts/release/verify-package.mjs";

const configuration = JSON.parse(
  await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
).build;
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fauna-resources-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  git("init", "-qb", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  await writeFile(path.join(root, ".gitignore"), "node_modules\n.worktrees/\nreports/\n");
  return { root, git };
}
async function imageFixture(root) {
  await mkdir(path.join(root, "assets"));
  const entry = {
    id: "image.one",
    origin: "repository",
    source: "one.svg",
    output: "one.svg",
    recipe: "copy",
    kind: "art",
    rights: "fixture",
    provenance: "fixture",
  };
  await writeFile(path.join(root, "assets/manifest.json"), JSON.stringify({ version: 2, assets: [entry] }));
  await writeFile(path.join(root, "one.svg"), '<svg viewBox="0 0 800 600"/>');
  return assets({ repository: root, mode: "prepare" });
}

it("counts shared media URLs once and keeps pixel estimates separate from measured RAM", () => {
  const shared = { url: "./prepared/shared.webp", outputBytes: 20, width: 10, height: 5 };
  expect(
    mediaInventory({
      records: { first: shared, alias: shared, audio: { url: "./prepared/music.mp3", outputBytes: 30 } },
    }),
  ).toMatchObject({ ids: 3, files: 2, bytes: 50, nominalRgbaBytes: 200 });
});

it("plans byte-identical bulk evidence without deleting files, small summaries or explicit retention keeps", async () => {
  const { root } = await fixture();
  try {
    const first = path.join(root, "first"),
      second = path.join(root, "second"),
      kept = path.join(root, "kept");
    for (const directory of [first, second, kept]) {
      await mkdir(directory);
      await writeFile(path.join(directory, "capture.bin"), Buffer.alloc(65536, 7));
      await writeFile(path.join(directory, "summary.json"), "{}");
    }
    await writeFile(path.join(kept, ".retention-keep"), "");
    const report = await evidenceDuplicates([first, second, kept]);
    expect(report.groups).toHaveLength(1);
    expect(report.duplicateLogicalBytes).toBe(65536);
    expect(report.groups[0].retained.file).toBe(path.join(first, "capture.bin"));
    expect(report.groups[0].duplicates.map((entry) => entry.file)).toEqual([
      path.join(second, "capture.bin"),
    ]);
    expect((await stat(path.join(second, "capture.bin"))).size).toBe(65536);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("uses the installed packager's filter to retain native dependencies and exclude bundled renderer modules", async () => {
  expect(() =>
    verifyDesktopDependencies([
      "node_modules/@koromix/",
      "node_modules/@koromix/koffi-win32-x64/",
      "node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node",
      "node_modules/koffi/index.cjs",
      "node_modules/steamworks.js/index.js",
    ]),
  ).not.toThrow();
  for (const name of ["react/index.js", "@radix-ui/react-dialog/index.js"])
    expect(() => verifyDesktopDependencies([`node_modules/${name}`])).toThrow(
      "Unexpected desktop dependency",
    );
  const { root } = await fixture();
  try {
    const matcher = getNodeModuleFileMatcher(
      root,
      path.join(root, "out"),
      (value) => value,
      {},
      { config: configuration, debugLogger: { isEnabled: false } },
    );
    const filter = matcher.createFilter();
    for (const [name, included] of [
      ["steamworks.js/index.js", true],
      ["koffi/index.cjs", true],
      ["@koromix/koffi-win32-x64/win32_x64/koffi.node", true],
      ["react/index.js", false],
      ["lucide-react/dist/cjs/lucide-react.js", false],
      ["@radix-ui/react-dialog/dist/index.js", false],
      ["zod/index.js", false],
    ]) {
      const file = path.join(root, "node_modules", name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "fixture");
      expect(filter(file, await stat(file)), name).toBe(included);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("copies media without bundler buffers and refuses corrupt copied bytes before publishing a receipt", async () => {
  const { root } = await fixture();
  try {
    const receipt = await imageFixture(root);
    const plugin = activeAssetsPlugin(root);
    await plugin.buildStart();
    await plugin.generateBundle();
    const source = path.join(root, "public", receipt.records["image.one"].url.slice(2));
    await writeFile(source, "corrupt");
    const directory = path.join(root, "dist");
    await expect(plugin.writeBundle({ dir: directory })).rejects.toThrow("changed during build");
    await expect(stat(path.join(directory, "prepared/manifest.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("prunes only unreferenced old objects while retaining active media, originals and unknown files", async () => {
  const { root } = await fixture();
  try {
    const original = await imageFixture(root);
    const old = original.records["image.one"].url.split("/")[3];
    await writeFile(path.join(root, "one.svg"), '<svg viewBox="0 0 1600 1200"/>');
    const current = await assets({ repository: root, mode: "prepare" });
    await writeFile(path.join(root, "notes.md"), `Retain ${old}`);
    expect((await pruneAssets(root)).preserved).toContain(old);
    await rm(path.join(root, "notes.md"));
    const extra = "a".repeat(64);
    await mkdir(path.join(root, "public/prepared/objects", extra));
    await writeFile(path.join(root, "public/prepared/objects", extra, "unique.txt"), "preserve");
    const planned = await pruneAssets(root);
    expect(planned.candidates.map((entry) => entry.object)).toEqual([old]);
    expect(planned.preserved).toContain(extra);
    await pruneAssets(root, { apply: true });
    await expect(stat(path.join(root, "public/prepared/objects", old))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(path.join(root, "one.svg"), "utf8")).toContain("1600 1200");
    expect(
      await readFile(path.join(root, "public", current.records["image.one"].url.slice(2)), "utf8"),
    ).toContain("1600 1200");
    expect(await readFile(path.join(root, "public/prepared/objects", extra, "unique.txt"), "utf8")).toBe(
      "preserve",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("reattaches only matching task dependencies and preserves a private install when definitions differ", async () => {
  const { root, git } = await fixture();
  try {
    const manifest = JSON.stringify({ dependencies: { example: "1.0.0" } });
    await writeFile(path.join(root, "package.json"), manifest);
    await writeFile(path.join(root, "package-lock.json"), "{}");
    await mkdir(path.join(root, "node_modules/example"), { recursive: true });
    await writeFile(
      path.join(root, "node_modules/example/package.json"),
      JSON.stringify({ version: "1.0.0" }),
    );
    git("add", ".");
    git("commit", "-m", "fixture");
    const task = createWorktree(root, "sharing").path;
    const modules = path.join(task, "node_modules");
    await unlink(modules);
    await mkdir(modules);
    await writeFile(path.join(modules, "private"), "preserve until shared");
    await writeFile(path.join(task, "package.json"), "{}");
    expect(() => shareDependencies(task)).toThrow("do not match");
    expect(await readFile(path.join(modules, "private"), "utf8")).toBe("preserve until shared");
    await writeFile(path.join(task, "package.json"), manifest);
    shareDependencies(task);
    expect(await realpath(modules)).toBe(await realpath(path.join(root, "node_modules")));
    expect(
      JSON.parse(await readFile(path.join(root, "node_modules/example/package.json"), "utf8")).version,
    ).toBe("1.0.0");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

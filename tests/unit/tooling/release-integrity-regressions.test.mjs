import { expect, it } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { temporaryDirectory, put, repository, git } from "../../support/tooling.mjs";
import { verifyBuildIdentity } from "../../../scripts/lib/release-identity.mjs";
import { fileHash } from "../../../scripts/lib/file-integrity.mjs";
import { notesArgs, generatePatchNotes } from "../../../scripts/release/generate-patch-notes.mjs";
import {
  dependencyNotices,
  generateInventory,
  packageInventory,
} from "../../../scripts/release/dependency-inventory.mjs";
import { verifyArchive, verifyPE, verifyWindowsRuntime } from "../../../scripts/release/verify-package.mjs";

it("rejects absent or malformed build versions even when both records agree", () => {
  const valid = {
    format: 1,
    name: "fauna",
    version: "1.2.3",
    commit: "a".repeat(40),
    tree: "b".repeat(40),
    dirty: false,
  };
  expect(() => verifyBuildIdentity(valid, valid)).not.toThrow();
  for (const version of [undefined, null, "", "1.2", "01.2.3", "1.2.3\n"])
    expect(() => verifyBuildIdentity({ ...valid, version }, { ...valid, version })).toThrow("stale");
  for (const patch of [{ name: "other" }, { format: 2 }])
    expect(() => verifyBuildIdentity(valid, { ...valid, ...patch })).toThrow("stale");
});

it("uses the release version grammar for explicit note tags", () => {
  for (const tag of ["v1.2.3", "v0.0.0", "v1.2.3-beta.1"]) expect(notesArgs(["--tag", tag]).tag).toBe(tag);
  for (const tag of ["v01.2.3", "v1.2.3-01", "v1.2.3-alpha..1", "v1.2.3-", "v1.2.3\n"])
    expect(() => notesArgs(["--tag", tag])).toThrow("Invalid release tag");
});

it("does not let malformed version tags hide player notes", () => {
  const root = repository({ "src/game/example.ts": "initial" }, "fauna-note-tags-");
  git(root, "tag", "v1.0.0");
  put(root, "src/game/example.ts", "first");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fix: preserve rewards");
  git(root, "tag", "v01.1.0");
  put(root, "src/game/example.ts", "second");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fix: preserve progress");
  const result = generatePatchNotes(root);
  expect(result.base).toBe("v1.0.0");
  expect(result.markdown).toContain("Preserve rewards");
  expect(result.markdown).toContain("Preserve progress");
});

const bundledLicenses = [
  "SHADCN-LICENSE.txt",
  "FONT-LICENSE.txt",
  "NOTO-SANS-LICENSE.txt",
  "NOTO-SANS-JP-LICENSE.txt",
  "NOTO-SANS-SC-LICENSE.txt",
];
function noticesFixture(
  location = "node_modules/example",
  name = "example",
  root = temporaryDirectory("fauna-inventory-validation-"),
) {
  for (const file of bundledLicenses) put(root, `Docs/${file}`, "Copyright and permission");
  put(root, `${location}/package.json`, JSON.stringify({ name, version: "1.0.0" }));
  put(root, `${location}/LICENSE`, "Copyright and permission");
  return { root, lock: { packages: { [location]: { version: "1.0.0", license: "MIT" } } } };
}

it("rejects noncanonical dependency paths before reading installed metadata", () => {
  const { root } = noticesFixture();
  for (const location of [
    "node_modules/./example",
    "node_modules//example",
    "node_modules/example/",
    "node_modules/example/subdirectory",
    "node_modules/../example",
    "node_modules/@scope",
  ])
    expect(() => dependencyNotices(root, { packages: { [location]: { version: "1.0.0" } } })).toThrow(
      "Invalid dependency location",
    );
  const nested = noticesFixture("node_modules/outer/node_modules/@scope/example", "@scope/example");
  expect(dependencyNotices(nested.root, nested.lock).inventory[0].name).toBe("@scope/example");
});

it("requires the installed dependency name and version while retaining locked aliases", () => {
  const { root, lock } = noticesFixture();
  put(root, "node_modules/example/package.json", JSON.stringify({ name: "substitute", version: "1.0.0" }));
  expect(() => dependencyNotices(root, lock)).toThrow("name differs");
  lock.packages["node_modules/example"].name = "substitute";
  expect(dependencyNotices(root, lock).inventory[0].name).toBe("substitute");
  delete lock.packages["node_modules/example"].version;
  put(root, "node_modules/example/package.json", JSON.stringify({ name: "substitute" }));
  expect(() => dependencyNotices(root, lock)).toThrow("dependency version");
});

it("requires nonempty bundled font and source notices", () => {
  const { root, lock } = noticesFixture();
  for (const name of bundledLicenses) {
    put(root, `Docs/${name}`, " \n\t");
    expect(() => dependencyNotices(root, lock)).toThrow(`Missing bundled license text: Docs/${name}`);
    put(root, `Docs/${name}`, "Copyright and permission");
  }
  expect(dependencyNotices(root, lock).inventory).toHaveLength(1);
});

it("rejects inventory generation before reading dependencies when the renderer is absent", () => {
  const root = temporaryDirectory("fauna-inventory-preflight-");
  expect(() => generateInventory(root)).toThrow("Build the renderer");
});

it("hashes multiple chunks and a partial tail without changing package manifest hashes", async () => {
  const root = temporaryDirectory("fauna-chunked-hashes-");
  const bytes = Buffer.alloc(2 * 1024 * 1024 + 17, 91);
  bytes[bytes.length - 1] = 19;
  for (const name of ["Fauna.exe", "resources/app.asar", "LICENSE.electron.txt", "LICENSES.chromium.html"])
    put(root, name, name.endsWith("asar") ? bytes : Buffer.from(name));
  expect(await fileHash(path.join(root, "resources/app.asar"))).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  const output = path.join(root, "inventory");
  const inventory = await packageInventory(root, output);
  for (const entry of inventory) {
    const content = readFileSync(path.join(root, entry.path));
    expect(entry).toMatchObject({
      size: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  expect(JSON.parse(readFileSync(path.join(output, "package-hashes.json"), "utf8")).files).toEqual(inventory);
  put(root, "empty", "");
  expect(await fileHash(path.join(root, "empty"))).toBe(createHash("sha256").digest("hex"));
  rmSync(path.join(root, "empty"));
});

it("rejects PE headers overlapping the DOS header", () => {
  const valid = Buffer.alloc(100);
  valid.write("MZ");
  valid.writeUInt32LE(64, 60);
  valid.write("PE\0\0", 64);
  valid.writeUInt16LE(0x8664, 68);
  expect(() => verifyPE(valid)).not.toThrow();
  const overlapping = Buffer.from(valid);
  overlapping.writeUInt32LE(8, 60);
  overlapping.write("PE\0\0", 8);
  overlapping.writeUInt16LE(0x8664, 12);
  expect(() => verifyPE(overlapping)).toThrow("Windows x64");
});

it("requires positive integer runtime byte counts", () => {
  expect(() => verifyWindowsRuntime(() => 1)).not.toThrow();
  for (const size of [0, -1, 0.5, "10", Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    expect(() => verifyWindowsRuntime(() => size)).toThrow("Electron runtime");
});

function archive(html, files = {}) {
  const entries = {
    "package.json": Buffer.from(
      JSON.stringify({ name: "fauna", version: "1.0.0", main: "desktop/main.cjs" }),
    ),
    "desktop/main.cjs": Buffer.from(
      "sandbox: true contextIsolation: true nodeIntegration: false app.isPackaged ? undefined",
    ),
    "dist/index.html": Buffer.from(html),
    "dist/app.js": Buffer.from("production"),
    ...files,
  };
  return () =>
    verifyArchive((name) => entries[name], {
      expected: { version: "1.0.0" },
      runtimeFiles: {},
      receipt: { records: {} },
    });
}

it("checks actual resource attributes instead of data attributes or quoted text", () => {
  expect(archive('<script data-src="decoy.js" src="app.js"></script>')().resources).toBe(1);
  expect(() => archive('<script data-note="src=app.js" src="missing.js"></script>')()).toThrow("missing.js");
  expect(() =>
    archive('<script data-src="app.js" src="unsafe.js"></script>', {
      "dist/unsafe.js": Buffer.from("skip-combat-control"),
    })(),
  ).toThrow("development controls");
});

it("validates spaced, uppercase, unquoted and token-list stylesheet references", () => {
  const script = '<script SRC = "app.js"></script>';
  for (const link of [
    '<link rel = "stylesheet" href = "missing.css">',
    "<LINK REL=stylesheet HREF=missing.css>",
    '<link rel="alternate stylesheet" href="missing.css">',
    '<link title="2 > 1" rel="stylesheet" href="missing.css">',
  ])
    expect(() => archive(script + link)()).toThrow("missing.css");
  expect(
    archive(script + '<link rel="stylesheet" href="app.css">', { "dist/app.css": Buffer.from("body {}") })()
      .resources,
  ).toBe(2);
});

function inventoryFixture(existingRoot) {
  const { root, lock } = noticesFixture(undefined, undefined, existingRoot);
  Object.assign(lock, { name: "fauna", version: "1.0.0" });
  lock.packages["node_modules/electron"] = { dev: true, version: "45.0.0" };
  put(root, "package-lock.json", JSON.stringify(lock));
  put(root, "dist/index.html", "<html></html>");
  put(root, "dist/dependencies.cdx.json", "retained inventory");
  put(root, "dist/THIRD-PARTY-NOTICES.txt", "retained notices");
  const sbom = {
    bomFormat: "CycloneDX",
    components: [],
    dependencies: [{ ref: "fauna@1.0.0", dependsOn: [] }],
    metadata: { component: { name: "fauna", version: "1.0.0", "bom-ref": "fauna@1.0.0" } },
  };
  return { root, lock, sbom };
}

it("refuses an SBOM for another application or version without replacing existing evidence", () => {
  const { root, sbom } = inventoryFixture();
  for (const component of [
    undefined,
    { name: "other", version: "1.0.0", "bom-ref": "other" },
    { name: "fauna", version: "2.0.0", "bom-ref": "fauna@2" },
    { name: "fauna", version: "1.0.0", "bom-ref": " " },
  ]) {
    const runNpm = () => JSON.stringify({ ...sbom, metadata: { component } });
    expect(() => generateInventory(root, { runNpm })).toThrow("SBOM application identity");
  }
  expect(readFileSync(path.join(root, "dist/dependencies.cdx.json"), "utf8")).toBe("retained inventory");
  expect(readFileSync(path.join(root, "dist/THIRD-PARTY-NOTICES.txt"), "utf8")).toBe("retained notices");
});

it("rejects lockfile changes during npm inventory generation and retains old outputs", () => {
  const { root, lock, sbom } = inventoryFixture();
  const runNpm = () => {
    put(root, "package-lock.json", JSON.stringify({ ...lock, version: "2.0.0" }));
    return JSON.stringify(sbom);
  };
  expect(() => generateInventory(root, { runNpm })).toThrow("lock changed");
  expect(readFileSync(path.join(root, "dist/dependencies.cdx.json"), "utf8")).toBe("retained inventory");
  expect(readFileSync(path.join(root, "dist/THIRD-PARTY-NOTICES.txt"), "utf8")).toBe("retained notices");
});

it("writes a matching SBOM with Electron and the captured lockfile hash", () => {
  const { root, lock, sbom } = inventoryFixture(
    repository({ "source.txt": "fixture" }, "fauna-sbom-success-"),
  );
  expect(generateInventory(root, { runNpm: () => JSON.stringify(sbom) }).dependencies).toBe(1);
  const saved = JSON.parse(readFileSync(path.join(root, "dist/dependencies.cdx.json"), "utf8"));
  expect(saved.metadata.component).toEqual(sbom.metadata.component);
  expect(saved.dependencies[0].dependsOn).toContain("electron@45.0.0");
  expect(saved.metadata.properties).toContainEqual({
    name: "fauna:package-lock-sha256",
    value: createHash("sha256").update(JSON.stringify(lock)).digest("hex"),
  });
});

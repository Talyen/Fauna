import { readFixture, temporaryDirectory, writeFixture } from "../../support/tooling.mjs";
import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { dependencyNotices, packageInventory } from "../../../scripts/release/dependency-inventory.mjs";

it("retains production license text and rejects missing or mismatched installed inputs", () => {
  const root = temporaryDirectory("fauna-notices-");
  const write = (name, data) => {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFixture(root, name, data);
  };

  write("Docs/SHADCN-LICENSE.txt", "source license");
  write("Docs/FONT-LICENSE.txt", "font license");
  for (const file of ["NOTO-SANS-LICENSE.txt", "NOTO-SANS-JP-LICENSE.txt", "NOTO-SANS-SC-LICENSE.txt"])
    write(`Docs/${file}`, `notice for ${file}`);
  write("node_modules/example/package.json", JSON.stringify({ name: "example", version: "1.0.0" }));
  write("node_modules/example/LICENSE", "copyright and permission");
  const lock = {
    packages: {
      "": {},
      "node_modules/example": { version: "1.0.0", license: "MIT" },
      "node_modules/dev-only": { dev: true },
      "node_modules/@koromix/koffi-other": { version: "3.3.3", optional: true, os: ["unsupported"] },
    },
  };
  const result = dependencyNotices(root, lock);
  expect(result.notices).toContain("copyright and permission");
  expect(result.notices).toContain("font license");
  expect(result.notices).toContain("notice for NOTO-SANS-JP-LICENSE.txt");
  expect(result.inventory).toHaveLength(1);
  lock.packages["node_modules/example"].version = "2.0.0";
  expect(() => dependencyNotices(root, lock)).toThrow("version differs");
  lock.packages["node_modules/example"].version = "1.0.0";
  rmSync(path.join(root, "node_modules/example/LICENSE"));
  expect(() => dependencyNotices(root, lock)).toThrow("Missing dependency license");
  expect(() => dependencyNotices(root, { packages: { "node_modules/../outside": {} } })).toThrow(
    "Invalid dependency location",
  );
});
it("binds the final executable, archive and Chromium notices to retained hashes", async () => {
  const root = temporaryDirectory("fauna-package-inventory-");

  mkdirSync(path.join(root, "resources"));
  for (const name of ["Fauna.exe", "resources/app.asar", "LICENSE.electron.txt", "LICENSES.chromium.html"])
    writeFixture(root, name, name);
  const output = path.join(root, "inventory");
  const manifest = await packageInventory(root, output);
  expect(manifest).toHaveLength(4);
  expect(manifest.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
  expect(JSON.parse(readFixture(output, "package-hashes.json")).files).toEqual(manifest);
  rmSync(path.join(root, "LICENSES.chromium.html"));
  await expect(packageInventory(root, output)).rejects.toThrow();
});

it.each(["3.3.3", "3.3.4"])(
  "includes Koffi %s native binaries under the matching upstream license",
  (version) => {
    const root = temporaryDirectory("fauna-koffi-notice-");
    const name = `@koromix/koffi-${process.platform}-${process.arch}`;
    const write = (file, text) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFixture(root, file, text);
    };

    write("Docs/SHADCN-LICENSE.txt", "source license");
    write("Docs/FONT-LICENSE.txt", "font license");
    for (const file of ["NOTO-SANS-LICENSE.txt", "NOTO-SANS-JP-LICENSE.txt", "NOTO-SANS-SC-LICENSE.txt"])
      write(`Docs/${file}`, `notice for ${file}`);
    write("node_modules/koffi/LICENSE.txt", "Koffi copyright and MIT permission");
    write("node_modules/koffi/package.json", JSON.stringify({ name: "koffi", version, license: "MIT" }));
    write(`node_modules/${name}/package.json`, JSON.stringify({ name, version, license: "MIT" }));
    const lock = {
      packages: {
        "node_modules/koffi": { version, license: "MIT" },
        [`node_modules/${name}`]: {
          version,
          optional: true,
          os: [process.platform],
          cpu: [process.arch],
          license: "MIT",
        },
      },
    };
    const result = dependencyNotices(root, lock);
    expect(result.notices).toContain("Koffi copyright and MIT permission");
    expect(result.inventory.map((entry) => entry.name)).toContain(name);
    write(
      "node_modules/koffi/package.json",
      JSON.stringify({ name: "koffi", version: "0.0.0", license: "MIT" }),
    );
    expect(() => dependencyNotices(root, lock)).toThrow();
  },
);

function noticesFixture() {
  const root = temporaryDirectory("fauna-inventory-boundaries-");
  mkdirSync(path.join(root, "Docs"));
  for (const file of [
    "SHADCN-LICENSE.txt",
    "FONT-LICENSE.txt",
    "NOTO-SANS-LICENSE.txt",
    "NOTO-SANS-JP-LICENSE.txt",
    "NOTO-SANS-SC-LICENSE.txt",
  ])
    writeFixture(root, `Docs/${file}`, `License for ${file}`);
  mkdirSync(path.join(root, "node_modules/example"), { recursive: true });
  writeFixture(
    root,
    "node_modules/example/package.json",
    JSON.stringify({ name: "example", version: "1.0.0" }),
  );
  writeFixture(root, "node_modules/example/LICENSE", "Permission text");
  return { root, lock: { packages: { "node_modules/example": { version: "1.0.0" } } } };
}

it("rejects malformed lock collections and entries with actionable diagnostics", () => {
  const { root } = noticesFixture();
  for (const lock of [null, {}, { packages: [] }, { packages: "invalid" }])
    expect(() => dependencyNotices(root, lock)).toThrow("Invalid dependency lock packages");
  for (const entry of [null, [], "invalid"])
    expect(() => dependencyNotices(root, { packages: { "node_modules/example": entry } })).toThrow(
      "Invalid dependency lock entry",
    );
});

it("rejects aliased dependency paths instead of inventorying one directory twice", () => {
  const { root } = noticesFixture();
  for (const location of [
    "node_modules/./example",
    "node_modules//example",
    "node_modules/example/",
    "node_modules/",
  ])
    expect(() => dependencyNotices(root, { packages: { [location]: { version: "1.0.0" } } })).toThrow(
      "Invalid dependency location",
    );
});

it("requires an installed package name for meaningful inventory identities", () => {
  const { root, lock } = noticesFixture();
  for (const name of [undefined, null, 42, "", "  ", " example "]) {
    writeFixture(root, "node_modules/example/package.json", JSON.stringify({ name, version: "1.0.0" }));
    expect(() => dependencyNotices(root, lock)).toThrow("installed dependency name");
  }
});

it("requires a locked version even when the installed manifest also omits it", () => {
  const { root } = noticesFixture();
  writeFixture(root, "node_modules/example/package.json", JSON.stringify({ name: "example" }));
  for (const version of [undefined, null, 42, "", "  "])
    expect(() => dependencyNotices(root, { packages: { "node_modules/example": { version } } })).toThrow(
      "Missing dependency version",
    );
});

it("omits unsupported optional packages from any vendor but retains required dependencies", () => {
  const { root, lock } = noticesFixture();
  for (const restrictions of [{ os: ["unsupported"] }, { cpu: ["unsupported"] }]) {
    const packages = {
      ...lock.packages,
      "node_modules/optional-binary": { version: "1.0.0", optional: true, ...restrictions },
    };
    expect(dependencyNotices(root, { packages }).inventory).toHaveLength(1);
    packages["node_modules/optional-binary"].optional = false;
    expect(() => dependencyNotices(root, { packages })).toThrow();
  }
});

it("uses npm platform exclusion, wildcard and string-list semantics", () => {
  const { root, lock } = noticesFixture();
  const entry = lock.packages["node_modules/example"];
  for (const restrictions of [
    { os: ["!unsupported"], cpu: ["!unsupported"] },
    { os: "any", cpu: ["any"] },
    { os: process.platform, cpu: process.arch },
    { os: [], cpu: [] },
  ]) {
    expect(
      dependencyNotices(root, {
        packages: { "node_modules/example": { ...entry, optional: true, ...restrictions } },
      }).inventory,
    ).toHaveLength(1);
  }
  for (const restrictions of [
    { os: [process.platform, `!${process.platform}`] },
    { cpu: [`!${process.arch}`] },
  ]) {
    expect(
      dependencyNotices(root, {
        packages: { "node_modules/example": { ...entry, optional: true, ...restrictions } },
      }).inventory,
    ).toHaveLength(0);
  }
});

it("rejects malformed platform constraints rather than silently skipping a package", () => {
  const { root, lock } = noticesFixture();
  for (const os of [null, {}, [42], [""], ["!"], [" any "]])
    expect(() =>
      dependencyNotices(root, {
        packages: {
          "node_modules/example": { ...lock.packages["node_modules/example"], optional: true, os },
        },
      }),
    ).toThrow("platform restriction");
});

it("requires nonempty bundled font and source licenses as well as dependency licenses", () => {
  const { root, lock } = noticesFixture();
  for (const file of [
    "SHADCN-LICENSE.txt",
    "FONT-LICENSE.txt",
    "NOTO-SANS-LICENSE.txt",
    "NOTO-SANS-JP-LICENSE.txt",
    "NOTO-SANS-SC-LICENSE.txt",
  ]) {
    writeFixture(root, `Docs/${file}`, " \n");
    expect(() => dependencyNotices(root, lock)).toThrow(`Missing bundled license text: Docs/${file}`);
    writeFixture(root, `Docs/${file}`, "Restored license");
  }
});

it("streams multi-chunk package components into unchanged SHA-256 receipts", async () => {
  const root = temporaryDirectory("fauna-chunked-inventory-");
  mkdirSync(path.join(root, "resources"));
  const bytes = Buffer.alloc(3 * 1024 * 1024 + 17, 0xa5);
  for (const name of ["Fauna.exe", "resources/app.asar", "LICENSE.electron.txt", "LICENSES.chromium.html"])
    writeFixture(root, name, bytes);
  const rows = await packageInventory(root, path.join(root, "inventory"));
  const expected = createHash("sha256").update(bytes).digest("hex");
  expect(rows.every((row) => row.size === bytes.length && row.sha256 === expected)).toBe(true);
});

it("rejects components changed during hashing without replacing existing evidence", async () => {
  const root = temporaryDirectory("fauna-changing-inventory-");
  mkdirSync(path.join(root, "resources"));
  for (const name of ["Fauna.exe", "resources/app.asar", "LICENSE.electron.txt", "LICENSES.chromium.html"])
    writeFixture(root, name, name);
  const output = path.join(root, "inventory");
  await packageInventory(root, output);
  const previous = readFixture(output, "package-hashes.json");
  const pending = packageInventory(root, output);
  appendFileSync(path.join(root, "Fauna.exe"), "changed");
  await expect(pending).rejects.toThrow("changed during inventory");
  expect(readFixture(output, "package-hashes.json")).toBe(previous);
});

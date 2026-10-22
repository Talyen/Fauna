import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { dependencyNotices, packageInventory } from "../../../scripts/release/dependency-inventory.mjs";

it("retains production license text and rejects missing or mismatched installed inputs", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fauna-notices-"));
  const write = (name, data) => {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), data);
  };
  try {
    write("Docs/SHADCN-LICENSE.txt", "source license");
    write("Docs/FONT-LICENSE.txt", "font license");
    write("node_modules/example/package.json", JSON.stringify({ name: "example", version: "1.0.0" }));
    write("node_modules/example/LICENSE", "copyright and permission");
    const lock = {
      packages: {
        "": {},
        "node_modules/example": { version: "1.0.0", license: "MIT" },
        "node_modules/dev-only": { dev: true },
      },
    };
    const result = dependencyNotices(root, lock);
    expect(result.notices).toContain("copyright and permission");
    expect(result.notices).toContain("font license");
    expect(result.inventory).toHaveLength(1);
    lock.packages["node_modules/example"].version = "2.0.0";
    expect(() => dependencyNotices(root, lock)).toThrow("version differs");
    lock.packages["node_modules/example"].version = "1.0.0";
    rmSync(path.join(root, "node_modules/example/LICENSE"));
    expect(() => dependencyNotices(root, lock)).toThrow("Missing dependency license");
    expect(() => dependencyNotices(root, { packages: { "node_modules/../outside": {} } })).toThrow(
      "Invalid dependency location",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("binds the final executable, archive and Chromium notices to retained hashes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fauna-package-inventory-"));
  try {
    mkdirSync(path.join(root, "resources"));
    for (const name of ["Fauna.exe", "resources/app.asar", "LICENSE", "LICENSES.chromium.html"])
      writeFileSync(path.join(root, name), name);
    const output = path.join(root, "inventory");
    const manifest = packageInventory(root, output);
    expect(manifest).toHaveLength(4);
    expect(manifest.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(output, "package-hashes.json"), "utf8")).files).toEqual(
      manifest,
    );
    rmSync(path.join(root, "LICENSES.chromium.html"));
    expect(() => packageInventory(root, output)).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

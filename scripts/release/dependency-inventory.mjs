import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { npmCommand } from "../lib/npm-command.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJSON = (file) => JSON.parse(readFileSync(file, "utf8"));
// The published 2.3.8 tarball declares MIT but omits the upstream license text.
const SUPPLEMENTS = new Map([
  ["react-remove-scroll-bar@2.3.8", "Docs/third-party/react-remove-scroll-bar-LICENSE.txt"],
]);

export function dependencyNotices(root, lock) {
  const sections = [
    "Fauna third-party notices",
    "These notices cover production npm dependencies and bundled source/font licenses.",
  ];
  const inventory = [];
  for (const [location, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (!location || entry.dev) continue;
    if (
      !location.startsWith("node_modules/") ||
      location.split("/").includes("..") ||
      location.includes("\\")
    )
      throw new Error(`Invalid dependency location: ${location}`);
    // Platform-specific optional native binaries are absent on other build hosts.
    if (
      location.startsWith("node_modules/@koromix/koffi-") &&
      entry.optional &&
      ((entry.os && !entry.os.includes(process.platform)) || (entry.cpu && !entry.cpu.includes(process.arch)))
    )
      continue;
    const directory = path.join(root, location);
    const manifest = readJSON(path.join(directory, "package.json"));
    if (manifest.version !== entry.version) throw new Error(`Dependency version differs: ${location}`);
    const identity = `${manifest.name}@${manifest.version}`;
    const files = readdirSync(directory)
      .filter(
        (name) =>
          /^(licen[sc]e|copying|notice)([.-]|$)/i.test(name) && statSync(path.join(directory, name)).isFile(),
      )
      .sort();
    const texts = files.map((name) => readFileSync(path.join(directory, name), "utf8"));
    // Koffi 3.3.3 publishes its platform binaries separately under the same MIT license.
    const supplement =
      SUPPLEMENTS.get(identity) ??
      (/^@koromix\/koffi-[a-z0-9-]+@3\.3\.3$/.test(identity) ? "node_modules/koffi/LICENSE.txt" : undefined);
    if (!texts.length && supplement) texts.push(readFileSync(path.join(root, supplement), "utf8"));
    if (!texts.length || texts.some((text) => !text.trim()))
      throw new Error(`Missing dependency license text: ${identity}`);
    sections.push(`=== ${identity} (${entry.license ?? "see license text"}) ===`, ...texts);
    inventory.push({
      name: manifest.name,
      version: manifest.version,
      license: entry.license ?? null,
      location,
    });
  }
  for (const file of ["Docs/SHADCN-LICENSE.txt", "Docs/FONT-LICENSE.txt"])
    sections.push(`=== ${file} ===`, readFileSync(path.join(root, file), "utf8"));
  return { notices: sections.join("\n\n") + "\n", inventory };
}

export function generateInventory(root = ROOT) {
  const lockBytes = readFileSync(path.join(root, "package-lock.json"));
  const lock = JSON.parse(lockBytes.toString("utf8"));
  const { notices, inventory } = dependencyNotices(root, lock);
  const [command, args] = npmCommand([
    "sbom",
    "--omit=dev",
    "--package-lock-only",
    "--sbom-format=cyclonedx",
  ]);
  const sbom = JSON.parse(execFileSync(command, args, { cwd: root, encoding: "utf8", timeout: 60_000 }));
  if (sbom.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components) || !Array.isArray(sbom.dependencies))
    throw new Error("Incomplete dependency SBOM.");
  // Electron is a build dependency, but its runtime is distributed with the game.
  const electron = lock.packages["node_modules/electron"];
  const electronRef = `electron@${electron.version}`;
  sbom.components.push({
    type: "framework",
    name: "electron",
    version: electron.version,
    "bom-ref": electronRef,
    purl: `pkg:npm/electron@${electron.version}`,
    licenses: [{ license: { id: "MIT" } }],
  });
  sbom.dependencies.push({ ref: electronRef, dependsOn: [] });
  const application = sbom.dependencies.find((entry) => entry.ref === sbom.metadata.component["bom-ref"]);
  if (!application) throw new Error("SBOM application dependency graph is missing.");
  application.dependsOn.push(electronRef);
  sbom.metadata.properties = [
    ...(sbom.metadata.properties ?? []),
    {
      name: "fauna:source-commit",
      value: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    },
    { name: "fauna:package-lock-sha256", value: sha(lockBytes) },
    {
      name: "fauna:inventory-scope",
      value:
        "production npm build inputs and Electron runtime; Chromium native components retain Electron's LICENSES.chromium.html",
    },
  ];
  const output = path.join(root, "dist");
  if (!statSync(path.join(output, "index.html")).isFile())
    throw new Error("Build the renderer before generating its inventory.");
  writeFileSync(path.join(output, "THIRD-PARTY-NOTICES.txt"), notices);
  writeFileSync(path.join(output, "dependencies.cdx.json"), JSON.stringify(sbom, null, 2) + "\n");
  return { dependencies: inventory.length, sbom: "dist/dependencies.cdx.json" };
}

export function packageInventory(directory, output = path.resolve(ROOT, "reports/release-inventory")) {
  const files = ["Fauna.exe", "resources/app.asar", "LICENSE.electron.txt", "LICENSES.chromium.html"];
  const manifest = files.map((name) => {
    const bytes = readFileSync(path.join(directory, name));
    if (!bytes.length) throw new Error(`Empty packaged component: ${name}`);
    return { path: name, size: bytes.length, sha256: sha(bytes) };
  });
  mkdirSync(output, { recursive: true });
  writeFileSync(
    path.join(output, "package-hashes.json"),
    JSON.stringify({ files: manifest }, null, 2) + "\n",
  );
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (!args.length) console.log(generateInventory());
  else if (args.length === 2 && args[0] === "--package") console.log(packageInventory(path.resolve(args[1])));
  else throw new Error("Usage: generate:release-inventory -- [--package <unpacked-directory>]");
}

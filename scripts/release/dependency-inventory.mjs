import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileHash } from "../lib/file-integrity.mjs";
import { npmCommand } from "../lib/npm-command.mjs";
import { leasePackage } from "./development-retention.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJSON = (file) => JSON.parse(readFileSync(file, "utf8"));
// The published 2.3.8 tarball declares MIT but omits the upstream license text.
const SUPPLEMENTS = new Map([
  ["react-remove-scroll-bar@2.3.8", "Docs/third-party/react-remove-scroll-bar-LICENSE.txt"],
]);

function supportsPlatform(value, restriction, location) {
  if (restriction === undefined) return true;
  const list = typeof restriction === "string" ? [restriction] : restriction;
  if (
    !Array.isArray(list) ||
    list.some(
      (entry) => typeof entry !== "string" || !entry.trim() || entry !== entry.trim() || entry === "!",
    )
  )
    throw new Error(`Invalid dependency platform restriction: ${location}`);
  if (list.length === 1 && list[0] === "any") return true;
  let positive = false,
    matched = false;
  for (const entry of list) {
    if (entry.startsWith("!")) {
      if (entry.slice(1) === value) return false;
    } else {
      positive = true;
      if (entry === value) matched = true;
    }
  }
  return !positive || matched;
}

export function dependencyNotices(root, lock) {
  if (!lock?.packages || typeof lock.packages !== "object" || Array.isArray(lock.packages))
    throw new Error("Invalid dependency lock packages.");
  const sections = [
    "Fauna third-party notices",
    "These notices cover production npm dependencies and bundled source/font licenses.",
  ];
  const inventory = [];
  for (const [location, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (!location) continue;
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error(`Invalid dependency lock entry: ${location}`);
    if (entry.dev === true) continue;
    if (
      !location.startsWith("node_modules/") ||
      location.split("/").some((part) => !part || part === "." || part === "..") ||
      !/^node_modules\/(?:@[^/]+\/)?[^@/][^/]*(?:\/node_modules\/(?:@[^/]+\/)?[^@/][^/]*)*$/u.test(
        location,
      ) ||
      location.includes("\\")
    )
      throw new Error(`Invalid dependency location: ${location}`);
    if (typeof entry.version !== "string" || !entry.version.trim())
      throw new Error(`Missing dependency version: ${location}`);
    const osSupported = supportsPlatform(process.platform, entry.os, location);
    const cpuSupported = supportsPlatform(process.arch, entry.cpu, location);
    // npm omits unsupported optional dependencies regardless of package family.
    if (entry.optional === true && (!osSupported || !cpuSupported)) continue;
    const directory = path.join(root, location);
    const manifest = readJSON(path.join(directory, "package.json"));
    if (
      !manifest ||
      typeof manifest.name !== "string" ||
      !manifest.name.trim() ||
      manifest.name !== manifest.name.trim()
    )
      throw new Error(`Invalid installed dependency name: ${location}`);
    const expectedName = entry.name ?? location.slice(location.lastIndexOf("node_modules/") + 13);
    if (manifest.name !== expectedName) throw new Error(`Dependency name differs: ${location}`);
    if (manifest.version !== entry.version) throw new Error(`Dependency version differs: ${location}`);
    const identity = `${manifest.name}@${manifest.version}`;
    const files = readdirSync(directory)
      .filter(
        (name) =>
          /^(licen[sc]e|copying|notice)([.-]|$)/i.test(name) && statSync(path.join(directory, name)).isFile(),
      )
      .sort();
    const texts = files.map((name) => readFileSync(path.join(directory, name), "utf8"));
    // These platform packages omit the text included with their matching MIT-licensed Koffi release.
    const nativeKoffi = /^@koromix\/koffi-[a-z0-9-]+@3\.3\.[34]$/.test(identity);
    const parent =
      nativeKoffi && !texts.length ? readJSON(path.join(root, "node_modules/koffi/package.json")) : undefined;
    const supplement =
      SUPPLEMENTS.get(identity) ??
      (nativeKoffi &&
      manifest.license === "MIT" &&
      parent?.name === "koffi" &&
      parent.license === "MIT" &&
      parent.version === manifest.version &&
      lock.packages["node_modules/koffi"]?.version === manifest.version
        ? "node_modules/koffi/LICENSE.txt"
        : undefined);
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
  for (const file of [
    "Docs/SHADCN-LICENSE.txt",
    "Docs/FONT-LICENSE.txt",
    "Docs/NOTO-SANS-LICENSE.txt",
    "Docs/NOTO-SANS-JP-LICENSE.txt",
    "Docs/NOTO-SANS-SC-LICENSE.txt",
  ]) {
    const text = readFileSync(path.join(root, file), "utf8");
    if (!text.trim()) throw new Error(`Missing bundled license text: ${file}`);
    sections.push(`=== ${file} ===`, text);
  }
  return { notices: sections.join("\n\n") + "\n", inventory };
}

export function generateInventory(root = ROOT, { runNpm = execFileSync } = {}) {
  const output = path.join(root, "dist");
  if (!statSync(path.join(output, "index.html"), { throwIfNoEntry: false })?.isFile())
    throw new Error("Build the renderer before generating its inventory.");
  const lockBytes = readFileSync(path.join(root, "package-lock.json"));
  const lock = JSON.parse(lockBytes.toString("utf8"));
  const { notices, inventory } = dependencyNotices(root, lock);
  const [command, args] = npmCommand([
    "sbom",
    "--omit=dev",
    "--package-lock-only",
    "--sbom-format=cyclonedx",
  ]);
  const sbom = JSON.parse(runNpm(command, args, { cwd: root, encoding: "utf8", timeout: 60_000 }));
  if (!lockBytes.equals(readFileSync(path.join(root, "package-lock.json"))))
    throw new Error("Dependency lock changed during inventory generation; existing evidence is preserved.");
  if (sbom?.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components) || !Array.isArray(sbom.dependencies))
    throw new Error("Incomplete dependency SBOM.");
  const component = sbom.metadata?.component;
  if (
    lock.name !== "fauna" ||
    typeof lock.version !== "string" ||
    !lock.version.trim() ||
    component?.name !== lock.name ||
    component.version !== lock.version ||
    typeof component["bom-ref"] !== "string" ||
    !component["bom-ref"].trim()
  )
    throw new Error("SBOM application identity differs from the dependency lock.");
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
  writeFileSync(path.join(output, "THIRD-PARTY-NOTICES.txt"), notices);
  writeFileSync(path.join(output, "dependencies.cdx.json"), JSON.stringify(sbom, null, 2) + "\n");
  return { dependencies: inventory.length, sbom: "dist/dependencies.cdx.json" };
}

export async function packageInventory(directory, output = path.resolve(ROOT, "reports/release-inventory")) {
  const lease = leasePackage(ROOT, directory);
  try {
    return await packageInventoryFiles(directory, output);
  } finally {
    lease?.release();
  }
}

async function packageInventoryFiles(directory, output) {
  const files = ["Fauna.exe", "resources/app.asar", "LICENSE.electron.txt", "LICENSES.chromium.html"];
  const manifest = [];
  for (const name of files) {
    const file = path.join(directory, name);
    const before = statSync(file, { bigint: true });
    if (!before.isFile() || before.size === 0n)
      throw new Error(`Empty or invalid packaged component: ${name}`);
    const digest = await fileHash(file);
    const after = statSync(file, { bigint: true });
    if (["dev", "ino", "size", "mtimeNs", "ctimeNs"].some((key) => before[key] !== after[key]))
      throw new Error(`Packaged component changed during inventory: ${name}`);
    manifest.push({ path: name, size: Number(before.size), sha256: digest });
  }
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
  else if (args.length === 2 && args[0] === "--package")
    console.log(await packageInventory(path.resolve(args[1])));
  else throw new Error("Usage: generate:release-inventory -- [--package <unpacked-directory>]");
}

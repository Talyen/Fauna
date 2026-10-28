import { getCurrentFuseWire, FuseState } from "@electron/fuses";
import hardening from "../../desktop/after-pack.cjs";
import { loadOverlayApi } from "../../desktop/steam-overlay.cjs";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { leasePackage } from "./development-retention.mjs";
import { extractFile, listPackage } from "@electron/asar";
import { assets } from "../assets/assets.mjs";
const ROOT = path.resolve(import.meta.dirname, "../..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
// A translated catalog can contain the label even when Vite removes the development-only control.
const DEVELOPMENT_CONTROL_MARKER = Buffer.from("skip-combat-control");
// Runtime files shipped by Electron 45 Windows x64; verified against its official ZIP.
export const WINDOWS_RUNTIME_FILES = [
  "resources.pak",
  "icudtl.dat",
  "v8_context_snapshot.bin",
  "snapshot_blob.bin",
  "chrome_100_percent.pak",
  "chrome_200_percent.pak",
  "locales/en-US.pak",
  "ffmpeg.dll",
  "electron_wer.dll",
  "d3dcompiler_47.dll",
  "dxcompiler.dll",
  "vulkan-1.dll",
  "vk_swiftshader.dll",
  "vk_swiftshader_icd.json",
];
export function verifyWindowsRuntime(size) {
  for (const name of WINDOWS_RUNTIME_FILES) {
    const bytes = size(name);
    if (!Number.isSafeInteger(bytes) || bytes <= 0)
      throw new Error(`Missing or empty Electron runtime: ${name}`);
  }
}
export function verifyFuses(wire) {
  for (const index of Object.keys(wire))
    if (/^\d+$/.test(index) && !Object.hasOwn(hardening.FUSES, index))
      throw new Error(`Unknown Electron fuse ${index}`);
  for (const [index, enabled] of Object.entries(hardening.FUSES)) {
    if (wire[index] !== (enabled ? FuseState.ENABLE : FuseState.DISABLE))
      throw new Error(`Unexpected Electron fuse ${index}`);
  }
}
export function verifyPE(bytes) {
  if (bytes.length < 64 || bytes.toString("ascii", 0, 2) !== "MZ")
    throw new Error("Missing Windows executable header.");
  const offset = bytes.readUInt32LE(60);
  if (
    offset < 64 ||
    offset > bytes.length - 24 ||
    bytes.toString("ascii", offset, offset + 4) !== "PE\0\0" ||
    bytes.readUInt16LE(offset + 4) !== 0x8664
  )
    throw new Error("Expected Windows x64 executable.");
}
export function verifyWindowsIdentity(details, expected) {
  const numericVersion = expected.version.split("-")[0];
  const actualVersion = String(details.ProductVersion);
  if (
    details.ProductName !== expected.build.productName ||
    (actualVersion !== numericVersion &&
      !new RegExp(`^${numericVersion.replaceAll(".", "\\.")}\\.\\d+$`).test(actualVersion))
  )
    throw new Error("Windows executable product identity/version differs.");
}
export function rendererPath(reference) {
  if (!reference || /^[\\/]|^[a-z][a-z\d+.-]*:/i.test(reference) || /[?#]/.test(reference))
    throw new Error(`Renderer resource must be relative: ${reference}`);
  const decoded = decodeURIComponent(reference);
  if (
    /^[\\/]|^[a-z][a-z\d+.-]*:/i.test(decoded) ||
    decoded.includes("\\") ||
    decoded.includes("\0") ||
    decoded.split("/").includes("..")
  )
    throw new Error(`Renderer resource escapes its root: ${reference}`);
  return path.posix.join("dist", decoded);
}
export function verifyArchive(read, { expected, receipt, runtimeFiles, rendererFiles = {}, releaseTag }) {
  const required = (name) => {
    const bytes = read(name);
    if (!bytes?.length) throw new Error(`Missing or empty packaged file: ${name}`);
    return bytes;
  };
  const pkg = JSON.parse(required("package.json"));
  if (pkg.name !== "fauna" || pkg.version !== expected.version || pkg.main !== "desktop/main.cjs")
    throw new Error("Packaged Fauna identity/version differs.");
  if (releaseTag && releaseTag !== `v${pkg.version}` && releaseTag !== pkg.version)
    throw new Error("Release tag differs from package version.");
  for (const [name, bytes] of Object.entries(runtimeFiles))
    if (!required(name).equals(bytes)) throw new Error(`Packaged runtime differs: ${name}`);
  const rendererEntries = rendererFiles[Symbol.iterator] ? rendererFiles : Object.entries(rendererFiles);
  for (const [name, bytes] of rendererEntries)
    if (!required(name).equals(bytes)) throw new Error(`Packaged renderer differs: ${name}`);
  const main = required("desktop/main.cjs").toString();
  for (const field of [
    "sandbox: true",
    "contextIsolation: true",
    "nodeIntegration: false",
    "app.isPackaged ? undefined",
  ])
    if (!main.includes(field)) throw new Error(`Desktop boundary missing: ${field}`);
  const html = required("dist/index.html").toString();
  const resources = [...html.matchAll(/<(script|link)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)].flatMap(
    ([, kind, attributes]) => {
      const values = new Map();
      for (const [, name, double, single, bare] of attributes.matchAll(
        /(?:^|\s)([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
      )) {
        const key = name.toLowerCase();
        if (!values.has(key)) values.set(key, double ?? single ?? bare ?? "");
      }
      const script = kind.toLowerCase() === "script";
      if (
        !script &&
        !values
          .get("rel")
          ?.toLowerCase()
          .split(/\s+/)
          .some((rel) => ["stylesheet", "modulepreload"].includes(rel))
      )
        return [];
      const ref = values.get(script ? "src" : "href");
      return ref ? [rendererPath(ref)] : [];
    },
  );
  if (!resources.some((name) => name.endsWith(".js"))) throw new Error("Renderer has no application script.");
  for (const name of resources) {
    const bytes = required(name);
    if (name.endsWith(".js") && bytes.includes(DEVELOPMENT_CONTROL_MARKER))
      throw new Error("Production renderer contains development controls.");
  }
  for (const [id, record] of Object.entries(receipt.records)) {
    const bytes = required(rendererPath(record.url));
    if (sha(bytes) !== record.outputHash) throw new Error(`Packaged media hash differs: ${id}`);
  }
  return { version: pkg.version, resources: resources.length, media: Object.keys(receipt.records).length };
}
export function verifyDesktopDependencies(names) {
  for (const name of names) {
    // ASAR listings include scope containers such as node_modules/@koromix/.
    const dependency = /^node_modules\/(@[^/]+\/[^/]+|[^@/][^/]*)(?:\/|$)/.exec(name)?.[1];
    if (dependency && !["steamworks.js", "koffi", "@koromix/koffi-win32-x64"].includes(dependency))
      throw new Error(`Unexpected desktop dependency: ${dependency}`);
  }
}
export async function verifyPackage(directory, releaseTag) {
  const lease = releaseTag && !directory ? null : leasePackage(ROOT, directory);
  directory ??= lease?.directory ?? path.join(ROOT, "release/win-unpacked");
  try {
    return await verifyPackageFiles(directory, releaseTag);
  } finally {
    lease?.release();
  }
}

async function verifyPackageFiles(directory, releaseTag) {
  const expected = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  if (expected.build.appId !== "com.fauna.game" || expected.build.productName !== "Fauna")
    throw new Error("Unexpected Fauna application identity.");
  verifyPE(readFileSync(path.join(directory, "Fauna.exe")));
  verifyFuses(await getCurrentFuseWire(path.join(directory, "Fauna.exe")));
  const snapshot = readFileSync(path.join(directory, "browser_v8_context_snapshot.bin"));
  if (!snapshot.length || !snapshot.equals(readFileSync(path.join(directory, "v8_context_snapshot.bin"))))
    throw new Error("Browser snapshot differs from the pinned runtime.");
  const nativeRoot = path.join(
    directory,
    "resources/app.asar.unpacked/node_modules/steamworks.js/dist/win64",
  );
  for (const name of ["steamworksjs.win32-x64-msvc.node", "steam_api64.dll"]) {
    const bytes = readFileSync(path.join(nativeRoot, name));
    verifyPE(bytes);
    if (!bytes.equals(readFileSync(path.join(ROOT, "node_modules/steamworks.js/dist/win64", name))))
      throw new Error(`Steam native file differs: ${name}`);
  }
  const ffiNative = "node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node";
  const ffiBytes = readFileSync(path.join(directory, "resources/app.asar.unpacked", ffiNative));
  verifyPE(ffiBytes);
  if (process.platform === "win32" && !ffiBytes.equals(readFileSync(path.join(ROOT, ffiNative))))
    throw new Error("Packaged Steam callback binding differs.");
  if (process.platform === "win32") {
    // Bind the shipped SDK exports without initializing Steam or opening a main-process inspector.
    loadOverlayApi(path.resolve(nativeRoot, "../.."));
    const details = JSON.parse(
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-Item -LiteralPath $env:FAUNA_PACKAGE_EXECUTABLE).VersionInfo | Select-Object ProductName,ProductVersion | ConvertTo-Json -Compress",
        ],
        {
          encoding: "utf8",
          env: { ...process.env, FAUNA_PACKAGE_EXECUTABLE: path.resolve(directory, "Fauna.exe") },
        },
      ),
    );
    verifyWindowsIdentity(details, expected);
  }

  verifyWindowsRuntime((name) => {
    const file = statSync(path.join(directory, name));
    return file.isFile() ? file.size : 0;
  });
  const archive = path.join(directory, "resources/app.asar");
  const names = listPackage(archive).map((name) => name.replaceAll("\\", "/").replace(/^\//, ""));
  verifyDesktopDependencies(names);
  if (
    names.some(
      (name) => path.posix.normalize(name) !== name || name.startsWith("../") || name.startsWith("/"),
    )
  )
    throw new Error("Invalid archive path.");
  const receipt = await assets({ repository: ROOT, mode: "outputs" });
  const runtimeFiles = Object.fromEntries(
    readdirSync(path.join(ROOT, "desktop"))
      .filter((name) => /\.(cjs|json)$/.test(name))
      .map((name) => [`desktop/${name}`, readFileSync(path.join(ROOT, "desktop", name))]),
  );
  runtimeFiles["src/game/save-format.json"] = readFileSync(path.join(ROOT, "src/game/save-format.json"));
  function* rendererFiles() {
    for (const name of readdirSync(path.join(ROOT, "dist"), { recursive: true })) {
      const file = path.join(ROOT, "dist", name);
      if (statSync(file).isFile()) yield [`dist/${name.replaceAll("\\", "/")}`, readFileSync(file)];
    }
  }
  // ASAR 3 traverses directories with the host separator, including on Windows.
  const readArchive = (name) => extractFile(archive, path.normalize(name));
  const result = verifyArchive(readArchive, {
    expected,
    receipt,
    runtimeFiles,
    rendererFiles: rendererFiles(),
    releaseTag,
  });
  for (const name of names.filter((name) => name.startsWith("dist/") && name.endsWith(".js")))
    if (readArchive(name).includes(DEVELOPMENT_CONTROL_MARKER))
      throw new Error("Development controls in production chunk.");
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1) throw new Error("Usage: verify:package -- [unpacked-directory]");
  console.log(await verifyPackage(args[0] ? path.resolve(args[0]) : undefined, process.env.RELEASE_TAG));
}

import { execFileSync } from "node:child_process";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractFile, listPackage } from "@electron/asar";
import { assets } from "./assets.mjs";
const ROOT = path.resolve(import.meta.dirname, "..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Runtime files shipped by the pinned Electron Windows x64 distribution.
export const WINDOWS_RUNTIME_FILES = [
  "resources.pak",
  "icudtl.dat",
  "v8_context_snapshot.bin",
  "snapshot_blob.bin",
  "chrome_100_percent.pak",
  "chrome_200_percent.pak",
  "locales/en-US.pak",
  "ffmpeg.dll",
  "libEGL.dll",
  "libGLESv2.dll",
  "d3dcompiler_47.dll",
  "dxcompiler.dll",
  "dxil.dll",
  "vulkan-1.dll",
  "vk_swiftshader.dll",
  "vk_swiftshader_icd.json",
];
export function verifyWindowsRuntime(size) {
  for (const name of WINDOWS_RUNTIME_FILES)
    if (!(size(name) > 0)) throw new Error(`Missing or empty Electron runtime: ${name}`);
}
export function verifyPE(bytes) {
  if (bytes.length < 64 || bytes.toString("ascii", 0, 2) !== "MZ")
    throw new Error("Missing Windows executable header.");
  const offset = bytes.readUInt32LE(60);
  if (
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
export function verifyArchive(read, { expected, receipt, desktopFiles, rendererFiles = {}, releaseTag }) {
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
  for (const [name, bytes] of Object.entries(desktopFiles))
    if (!required(name).equals(bytes)) throw new Error(`Packaged runtime differs: ${name}`);
  for (const [name, bytes] of Object.entries(rendererFiles))
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
  const resources = [...html.matchAll(/<(script|link)\b[^>]*>/gi)].flatMap(([tag, kind]) => {
    if (kind.toLowerCase() === "link" && !/rel=["'](?:stylesheet|modulepreload)["']/i.test(tag)) return [];
    const ref = /(?:src|href)=["']([^"']+)["']/i.exec(tag)?.[1];
    return ref ? [rendererPath(ref)] : [];
  });
  if (!resources.some((name) => name.endsWith(".js"))) throw new Error("Renderer has no application script.");
  for (const name of resources) {
    const bytes = required(name);
    if (name.endsWith(".js") && bytes.includes(Buffer.from("Skip combat")))
      throw new Error("Production renderer contains development controls.");
  }
  for (const [id, record] of Object.entries(receipt.records)) {
    const bytes = required(rendererPath(record.url));
    if (sha(bytes) !== record.outputHash) throw new Error(`Packaged media hash differs: ${id}`);
  }
  return { version: pkg.version, resources: resources.length, media: Object.keys(receipt.records).length };
}
export async function verifyPackage(directory = path.join(ROOT, "release/win-unpacked"), releaseTag) {
  const expected = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  if (expected.build.appId !== "com.fauna.game" || expected.build.productName !== "Fauna")
    throw new Error("Unexpected Fauna application identity.");
  verifyPE(readFileSync(path.join(directory, "Fauna.exe")));
  if (process.platform === "win32") {
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
  if (
    names.some(
      (name) => path.posix.normalize(name) !== name || name.startsWith("../") || name.startsWith("/"),
    )
  )
    throw new Error("Invalid archive path.");
  const receipt = await assets({ repository: ROOT, mode: "outputs" });
  const desktopFiles = Object.fromEntries(
    readdirSync(path.join(ROOT, "desktop"))
      .filter((name) => name.endsWith(".cjs"))
      .map((name) => [`desktop/${name}`, readFileSync(path.join(ROOT, "desktop", name))]),
  );
  const rendererFiles = Object.fromEntries(
    readdirSync(path.join(ROOT, "dist"), { recursive: true })
      .filter((name) => statSync(path.join(ROOT, "dist", name)).isFile())
      .map((name) => [`dist/${name.replaceAll("\\", "/")}`, readFileSync(path.join(ROOT, "dist", name))]),
  );
  const result = verifyArchive((name) => extractFile(archive, name), {
    expected,
    receipt,
    desktopFiles,
    rendererFiles,
    releaseTag,
  });
  for (const name of names.filter((name) => name.startsWith("dist/") && name.endsWith(".js")))
    if (extractFile(archive, name).includes(Buffer.from("Skip combat")))
      throw new Error("Development controls in production chunk.");
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1) throw new Error("Usage: verify:package -- [unpacked-directory]");
  console.log(await verifyPackage(args[0] ? path.resolve(args[0]) : undefined, process.env.RELEASE_TAG));
}

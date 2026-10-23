import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git } from "../lib/git.mjs";
import { buildIdentity, releaseVersion, verifyBuildIdentity } from "../lib/release-identity.mjs";
const ROOT = path.resolve(import.meta.dirname, "../..");
export async function verifySteamConfiguration(root) {
  const config = JSON.parse(await readFile(path.join(root, "desktop/steam-config.json"), "utf8"));
  if (
    !Number.isSafeInteger(config.appId) ||
    config.appId <= 0 ||
    config.appId > 0xffffffff ||
    config.appId === 480
  )
    throw new Error(
      "Steam release requires Fauna's own App ID in desktop/steam-config.json; partner verification and App creation must finish first",
    );
  return config.appId;
}
export function releaseArgs(args, env = process.env) {
  const result = { tag: env.RELEASE_TAG || undefined, versionOnly: false, directory: undefined };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    if (seen.has(option)) throw new Error(`Duplicate release option: ${option}`);
    seen.add(option);
    if (option === "--version-only") result.versionOnly = true;
    else if (["--tag", "--package"].includes(option) && args[i + 1] && !args[i + 1].startsWith("-"))
      result[option === "--tag" ? "tag" : "directory"] = args[++i];
    else throw new Error(`Invalid release option: ${option}`);
  }
  if (result.versionOnly && result.directory)
    throw new Error("Version-only verification does not inspect a package.");
  if (!result.versionOnly && !result.tag)
    throw new Error("Release verification requires --tag v<version> or RELEASE_TAG.");
  return result;
}
export async function verifyRelease(root, options) {
  const version = releaseVersion(root, options.tag);
  if (options.versionOnly) return { version, scope: "package identity and version only" };
  const expected = buildIdentity(root);
  if (expected.dirty) throw new Error("Release verification requires a clean checkout.");
  if (git(root, ["rev-parse", "--verify", `refs/tags/${options.tag}^{commit}`]).trim() !== expected.commit)
    throw new Error("Release tag does not identify HEAD.");
  const receipt = JSON.parse(await readFile(path.join(root, "dist/release.json"), "utf8"));
  verifyBuildIdentity(receipt, expected);
  await verifySteamConfiguration(root);
  const { verifyPackage } = await import("./verify-package.mjs");
  const artifact = await verifyPackage(
    options.directory ? path.resolve(root, options.directory) : undefined,
    options.tag,
  );
  const after = buildIdentity(root);
  verifyBuildIdentity(after, expected);
  return {
    version,
    commit: expected.commit,
    artifact,
    scope: "existing artifact integrity; CI, signing, installer, Steam and hardware acceptance are separate",
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  console.log(await verifyRelease(ROOT, releaseArgs(process.argv.slice(2))));

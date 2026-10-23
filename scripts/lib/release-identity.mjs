import { readFileSync } from "node:fs";
import { git } from "./git.mjs";
const VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?$/;
export function releaseVersion(root, tag) {
  const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
  const lock = JSON.parse(readFileSync(`${root}/package-lock.json`, "utf8"));
  if (pkg.name !== "fauna" || pkg.build?.appId !== "com.fauna.game" || pkg.build?.productName !== "Fauna")
    throw new Error("Unexpected Fauna release identity.");
  if (
    !VERSION.test(pkg.version) ||
    lock.name !== pkg.name ||
    lock.version !== pkg.version ||
    lock.packages?.[""]?.name !== pkg.name ||
    lock.packages[""].version !== pkg.version
  )
    throw new Error("Invalid or mismatched package/lock version.");
  if (tag !== undefined && tag !== `v${pkg.version}`)
    throw new Error("Release tag must exactly match v<package version>.");
  return pkg.version;
}
export function buildIdentity(root) {
  const changes = git(root, ["status", "--porcelain", "--untracked-files=all"]).trim();
  if (changes) console.warn(`Build checkout changes:\n${changes}`);
  if (process.env.VERCEL === "1" && changes.includes("vercel.json"))
    console.warn(git(root, ["diff", "--", "vercel.json"]));
  return {
    format: 1,
    name: "fauna",
    version: releaseVersion(root),
    commit: git(root, ["rev-parse", "HEAD"]).trim(),
    tree: git(root, ["rev-parse", "HEAD^{tree}"]).trim(),
    dirty: !!changes,
  };
}
export function verifyBuildIdentity(record, expected) {
  if (
    record.format !== 1 ||
    record.name !== "fauna" ||
    record.dirty ||
    expected.dirty ||
    record.version !== expected.version ||
    record.commit !== expected.commit ||
    record.tree !== expected.tree
  )
    throw new Error(
      "Renderer build is dirty, stale, or belongs to a different release commit. Build from the clean release commit.",
    );
}
export function releaseIdentityPlugin(root) {
  let initial;
  return {
    name: "fauna-release-identity",
    apply: "build",
    buildStart() {
      initial = buildIdentity(root);
    },
    generateBundle() {
      const final = buildIdentity(root);
      // Dirty development builds remain usable, but can never pass release verification.
      const record = {
        ...initial,
        dirty: initial.dirty || final.dirty || initial.commit !== final.commit || initial.tree !== final.tree,
      };
      this.emitFile({
        type: "asset",
        fileName: "release.json",
        source: JSON.stringify(record, null, 2) + "\n",
      });
    },
  };
}

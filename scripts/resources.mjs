import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git, worktrees } from "./lib/git.mjs";
import { matchingDependencies, dependenciesAvailable } from "./dependencies.mjs";
import { fileHash } from "./lib/file-integrity.mjs";

export function mediaInventory(receipt) {
  const records = [...new Map(Object.values(receipt.records).map((record) => [record.url, record])).values()];
  return {
    ids: Object.keys(receipt.records).length,
    files: records.length,
    bytes: records.reduce((sum, record) => sum + record.outputBytes, 0),
    nominalRgbaBytes: records.reduce(
      (sum, record) => sum + (record.width ?? 0) * (record.height ?? 0) * 4,
      0,
    ),
    note: "Pixel dimensions times four are an inventory estimate, not measured resident memory",
  };
}

async function directoryBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) bytes += await directoryBytes(file);
    else if (entry.isFile()) bytes += (await stat(file)).size;
    else throw new Error(`Unexpected resource symlink: ${file}`);
  }
  return bytes;
}

function allocatedBytes(directory) {
  const result = spawnSync("du", ["-sk", directory], { encoding: "utf8", timeout: 30_000 });
  return result.status === 0 ? Number(result.stdout.split(/\s/)[0]) * 1024 : null;
}

export async function evidenceDuplicates(directories) {
  const sizes = new Map();
  const unstable = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (entries.some((entry) => entry.name === ".retention-keep")) return;
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) {
        const info = await stat(file);
        // Small files include summaries/receipts; retain them rather than proposing busywork.
        if (info.size < 65536) continue;
        const group = sizes.get(info.size) ?? [];
        group.push({ file, bytes: info.size, mtimeMs: info.mtimeMs, ino: info.ino });
        sizes.set(info.size, group);
      }
    }
  }
  for (const directory of directories) await visit(directory);
  const hashes = new Map();
  for (const group of sizes.values()) {
    if (group.length < 2) continue;
    for (const entry of group) {
      try {
        const hash = await fileHash(entry.file);
        const after = await stat(entry.file);
        if (after.size !== entry.bytes || after.mtimeMs !== entry.mtimeMs || after.ino !== entry.ino) {
          unstable.push(entry.file);
          continue;
        }
        const matches = hashes.get(hash) ?? [];
        matches.push(entry);
        hashes.set(hash, matches);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        unstable.push(entry.file);
      }
    }
  }
  const groups = [...hashes]
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({
      hash,
      retained: files[0],
      duplicates: files.slice(1),
    }));
  return {
    groups,
    unstable,
    duplicateLogicalBytes: groups.reduce(
      (sum, group) => sum + group.duplicates.reduce((n, entry) => n + entry.bytes, 0),
      0,
    ),
    policy: "Review only; revalidate copies and inactivity before any separately approved deletion",
  };
}

export async function resourceInventory(root, { local = false, evidence = false } = {}) {
  const receipt = JSON.parse(await readFile(path.join(root, "src/assets/prepared.json"), "utf8"));
  const report = {
    version: 1,
    commit: git(root, ["rev-parse", "HEAD"]).trim(),
    dirty: Boolean(git(root, ["status", "--porcelain", "--untracked-files=all"])),
    media: mediaInventory(receipt),
  };
  for (const [name, directory] of [
    ["rendererBytes", "dist"],
    ["windowsBytes", "release/win-unpacked"],
  ]) {
    try {
      report[name] = await directoryBytes(path.join(root, directory));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (local) {
    const common = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
    report.local = {
      note: "du allocation can include APFS shared extents; clean and merged do not establish inactivity",
      archives: allocatedBytes(path.join(common, "fauna-worktree-archives")),
      mainDependenciesHealthy: dependenciesAvailable(
        worktrees(root).find((tree) => tree.branch === "refs/heads/main").path,
      ),
      worktrees: worktrees(root).map((tree) => {
        const dirty = Boolean(git(tree.path, ["status", "--porcelain", "--untracked-files=all"]));
        const head = git(tree.path, ["rev-parse", "HEAD"]).trim();
        const merged =
          spawnSync("git", ["merge-base", "--is-ancestor", head, "main"], { cwd: root }).status === 0;
        return {
          ...tree,
          head,
          dirty,
          merged,
          dependencyBytes: allocatedBytes(path.join(tree.path, "node_modules")),
          matchingDependencyDefinitions: matchingDependencies(root, tree.path),
          cleanup:
            tree.branch === "refs/heads/main" || tree.locked || dirty || !merged
              ? "preserve"
              : "requires inactivity confirmation",
        };
      }),
    };
  }
  if (evidence) {
    const common = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
    const main = worktrees(root).find((tree) => tree.branch === "refs/heads/main").path;
    report.evidence = await evidenceDuplicates([
      path.join(common, "fauna-worktree-archives"),
      path.join(main, "reports"),
    ]);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let output,
    local = false,
    evidence = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--local") local = true;
    else if (args[i] === "--evidence") evidence = true;
    else if (args[i] === "--out" && args[i + 1]) output = path.resolve(args[++i]);
    else throw new Error("Usage: resources -- [--local] [--evidence] [--out reports/path.json]");
  }
  const report = await resourceInventory(process.cwd(), { local, evidence });
  if (output) {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(report, null, 2));
}

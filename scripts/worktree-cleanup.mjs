import {
  closeSync,
  constants,
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readlinkSync,
  readSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertClean, git, worktrees } from "./lib/git.mjs";
import { acquireIntegrationLock } from "./lib/integration-lock.mjs";

const taskBranch = /^(?:task|codex)\//;
const rebuildable = new Set(["node_modules", "dist"]);
const ignoredEvidence = (root) =>
  git(root, ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"])
    .split("\0")
    .filter((file) => file && !rebuildable.has(file.replace(/\/$/u, "")));

// Compare bytes without loading large recordings into memory, and never follow evidence symlinks.
export function verifyEvidence(source, copy) {
  const original = lstatSync(source),
    archived = lstatSync(copy);
  const mismatch = () => {
    throw new Error(`Evidence verification failed: ${source}`);
  };
  if (original.isSymbolicLink()) {
    if (!archived.isSymbolicLink() || readlinkSync(source) !== readlinkSync(copy)) mismatch();
  } else if (original.isDirectory()) {
    if (!archived.isDirectory() || archived.isSymbolicLink()) mismatch();
    const names = readdirSync(source).sort(),
      copies = readdirSync(copy).sort();
    if (names.length !== copies.length || names.some((name, index) => name !== copies[index])) mismatch();
    for (const name of names) verifyEvidence(path.join(source, name), path.join(copy, name));
  } else if (original.isFile()) {
    if (!archived.isFile() || archived.isSymbolicLink() || original.size !== archived.size) mismatch();
    const input = openSync(source, "r");
    try {
      const output = openSync(copy, "r");
      try {
        const a = Buffer.allocUnsafe(64 * 1024),
          b = Buffer.allocUnsafe(64 * 1024);
        for (;;) {
          const n = readSync(input, a, 0, a.length, null),
            m = readSync(output, b, 0, b.length, null);
          if (n !== m || !a.subarray(0, n).equals(b.subarray(0, m))) mismatch();
          if (!n) break;
        }
      } finally {
        closeSync(output);
      }
    } finally {
      closeSync(input);
    }
  } else mismatch();
}

// The caller holds the integration lock. Git still independently refuses dirty/locked removal.
export function removeMergedTask(root, branch, { keepBranch = false, copyEvidence = cpSync } = {}) {
  assertClean(root, "main");
  if (!taskBranch.test(branch)) throw new Error(`Not a task branch: ${branch}`);
  const head = git(root, ["rev-parse", "--verify", `refs/heads/${branch}`]).trim();
  git(root, ["merge-base", "--is-ancestor", head, "main"]);
  const task = worktrees(root).find((entry) => entry.branch === `refs/heads/${branch}`);
  let archive;
  if (task) {
    if (realpathSync(task.path) === realpathSync(root)) throw new Error("Cannot remove main checkout.");
    if (task.locked) throw new Error(`Locked worktree: ${task.path}`);
    assertClean(task.path, branch);
    const ignored = ignoredEvidence(task.path);
    if (ignored.length) {
      const common = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
      const archives = path.join(common, "fauna-worktree-archives");
      mkdirSync(archives, { recursive: true });
      archive = mkdtempSync(path.join(archives, "task-"));
      writeFileSync(
        path.join(archive, "manifest.json"),
        JSON.stringify({ branch, head, source: task.path, ignored }, null, 2),
      );
      for (const file of ignored) {
        const target = path.join(archive, "files", file);
        mkdirSync(path.dirname(target), { recursive: true });
        copyEvidence(path.join(task.path, file), target, {
          recursive: true,
          verbatimSymlinks: true,
          mode: constants.COPYFILE_FICLONE,
          preserveTimestamps: true,
        });
      }
      for (const file of ignored)
        verifyEvidence(path.join(task.path, file), path.join(archive, "files", file));
    }
    const current = ignoredEvidence(task.path);
    if (current.length !== ignored.length || current.some((file, index) => file !== ignored[index]))
      throw new Error("Evidence changed during cleanup; preserved checkout.");
    assertClean(task.path, branch);
    if (git(root, ["rev-parse", `refs/heads/${branch}`]).trim() !== head)
      throw new Error("Task advanced during cleanup; preserved checkout.");
    git(root, ["worktree", "remove", task.path]);
  }
  if (keepBranch) return { branch, path: task?.path, archive };
  // Ordinary deletion refuses a branch that acquired unmerged commits in the meantime.
  git(root, [
    "-c",
    `branch.${branch}.remote=.`,
    "-c",
    `branch.${branch}.merge=refs/heads/main`,
    "branch",
    "-d",
    branch,
  ]);
  return { branch, path: task?.path, archive };
}

export async function cleanupWorktrees(root, { apply = false, log = console.log } = {}) {
  const release = await acquireIntegrationLock(root);
  try {
    assertClean(root, "main");
    const branches = git(root, ["for-each-ref", "--format=%(refname:short)", "refs/heads"])
      .trim()
      .split("\n")
      .filter((branch) => taskBranch.test(branch));
    const results = [];
    for (const branch of branches) {
      try {
        git(root, ["merge-base", "--is-ancestor", `refs/heads/${branch}`, "main"]);
        const task = worktrees(root).find((entry) => entry.branch === `refs/heads/${branch}`);
        if (task?.locked) throw new Error(`Locked worktree: ${task.path}`);
        if (task) assertClean(task.path, branch);
      } catch (error) {
        results.push({ branch, status: "preserved", reason: error.message });
        log(`Preserved ${branch}: ${error.message}`);
        continue;
      }
      try {
        const result = apply ? removeMergedTask(root, branch) : { branch };
        results.push({ ...result, status: apply ? "removed" : "eligible" });
        log(
          `${apply ? "Removed" : "Eligible"} ${branch}${result.archive ? `; artifacts: ${result.archive}` : ""}`,
        );
      } catch (error) {
        results.push({ branch, status: "failed", reason: error.message });
        log(`Cleanup failed for ${branch}: ${error.message}`);
      }
    }
    return results;
  } finally {
    await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--apply"))
    throw new Error("Usage: npm run worktree:cleanup -- [--apply]");
  const results = await cleanupWorktrees(process.cwd(), { apply: args[0] === "--apply" });
  if (results.some((entry) => entry.status === "failed")) process.exitCode = 1;
  console.log(
    `${results.filter((entry) => entry.status === "preserved").length} unfinished or protected tasks preserved; these do not block other tasks.`,
  );
}

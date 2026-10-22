import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export function git(root, args) {
  return execFileSync("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function worktrees(root) {
  return git(root, ["worktree", "list", "--porcelain", "-z"])
    .split("\0\0")
    .filter(Boolean)
    .map((record) => {
      const fields = record.split("\0");
      return {
        path: fields[0].slice(9),
        branch: fields.find((field) => field.startsWith("branch "))?.slice(7),
        locked: fields.some((field) => field === "locked" || field.startsWith("locked ")),
      };
    });
}

export function assertClean(root, branch) {
  if (git(root, ["branch", "--show-current"]).trim() !== branch)
    throw new Error(`Expected ${branch} checkout: ${root}`);
  if (git(root, ["status", "--porcelain", "--untracked-files=all"]))
    throw new Error(`Commit or preserve unfinished work before integration: ${root}`);
  for (const marker of [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "BISECT_START",
    "rebase-merge",
    "rebase-apply",
    "sequencer",
  ]) {
    const file = git(root, ["rev-parse", "--git-path", marker]).trim();
    if (existsSync(path.resolve(root, file)))
      throw new Error(`Unfinished Git operation (${marker}): ${root}`);
  }
}

import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { git, worktrees, assertClean } from "./lib/git.mjs";
import { acquireIntegrationLock } from "./lib/integration-lock.mjs";
import { removeMergedTask } from "./worktree-cleanup.mjs";
import { npmCommand } from "./lib/npm-command.mjs";

export async function integrate(
  root,
  branch,
  { runner = spawnSync, log = console.log, cleanup = removeMergedTask, lockTimeoutMs = 30_000 } = {},
) {
  if (!/^(?:task|codex)\//.test(branch ?? "")) throw new Error("Provide a task/ or codex/ branch.");
  const release = await acquireIntegrationLock(root, {
    timeoutMs: lockTimeoutMs,
    onBusy: () => log(`Waiting up to ${lockTimeoutMs / 1000} seconds for the shared integration lock…`),
  });
  try {
    assertClean(root, "main");
    const mainHead = git(root, ["rev-parse", "HEAD"]).trim();
    const task = worktrees(root).find((entry) => entry.branch === `refs/heads/${branch}`)?.path;
    if (!task) throw new Error("Task branch must be checked out in its task worktree.");
    assertClean(task, branch);
    git(task, ["merge", "--no-edit", mainHead]);
    const verifiedHead = git(task, ["rev-parse", "HEAD"]).trim();
    const [command, argv] = npmCommand(["run", "verify", "--", "--base", mainHead]);
    const result = runner(command, argv, { cwd: task, stdio: "inherit" });
    if (result.error || result.status !== 0)
      throw new Error("Combined local check failed; main was not advanced.");
    assertClean(root, "main");
    assertClean(task, branch);
    if (
      git(root, ["rev-parse", "HEAD"]).trim() !== mainHead ||
      git(task, ["rev-parse", "HEAD"]).trim() !== verifiedHead
    )
      throw new Error("A branch advanced during verification; main was not advanced.");
    git(root, ["merge", "--ff-only", verifiedHead]);
    log(`Integrated ${branch} into main after the local gate. Full CI validation remains pending.`);
    try {
      const { archive } = cleanup(root, branch);
      log(`Removed integrated task checkout and branch.${archive ? ` Artifacts: ${archive}` : ""}`);
      return { integrated: true, commit: verifiedHead, cleanup: { status: "complete", archive } };
    } catch (error) {
      log(`Integration succeeded at ${verifiedHead}. Cleanup remains pending: ${error.message}`);
      return {
        integrated: true,
        commit: verifiedHead,
        cleanup: { status: "pending", reason: error.message },
      };
    }
  } finally {
    await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/integrate.mjs <task-branch>");
  await integrate(process.cwd(), process.argv[2]);
}

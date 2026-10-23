import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { git, worktrees, assertClean } from "./lib/git.mjs";
import { acquireIntegrationLock } from "./lib/integration-lock.mjs";
import { npmCommand } from "./lib/npm-command.mjs";

export async function integrate(
  root,
  branch,
  { runner = spawnSync, log = console.log, lockTimeoutMs = 30_000, tests = [] } = {},
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
    const [command, argv] = npmCommand([
      "run",
      "verify:changed",
      "--",
      "--base",
      mainHead,
      ...tests.flatMap((suite) => ["--test", suite]),
    ]);
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
    log(`Retained ${task} and ${branch} for follow-up work and evidence. Cleanup is separate maintenance.`);
    return { integrated: true, commit: verifiedHead, worktree: task };
  } finally {
    await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [branch, ...args] = process.argv.slice(2);
  const tests = [];
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] !== "--test" || !args[i + 1] || args[i + 1].startsWith("-"))
      throw new Error("Usage: npm run integrate -- <task-branch> [--test <suite> ...]");
    tests.push(args[i + 1]);
  }
  await integrate(process.cwd(), branch, { tests });
}

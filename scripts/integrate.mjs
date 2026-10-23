import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { git, worktrees, assertClean } from "./lib/git.mjs";
import { acquireIntegrationLock } from "./lib/integration-lock.mjs";
import { npmCommand } from "./lib/npm-command.mjs";
import { ensureDependencies } from "./dependencies.mjs";
import { taskIntent, recordTaskIntent } from "./lib/task-intent.mjs";

export async function integrate(
  root,
  branch,
  { runner = spawnSync, log = console.log, lockTimeoutMs = 30_000, tests = [] } = {},
) {
  branch ??= git(root, ["branch", "--show-current"]).trim();
  if (!branch || branch === "main")
    throw new Error("Run npm run finish in a task checkout, or provide its branch to npm run integrate.");
  git(root, ["check-ref-format", "--branch", branch]);
  const trees = worktrees(root);
  const main = trees.find((entry) => entry.branch === "refs/heads/main")?.path;
  const task = trees.find((entry) => entry.branch === `refs/heads/${branch}`)?.path;
  if (!main || !task || task === main)
    throw new Error("Main and task branches must have separate registered worktrees.");
  if (ensureDependencies(task) !== 0)
    throw new Error("Could not prepare task dependencies; main was not advanced.");
  root = main;
  const release = await acquireIntegrationLock(root, {
    timeoutMs: lockTimeoutMs,
    onBusy: (owner) =>
      log(`Waiting up to ${lockTimeoutMs / 1000} seconds for the shared integration lock (${owner})…`),
  });
  try {
    assertClean(root, "main");
    const mainHead = git(root, ["rev-parse", "HEAD"]).trim();
    assertClean(task, branch);
    git(task, ["merge", "--no-edit", mainHead]);
    const selectedTests = [...new Set([...taskIntent(task).tests, ...tests])];
    const verifiedHead = git(task, ["rev-parse", "HEAD"]).trim();
    const [command, argv] = npmCommand([
      "run",
      "verify:changed",
      "--",
      "--base",
      mainHead,
      ...selectedTests.flatMap((suite) => ["--test", suite]),
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
    recordTaskIntent(task, { base: verifiedHead, forget: selectedTests });
    log(`Integrated ${branch} into main after the local gate. Full CI validation remains pending.`);
    log(`Retained ${task} and ${branch} for follow-up work and evidence. Cleanup is separate maintenance.`);
    return { integrated: true, commit: verifiedHead, worktree: task };
  } finally {
    await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const branch = args[0] && !args[0].startsWith("-") ? args.shift() : undefined;
  const tests = [];
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] !== "--test" || !args[i + 1] || args[i + 1].startsWith("-"))
      throw new Error(
        "Usage: npm run integrate -- [task-branch] [--test <suite> ...]; npm run finish from a task checkout",
      );
    tests.push(args[i + 1]);
  }
  await integrate(process.cwd(), branch, { tests });
}

import path from "node:path";
import { pathToFileURL } from "node:url";
import { integrate } from "./integrate.mjs";
import { removeMergedTask } from "./worktree-cleanup.mjs";
import { acquireIntegrationLock } from "./lib/integration-lock.mjs";
import { git, worktrees } from "./lib/git.mjs";

// Finish retires only its calling task, after integration and preservation.
// Explicit integration still retains a checkout for ongoing reviews/previews.
export async function finishTask(root, { keepWorktree = false, integrateTask = integrate, ...options } = {}) {
  const branch = git(root, ["branch", "--show-current"]).trim();
  const result = await integrateTask(root, branch, options);
  if (keepWorktree) return result;
  const main = worktrees(root).find((tree) => tree.branch === "refs/heads/main")?.path;
  if (!main || result.worktree !== root) throw new Error("Unexpected completed task; checkout preserved");
  const release = await acquireIntegrationLock(main);
  try {
    process.chdir(main);
    const retired = removeMergedTask(main, branch, { keepBranch: true });
    console.log(
      `Finished ${branch}; removed its checkout after preserving ignored evidence; retained branch${retired.archive ? ` and archive ${retired.archive}` : ""}.`,
    );
    return { ...result, retired };
  } finally {
    await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    tests = [];
  const keepWorktree = args.includes("--keep-worktree");
  const selected = args.filter((arg) => arg !== "--keep-worktree");
  for (let index = 0; index < selected.length; index += 2) {
    if (selected[index] !== "--test" || !selected[index + 1])
      throw new Error("Usage: npm run finish -- [--keep-worktree] [--test <suite>]");
    tests.push(selected[index + 1]);
  }
  await finishTask(process.cwd(), { keepWorktree, tests });
}

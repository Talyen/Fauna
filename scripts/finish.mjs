import path from "node:path";
import { pathToFileURL } from "node:url";
import { integrate } from "./integrate.mjs";
import { removeMergedTask } from "./worktree-cleanup.mjs";
import { acquireIntegrationLock } from "./lib/integration-lock.mjs";
import { git, worktrees } from "./lib/git.mjs";
import { expireEvidence } from "./lib/evidence-retention.mjs";
import { expireCheckoutReviews } from "./lib/review-retention.mjs";

// Finish retires only its calling task, after integration and preservation.
// Explicit integration still retains a checkout for ongoing reviews/previews.
export async function finishTask(
  root,
  { keepWorktree = false, retryCleanup = false, integrateTask = integrate, ...options } = {},
) {
  if (keepWorktree && retryCleanup) throw new Error("Choose --keep-worktree or --retry-cleanup.");
  try {
    const common = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
    const removed = expireEvidence(path.join(common, "fauna-worktree-archives"));
    if (removed.length) console.log(`Expired evidence from ${removed.length} completed task outputs.`);
    const main = worktrees(root).find((tree) => tree.branch === "refs/heads/main")?.path;
    if (main) {
      const reviews = expireCheckoutReviews(main);
      if (reviews.length)
        console.log(`Expired ${reviews.length} reconstructible main-checkout review patches.`);
    }
  } catch (error) {
    console.warn(`Evidence expiration skipped: ${error.message}`);
  }
  const branch = git(root, ["branch", "--show-current"]).trim();
  const result = retryCleanup
    ? { integrated: false, worktree: root }
    : await integrateTask(root, branch, options);
  if (keepWorktree) return result;
  const main = worktrees(root).find((tree) => tree.branch === "refs/heads/main")?.path;
  if (!main || result.worktree !== root) throw new Error("Unexpected completed task; checkout preserved");
  let release;
  const previous = process.cwd();
  try {
    release = await acquireIntegrationLock(main);
    process.chdir(main);
    const retired = removeMergedTask(main, branch, { keepBranch: true });
    console.log(
      `Finished ${branch}; removed its checkout after preserving ignored evidence; retained branch${retired.archive ? ` and archive ${retired.archive}` : ""}.`,
    );
    return { ...result, retired };
  } catch (error) {
    process.chdir(previous);
    throw new Error(
      `${retryCleanup ? "Cleanup retry failed" : "Integration completed, but cleanup failed"}: ${error.message}\n` +
        `Checkout and branch preserved. After resolving the issue, run npm run finish -- --retry-cleanup in ${root}.`,
      { cause: error },
    );
  } finally {
    if (release) await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    tests = [];
  const keepWorktree = args.includes("--keep-worktree");
  const retryCleanup = args.includes("--retry-cleanup");
  const selected = args.filter((arg) => arg !== "--keep-worktree" && arg !== "--retry-cleanup");
  if (retryCleanup && (keepWorktree || selected.length))
    throw new Error("--retry-cleanup cannot be combined with --keep-worktree or --test.");
  for (let index = 0; index < selected.length; index += 2) {
    if (selected[index] !== "--test" || !selected[index + 1])
      throw new Error("Usage: npm run finish -- [--keep-worktree] [--test <suite>] | --retry-cleanup");
    tests.push(selected[index + 1]);
  }
  await finishTask(process.cwd(), { keepWorktree, retryCleanup, tests });
}

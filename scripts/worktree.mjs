import { existsSync, mkdirSync, symlinkSync, realpathSync, lstatSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git, worktrees } from "./lib/git.mjs";
import { matchingDependencies, dependenciesAvailable } from "./dependencies.mjs";
import { storageProfile, populateWorktree } from "./lib/worktree-storage.mjs";
import { recordTaskIntent, taskIntent } from "./lib/task-intent.mjs";

export function createWorktree(root, slug, base = "main", options = {}) {
  root = realpathSync(root);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? "") || slug.length > 64)
    throw new Error(
      "Use a lowercase task name with letters, numbers and single hyphens (at most 64 characters).",
    );
  if (git(root, ["branch", "--show-current"]).trim() !== "main")
    throw new Error("Create task worktrees from the main checkout.");
  const commit = git(root, ["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`]).trim();
  const target = path.join(root, ".worktrees", slug);
  const branch = `task/${slug}`;
  const registered = worktrees(root).find((entry) => entry.path === target);
  if (registered) {
    if (registered.branch !== `refs/heads/${branch}`)
      throw new Error("Existing task worktree has a different branch; preserve it.");
    if (!taskIntent(target).base)
      recordTaskIntent(target, { base: git(target, ["merge-base", "HEAD", base]).trim() });
    return {
      path: target,
      branch,
      reused: true,
      linked:
        lstatSync(path.join(target, "node_modules"), { throwIfNoEntry: false })?.isSymbolicLink() ?? false,
    };
  }
  if (existsSync(target))
    throw new Error("Task directory already exists; preserve it and choose another name.");
  if (git(root, ["branch", "--list", branch]).trim())
    throw new Error("Task branch already exists; inspect it before choosing another name.");
  mkdirSync(path.dirname(target), { recursive: true });
  git(root, ["worktree", "add", "--no-checkout", "-b", branch, target, commit]);
  populateWorktree(root, target, storageProfile(root, commit, options));
  recordTaskIntent(target, { base: commit });
  let linked = false;
  if (
    matchingDependencies(root, target) &&
    existsSync(path.join(root, "node_modules")) &&
    dependenciesAvailable(root)
  ) {
    try {
      symlinkSync(
        path.join(root, "node_modules"),
        path.join(target, "node_modules"),
        process.platform === "win32" ? "junction" : "dir",
      );
      linked = true;
    } catch {
      // The checkout remains usable when symlink permissions require a separate install.
    }
  }
  return { path: target, branch, reused: false, linked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const fullAssets = args.includes("--full-assets");
  const [slug, base, ...extra] = args.filter((arg) => arg !== "--full-assets");
  if (!slug || extra.length)
    throw new Error("Usage: npm run worktree -- <task-name> [base-ref] [--full-assets]");
  const result = createWorktree(process.cwd(), slug, base, { fullAssets });
  console.log(`${result.reused ? "Reusing" : "Created"} ${result.path} on ${result.branch}.`);
  console.log(
    existsSync(path.join(result.path, "node_modules"))
      ? "Dependencies available; run npm run deps after dependency changes or missing-package errors."
      : "Run npm run deps in the task checkout before verification.",
  );
}

import { existsSync, mkdirSync, readFileSync, symlinkSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git, worktrees } from "./lib/git.mjs";

export function createWorktree(root, slug, base = "main") {
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
    return { path: target, branch, reused: true, linked: existsSync(path.join(target, "node_modules")) };
  }
  if (existsSync(target))
    throw new Error("Task directory already exists; preserve it and choose another name.");
  if (git(root, ["branch", "--list", branch]).trim())
    throw new Error("Task branch already exists; inspect it before choosing another name.");
  mkdirSync(path.dirname(target), { recursive: true });
  git(root, ["worktree", "add", "-b", branch, target, commit]);
  let linked = false;
  const matchingDependencies = ["package.json", "package-lock.json"].every(
    (file) =>
      existsSync(path.join(root, file)) &&
      existsSync(path.join(target, file)) &&
      readFileSync(path.join(root, file)).equals(readFileSync(path.join(target, file))),
  );
  if (matchingDependencies && existsSync(path.join(root, "node_modules"))) {
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
  const [slug, base, ...extra] = process.argv.slice(2);
  if (!slug || extra.length) throw new Error("Usage: npm run worktree -- <task-name> [base-ref]");
  const result = createWorktree(process.cwd(), slug, base);
  console.log(`${result.reused ? "Reusing" : "Created"} ${result.path} on ${result.branch}.`);
  console.log(
    result.linked
      ? "Dependencies available; use a separate install if dependency manifests change."
      : "Run npm ci in the task checkout before verification.",
  );
}

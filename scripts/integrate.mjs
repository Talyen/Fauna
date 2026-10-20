import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const git = (args, cwd = process.cwd()) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const branch = process.argv[2];
if (!branch || branch === "main" || branch.startsWith("-")) throw new Error("Provide a task branch.");
if (git(["branch", "--show-current"]) !== "main" || git(["status", "--porcelain"]))
  throw new Error("Run from a clean main checkout.");
const common = path.resolve(git(["rev-parse", "--git-common-dir"]));
const lock = path.join(common, "fauna-integration.lock");
try {
  await mkdir(lock);
} catch {
  throw new Error("Integration lock is occupied. Retry later; do not remove another process’s lock.");
}
try {
  await writeFile(path.join(lock, "owner"), `${process.pid}\n`);
  const mainHead = git(["rev-parse", "main"]);
  const entries = git(["worktree", "list", "--porcelain"]).split("\n\n");
  const entry = entries.find((e) => e.split("\n").includes(`branch refs/heads/${branch}`));
  if (!entry) throw new Error("Task branch must be checked out in its task worktree.");
  const task = entry.split("\n")[0].slice(9);
  if (git(["status", "--porcelain"], task)) throw new Error("Commit task changes before integration.");
  if (git(["branch", "--show-current"], task) !== branch) throw new Error("Task checkout changed branches.");
  git(["merge", "--no-edit", "main"], task);
  const verifiedHead = git(["rev-parse", "HEAD"], task);
  const result = spawnSync("npm", ["run", "check", "--", "--base", mainHead], {
    cwd: task,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Combined local check failed; main was not advanced.");
  if (git(["status", "--porcelain"]) || git(["status", "--porcelain"], task))
    throw new Error("Checkout changed during verification; main was not advanced.");
  if (
    git(["branch", "--show-current"]) !== "main" ||
    git(["rev-parse", "main"]) !== mainHead ||
    git(["rev-parse", "HEAD"], task) !== verifiedHead
  )
    throw new Error("A branch advanced during verification; main was not advanced.");
  git(["merge", "--ff-only", verifiedHead]);
  console.log(
    `Integrated ${branch} into main after the local gate. Full CI validation remains pending. Task worktree retained.`,
  );
} finally {
  await rm(lock, { recursive: true });
}

import { execFileSync } from "node:child_process";
import { existsSync, symlinkSync, readFileSync } from "node:fs";
import path from "node:path";

const task = process.argv[2];
if (!task || !/^[a-z][a-z0-9-]{0,63}$/.test(task)) throw new Error("Usage: npm run task:create -- task-name");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const common = path.resolve(git("rev-parse", "--git-common-dir"));
const entries = git("worktree", "list", "--porcelain").split("\n\n");
const main = entries
  .find((entry) => entry.split("\n").includes("branch refs/heads/main"))
  ?.split("\n")[0]
  ?.slice(9);
if (!main) throw new Error("A main worktree is required.");
const branch = `task/${task}`;
const existing = entries.find((entry) => entry.split("\n").includes(`branch refs/heads/${branch}`));
const directory =
  existing?.split("\n")[0]?.slice(9) ?? path.join(path.dirname(main), `${path.basename(main)}-${task}`);
if (!existing) {
  if (existsSync(directory)) throw new Error(`Refusing to replace ${directory}`);
  execFileSync("git", ["worktree", "add", "-b", branch, directory, "main"], { stdio: "inherit" });
}
const modules = path.join(directory, "node_modules");
if (!existsSync(modules) && existsSync(path.join(main, "node_modules"))) {
  const taskLock = execFileSync("git", ["show", `${branch}:package-lock.json`], { cwd: main });
  const mainLock = execFileSync("git", ["show", "main:package-lock.json"], { cwd: main });
  if (
    taskLock.equals(mainLock) &&
    mainLock.equals(readFileSync(path.join(main, "package-lock.json"))) &&
    taskLock.equals(readFileSync(path.join(directory, "package-lock.json"))) &&
    readFileSync(path.join(main, "package.json")).equals(readFileSync(path.join(directory, "package.json")))
  )
    symlinkSync(path.join(main, "node_modules"), modules, "junction");
}
console.log(
  JSON.stringify({ directory, branch, integrationLock: path.join(common, "fauna-integration.lock") }),
);

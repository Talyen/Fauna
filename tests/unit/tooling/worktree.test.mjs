import { git, readFixture, repository, writeFixture } from "../../support/tooling.mjs";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { checkDocumentation } from "../../../scripts/checks/check-docs.mjs";
import { finishTask } from "../../../scripts/finish.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";
it("creates and reuses a task checkout from committed main while preserving dirty files", () => {
  const main = repository(
    {
      ".gitignore": "node_modules\n.worktrees/\n",
      "package-lock.json": "{}",
      "package.json": "{}",
      keep: "committed",
    },
    "fauna-worktrees-",
  );
  mkdirSync(path.join(main, "node_modules"));
  writeFixture(main, "keep", "unrelated dirty work");
  const create = () => createWorktree(main, "example");
  const task = create();
  expect(readFixture(main, "keep")).toBe("unrelated dirty work");
  expect(readFixture(task.path, "keep")).toBe("committed");
  expect(realpathSync(path.join(task.path, "node_modules"))).toBe(
    realpathSync(path.join(main, "node_modules")),
  );
  writeFixture(task.path, "keep", "task edits");
  expect(create().path).toBe(task.path);
  expect(readFixture(task.path, "keep")).toBe("task edits");
});

// Several real Git/Node processes exercise safety, not application latency; the task gate still caps the suite at 60 seconds.
it(
  "completes cleanup while preserving unrelated unfinished work, but reports artifact archival failures",
  { timeout: 45_000 },
  () => {
    const directory = repository(
      {
        ".gitignore": ".worktrees/\nreports/\n",
        keep: "main",
      },
      "fauna-cleanup-",
    );
    const script = path.resolve(import.meta.dirname, "../../../scripts/worktree-cleanup.mjs");
    const cleanup = () =>
      spawnSync(process.execPath, [script, "--apply"], { cwd: directory, encoding: "utf8" });
    const runGit = (...args) => git(directory, ...args);
    runGit("branch", "task/merged");
    const unfinished = createWorktree(directory, "unfinished");
    writeFixture(unfinished.path, "keep", "unfinished work");
    const result = cleanup();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Preserved task/unfinished");
    expect(runGit("branch", "--list", "task/merged").trim()).toBe("");
    expect(readFixture(unfinished.path, "keep")).toBe("unfinished work");
    const archived = createWorktree(directory, "archive");
    mkdirSync(path.join(archived.path, "reports"));
    writeFixture(archived.path, "reports/evidence.json", "{}");
    writeFixture(directory, ".git/fauna-worktree-archives", "block archive directory");
    const failure = cleanup();
    expect(failure.status).not.toBe(0);
    expect(failure.stdout).toContain("Cleanup failed for task/archive");
    expect(readFixture(archived.path, "reports/evidence.json")).toBe("{}");
    rmSync(path.join(directory, ".git/fauna-integration.lock"));
    mkdirSync(path.join(directory, ".git/fauna-integration.lock"));
    expect(cleanup().status).not.toBe(0);
  },
);

it("verifies automatic storage defaults and independent tracked clones", { timeout: 30_000 }, () => {
  const result = spawnSync(
    process.execPath,
    [
      new URL("../../fixtures/worktree-storage-check.mjs", import.meta.url).pathname,
      new URL("../../../scripts/lib/worktree-storage.mjs", import.meta.url).pathname,
    ],
    { encoding: "utf8", timeout: 25_000 },
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

it("validates sparse documentation references without hiding deleted files or broken anchors", () => {
  const root = repository(
    {
      "package.json": "{}",
      "public/art/master.png": "source",
      "public/art/guide.md": "# Source master\n",
      "README.md": "[Art](public/art/master.png) [Guide](public/art/guide.md#source-master)\n`public/art/`\n",
    },
    "fauna-sparse-docs-",
  );
  git(root, "sparse-checkout", "set", "--no-cone", "/*", "!/public/art/");
  expect(checkDocumentation(root)).toEqual([]);
  writeFixture(root, "README.md", "[Guide](public/art/guide.md#absent)\n");
  expect(checkDocumentation(root)).toEqual(["README.md: missing heading public/art/guide.md#absent"]);
  git(root, "sparse-checkout", "disable");
  writeFixture(root, "README.md", "[Art](public/art/master.png)\n");
  rmSync(path.join(root, "public/art/master.png"));
  expect(checkDocumentation(root)).toEqual(["README.md: missing link public/art/master.png"]);
});

it("finishes only its completed task while retaining its branch and ignored evidence", async () => {
  const previous = process.cwd();
  const root = repository({ ".gitignore": ".worktrees/\nreports/\n", done: "base" }, "fauna-finish-");
  try {
    const task = createWorktree(root, "finished");
    mkdirSync(path.join(task.path, "reports"));
    writeFixture(task.path, "reports/unique.trace", "keep original evidence");
    const integrateTask = async () => ({ integrated: true, worktree: task.path });
    await finishTask(task.path, { keepWorktree: true, integrateTask });
    expect(readFixture(task.path, "reports/unique.trace")).toBe("keep original evidence");
    const result = await finishTask(task.path, { integrateTask });
    expect(readFixture(result.retired.archive, "files/reports/unique.trace")).toBe("keep original evidence");
    expect(git(root, "branch", "--list", task.branch).trim()).toContain(task.branch);
  } finally {
    process.chdir(previous);
  }
});

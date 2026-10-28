import { git, put, readFixture, repository, writeFixture } from "../../support/tooling.mjs";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { checkDocumentation } from "../../../scripts/checks/check-docs.mjs";
import { finishTask } from "../../../scripts/finish.mjs";
import { removeMergedTask, verifyEvidence } from "../../../scripts/worktree-cleanup.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";
import { expireEvidence } from "../../../scripts/lib/evidence-retention.mjs";
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
  { timeout: ciTimeout(45_000) },
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

it(
  "verifies automatic storage defaults and independent tracked clones",
  { timeout: ciTimeout(30_000) },
  () => {
    const result = spawnSync(
      process.execPath,
      [
        new URL("../../fixtures/worktree-storage-check.mjs", import.meta.url).pathname,
        new URL("../../../scripts/lib/worktree-storage.mjs", import.meta.url).pathname,
      ],
      { encoding: "utf8", timeout: 25_000 },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
  },
);

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
  const root = repository(
    { ".gitignore": ".worktrees/\nreports/\ntest-results/\ndist/\n", done: "base" },
    "fauna-finish-",
  );
  try {
    const task = createWorktree(root, "finished");
    mkdirSync(path.join(task.path, "reports"));
    writeFixture(task.path, "reports/unique.trace", "keep original evidence");
    put(task.path, "test-results/generated.trace", "generated test evidence");
    put(task.path, "dist/assets/.retention-keep", "keep build");
    put(task.path, "dist/assets/build.js", "retained build");
    const integrateTask = async () => ({ integrated: true, worktree: task.path });
    await finishTask(task.path, { keepWorktree: true, integrateTask });
    expect(readFixture(task.path, "reports/unique.trace")).toBe("keep original evidence");
    const result = await finishTask(task.path, { integrateTask });
    expect(readFixture(result.retired.archive, "files/reports/unique.trace")).toBe("keep original evidence");
    expect(readFixture(result.retired.archive, "files/dist/assets/build.js")).toBe("retained build");
    const manifest = JSON.parse(readFixture(result.retired.archive, "manifest.json"));
    expect(
      expireEvidence(path.dirname(result.retired.archive), { now: manifest.retention.expiresAt - 1 }),
    ).toEqual([]);
    expect(
      expireEvidence(path.dirname(result.retired.archive), { now: manifest.retention.expiresAt }),
    ).toEqual([path.join(result.retired.archive, "files/test-results")]);
    expect(readFixture(result.retired.archive, "files/reports/unique.trace")).toBe("keep original evidence");
    expect(git(root, "branch", "--list", task.branch).trim()).toContain(task.branch);
  } finally {
    process.chdir(previous);
  }
});

it("preserves a checkout when copied nested evidence differs", () => {
  const root = repository({ ".gitignore": ".worktrees/\nreports/\n", done: "base" }, "fauna-evidence-");
  const task = createWorktree(root, "evidence");
  put(task.path, "reports/nested/frame.txt", "original frame");
  expect(() =>
    removeMergedTask(root, task.branch, {
      keepBranch: true,
      copyEvidence(source, target, options) {
        cpSync(source, target, options);
        writeFileSync(path.join(target, "nested/frame.txt"), "damaged frame!");
      },
    }),
  ).toThrow("Evidence verification failed");
  expect(readFixture(task.path, "reports/nested/frame.txt")).toBe("original frame");
  expect(existsSync(task.path)).toBe(true);
  const result = removeMergedTask(root, task.branch, { keepBranch: true });
  expect(readFixture(result.archive, "files/reports/nested/frame.txt")).toBe("original frame");
  expect(git(root, "branch", "--list", task.branch)).toContain(task.branch);
});

it.skipIf(process.platform === "win32")("compares symlinks without following them", () => {
  const root = repository({ keep: "base" }, "fauna-evidence-links-");
  symlinkSync("missing-original", path.join(root, "original"));
  symlinkSync("missing-copy", path.join(root, "copy"));
  expect(() => verifyEvidence(path.join(root, "original"), path.join(root, "copy"))).toThrow(
    "Evidence verification failed",
  );
});

it("reports a safe cleanup retry after integration and retries without reintegration", async () => {
  const previous = process.cwd();
  const root = repository({ ".gitignore": ".worktrees/\nreports/\n", done: "base" }, "fauna-finish-retry-");
  try {
    const task = createWorktree(root, "retry");
    put(task.path, "reports/evidence.txt", "retain this");
    const blocker = path.join(root, ".git/fauna-worktree-archives");
    writeFileSync(blocker, "blocked");
    await expect(
      finishTask(task.path, { integrateTask: async () => ({ integrated: true, worktree: task.path }) }),
    ).rejects.toThrow(/Integration completed, but cleanup failed:[\s\S]*npm run finish -- --retry-cleanup/);
    expect(readFixture(task.path, "reports/evidence.txt")).toBe("retain this");
    rmSync(blocker);
    put(task.path, "unfinished.txt", "still needed");
    await expect(finishTask(task.path, { retryCleanup: true })).rejects.toThrow(/unfinished work/);
    expect(readFixture(task.path, "unfinished.txt")).toBe("still needed");
    rmSync(path.join(task.path, "unfinished.txt"));
    const result = await finishTask(task.path, {
      retryCleanup: true,
      integrateTask: () => {
        throw new Error("must not reintegrate");
      },
    });
    expect(readFixture(result.retired.archive, "files/reports/evidence.txt")).toBe("retain this");
    expect(existsSync(task.path)).toBe(false);
  } finally {
    process.chdir(previous);
  }
});

function ciTimeout(ms) {
  return process.env.CI ? 0 : ms;
}

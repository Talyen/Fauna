import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import { checkDocumentation } from "../../../scripts/checks/check-docs.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";
it("creates and reuses a task checkout from committed main while preserving dirty files", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "fauna-worktrees-"));
  try {
    const main = path.join(directory, "main");
    mkdirSync(main);
    const git = (...args) => execFileSync("git", args, { cwd: main, encoding: "utf8" });
    git("init", "-b", "main");
    writeFileSync(path.join(main, ".gitignore"), "node_modules\n.worktrees/\n");
    writeFileSync(path.join(main, "package-lock.json"), "{}");
    writeFileSync(path.join(main, "package.json"), "{}");
    writeFileSync(path.join(main, "keep"), "committed");
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture");
    mkdirSync(path.join(main, "node_modules"));
    writeFileSync(path.join(main, "keep"), "unrelated dirty work");
    const create = () => createWorktree(main, "example");
    const task = create();
    expect(readFileSync(path.join(main, "keep"), "utf8")).toBe("unrelated dirty work");
    expect(readFileSync(path.join(task.path, "keep"), "utf8")).toBe("committed");
    expect(realpathSync(path.join(task.path, "node_modules"))).toBe(
      realpathSync(path.join(main, "node_modules")),
    );
    writeFileSync(path.join(task.path, "keep"), "task edits");
    expect(create().path).toBe(task.path);
    expect(readFileSync(path.join(task.path, "keep"), "utf8")).toBe("task edits");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Several real Git/Node processes exercise safety, not application latency; the task gate still caps the suite at 60 seconds.
it(
  "completes cleanup while preserving unrelated unfinished work, but reports artifact archival failures",
  { timeout: 45_000 },
  () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "fauna-cleanup-"));
    const script = path.resolve(import.meta.dirname, "../../../scripts/worktree-cleanup.mjs");
    const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: "pipe" });
    const cleanup = () =>
      spawnSync(process.execPath, [script, "--apply"], { cwd: directory, encoding: "utf8" });
    try {
      git("init", "-b", "main");
      git("config", "user.name", "Fixture");
      git("config", "user.email", "fixture@example.invalid");
      writeFileSync(path.join(directory, ".gitignore"), ".worktrees/\nreports/\n");
      writeFileSync(path.join(directory, "keep"), "main");
      git("add", ".");
      git("commit", "-m", "fixture");
      git("branch", "task/merged");
      const unfinished = createWorktree(directory, "unfinished");
      writeFileSync(path.join(unfinished.path, "keep"), "unfinished work");
      const result = cleanup();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("Preserved task/unfinished");
      expect(git("branch", "--list", "task/merged").trim()).toBe("");
      expect(readFileSync(path.join(unfinished.path, "keep"), "utf8")).toBe("unfinished work");
      const archived = createWorktree(directory, "archive");
      mkdirSync(path.join(archived.path, "reports"));
      writeFileSync(path.join(archived.path, "reports/evidence.json"), "{}");
      writeFileSync(path.join(directory, ".git/fauna-worktree-archives"), "block archive directory");
      const failure = cleanup();
      expect(failure.status).not.toBe(0);
      expect(failure.stdout).toContain("Cleanup failed for task/archive");
      expect(readFileSync(path.join(archived.path, "reports/evidence.json"), "utf8")).toBe("{}");
      rmSync(path.join(directory, ".git/fauna-integration.lock"));
      mkdirSync(path.join(directory, ".git/fauna-integration.lock"));
      expect(cleanup().status).not.toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
  const root = mkdtempSync(path.join(os.tmpdir(), "fauna-sparse-docs-"));
  const git = (...args) =>
    execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: root, encoding: "utf8" });
  try {
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@example.invalid");
    mkdirSync(path.join(root, "public/art"), { recursive: true });
    writeFileSync(path.join(root, "package.json"), "{}");
    writeFileSync(path.join(root, "public/art/master.png"), "source");
    writeFileSync(path.join(root, "public/art/guide.md"), "# Source master\n");
    writeFileSync(
      path.join(root, "README.md"),
      "[Art](public/art/master.png) [Guide](public/art/guide.md#source-master)\n`public/art/`\n",
    );
    git("add", ".");
    git("commit", "-qm", "fixture");
    git("sparse-checkout", "set", "--no-cone", "/*", "!/public/art/");
    expect(checkDocumentation(root)).toEqual([]);
    writeFileSync(path.join(root, "README.md"), "[Guide](public/art/guide.md#absent)\n");
    expect(checkDocumentation(root)).toEqual(["README.md: missing heading public/art/guide.md#absent"]);
    git("sparse-checkout", "disable");
    writeFileSync(path.join(root, "README.md"), "[Art](public/art/master.png)\n");
    rmSync(path.join(root, "public/art/master.png"));
    expect(checkDocumentation(root)).toEqual(["README.md: missing link public/art/master.png"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

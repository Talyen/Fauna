import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
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

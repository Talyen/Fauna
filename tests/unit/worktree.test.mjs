import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
const script = path.resolve("scripts/worktree.mjs");
it("creates and reuses a task checkout from committed main while preserving dirty files", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "fauna-worktrees-"));
  try {
    const main = path.join(directory, "main");
    mkdirSync(main);
    const git = (...args) => execFileSync("git", args, { cwd: main, encoding: "utf8" });
    git("init", "-b", "main");
    writeFileSync(path.join(main, ".gitignore"), "node_modules\n");
    writeFileSync(path.join(main, "package-lock.json"), "{}");
    writeFileSync(path.join(main, "package.json"), "{}");
    writeFileSync(path.join(main, "keep"), "committed");
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture");
    mkdirSync(path.join(main, "node_modules"));
    writeFileSync(path.join(main, "keep"), "unrelated dirty work");
    const create = () =>
      JSON.parse(
        execFileSync(process.execPath, [script, "example"], {
          cwd: main,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        })
          .trim()
          .split("\n")
          .at(-1),
      );
    const task = create();
    expect(readFileSync(path.join(main, "keep"), "utf8")).toBe("unrelated dirty work");
    expect(readFileSync(path.join(task.directory, "keep"), "utf8")).toBe("committed");
    expect(realpathSync(path.join(task.directory, "node_modules"))).toBe(
      realpathSync(path.join(main, "node_modules")),
    );
    writeFileSync(path.join(task.directory, "keep"), "task edits");
    expect(create().directory).toBe(task.directory);
    expect(readFileSync(path.join(task.directory, "keep"), "utf8")).toBe("task edits");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, lstatSync, symlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import {
  installDependencies,
  matchingDependencies,
  ensureDependencies,
} from "../../../scripts/dependencies.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const main = mkdtempSync(path.join(os.tmpdir(), "fauna-dependencies-"));
  roots.push(main);
  const git = (...args) =>
    execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: main, stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "core.hooksPath", path.join(main, "no-hooks"));
  writeFileSync(path.join(main, ".gitignore"), "node_modules\n.worktrees/\n");
  writeFileSync(path.join(main, "package-lock.json"), "{}");
  writeFileSync(path.join(main, "package.json"), JSON.stringify({ dependencies: { example: "1" } }));
  git("add", ".");
  git("commit", "-m", "fixture");
  mkdirSync(path.join(main, "node_modules"));
  mkdirSync(path.join(main, "node_modules/example"));
  writeFileSync(path.join(main, "node_modules/example/package.json"), '{"name":"example","version":"1"}');
  writeFileSync(path.join(main, "node_modules/keep"), "main dependencies");
  const task = createWorktree(main, "example").path;
  return { main, task };
}

it("reuses matching dependencies despite ordinary command changes, without invoking npm", () => {
  const { main, task } = fixture(),
    runner = vi.fn();
  writeFileSync(
    path.join(task, "package.json"),
    JSON.stringify({ dependencies: { example: "1" }, scripts: { deps: "node scripts/dependencies.mjs" } }),
  );
  expect(matchingDependencies(main, task)).toBe(true);
  expect(installDependencies(task, { runner, log: () => {} })).toBe(0);
  expect(runner).not.toHaveBeenCalled();
  expect(lstatSync(path.join(task, "node_modules")).isSymbolicLink()).toBe(true);
});

it.each(["package-lock.json", ".npmrc", "package.json"])(
  "detaches only the task link when %s changes",
  (file) => {
    const { main, task } = fixture();
    writeFileSync(
      path.join(task, file),
      file === "package.json"
        ? JSON.stringify({ dependencies: { example: "1" }, scripts: { postinstall: "changed" } })
        : "changed",
    );
    expect(matchingDependencies(main, task)).toBe(false);
    const runner = vi.fn((_command, _args, options) => {
      expect(options.cwd).toBe(task);
      mkdirSync(path.join(task, "node_modules"));
      writeFileSync(path.join(task, "node_modules/task-only"), "isolated");
      return { status: 0 };
    });
    expect(installDependencies(task, { runner, log: () => {} })).toBe(0);
    expect(runner.mock.calls[0][1].at(-1)).toBe("ci");
    expect(lstatSync(path.join(task, "node_modules")).isSymbolicLink()).toBe(false);
    expect(readFileSync(path.join(main, "node_modules/keep"), "utf8")).toBe("main dependencies");
  },
);

it("isolates an incomplete shared install even when dependency manifests match", () => {
  const { main, task } = fixture();
  rmSync(path.join(main, "node_modules/example"), { recursive: true });
  const runner = vi.fn(() => ({ status: 1 }));
  expect(installDependencies(task, { runner, log: () => {} })).toBe(1);
  expect(runner).toHaveBeenCalledOnce();
  expect(readFileSync(path.join(main, "node_modules/keep"), "utf8")).toBe("main dependencies");
});

it("preserves unexpected links and propagates local install failures", () => {
  const { main, task } = fixture(),
    modules = path.join(task, "node_modules");
  rmSync(modules);
  const other = path.join(main, "other");
  mkdirSync(other);
  symlinkSync(other, modules, process.platform === "win32" ? "junction" : "dir");
  const runner = vi.fn(() => ({ status: 7 }));
  expect(() => installDependencies(task, { runner, log: () => {} })).toThrow("unexpected owner");
  expect(runner).not.toHaveBeenCalled();
  expect(lstatSync(modules).isSymbolicLink()).toBe(true);
  rmSync(modules);
  expect(installDependencies(task, { runner, log: () => {} })).toBe(7);
  expect(readFileSync(path.join(main, "node_modules/keep"), "utf8")).toBe("main dependencies");
});

it("uses the project's pinned npm without changing the global installation", () => {
  const { task } = fixture();
  writeFileSync(path.join(task, "package.json"), JSON.stringify({ packageManager: "npm@12.2.1" }));
  const runner = vi.fn(() => ({ status: 0 }));
  expect(
    installDependencies(task, {
      runner,
      log: () => {},
      env: { ...process.env, npm_config_user_agent: "npm/11.16.0" },
    }),
  ).toBe(0);
  expect(runner.mock.calls[0][1].slice(-6)).toEqual([
    "exec",
    "--yes",
    "--package=npm@12.2.1",
    "--",
    "npm",
    "ci",
  ]);
});

it("prepares mismatched task links automatically while preserving main's install", () => {
  const { main, task } = fixture();
  writeFileSync(path.join(task, "package.json"), JSON.stringify({ dependencies: { example: "2" } }));
  const runner = vi.fn(() => ({ status: 9 }));
  expect(ensureDependencies(task, { runner, log: () => {} })).toBe(9);
  expect(lstatSync(path.join(main, "node_modules")).isDirectory()).toBe(true);
  expect(readFileSync(path.join(main, "node_modules/example/package.json"), "utf8")).toContain(
    '"version":"1"',
  );
  expect(runner).toHaveBeenCalledOnce();
});

it("detects a stale owned installation against the resolved lockfile", () => {
  const { main } = fixture();
  writeFileSync(
    path.join(main, "package-lock.json"),
    JSON.stringify({ packages: { "node_modules/example": { version: "2" } } }),
  );
  const runner = vi.fn(() => ({ status: 7 }));
  expect(ensureDependencies(main, { runner, log: () => {} })).toBe(7);
  expect(runner).toHaveBeenCalledOnce();
});

it("preserves mismatched links and never launches implicit installs in routine verification", () => {
  const { main, task } = fixture();
  const runner = vi.fn();
  expect(ensureDependencies(task, { runner, allowInstall: false, log: () => {} })).toBe(0);
  writeFileSync(path.join(task, "package.json"), JSON.stringify({ dependencies: { example: "2" } }));
  expect(ensureDependencies(task, { runner, allowInstall: false, log: () => {} })).toBe(1);
  expect(lstatSync(path.join(task, "node_modules")).isSymbolicLink()).toBe(true);
  expect(readFileSync(path.join(main, "node_modules/keep"), "utf8")).toBe("main dependencies");
  rmSync(path.join(task, "node_modules"));
  expect(ensureDependencies(task, { runner, allowInstall: false, log: () => {} })).toBe(1);
  expect(runner).not.toHaveBeenCalled();
});

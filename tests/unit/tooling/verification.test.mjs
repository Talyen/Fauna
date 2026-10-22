import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseCheckArgs, selectedPaths, formatSelection, runCheck } from "../../../scripts/checks/check.mjs";
import { runLocalTests } from "../../../scripts/checks/run-local-tests.mjs";
import localConfig from "../../../vitest.local.config.mjs";

const roots = [];
const repo = path.resolve(import.meta.dirname, "../../..");
function git(root, ...args) {
  return execFileSync(
    "git",
    ["-c", "commit.gpgsign=false", "-c", `core.hooksPath=${path.join(root, "no-hooks")}`, ...args],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-verification-"));
  roots.push(root);
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "README.md"), "# Fauna\n");
  writeFileSync(path.join(root, "src/game.ts"), "export const creature = 1;\n");
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Verification fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("lightweight local verification", () => {
  it("rejects unknown options and ambiguous or incomplete selections", () => {
    expect(parseCheckArgs([])).toEqual({ paths: [], base: "HEAD" });
    expect(parseCheckArgs(["--base", "main"])).toEqual({ paths: [], base: "main" });
    for (const args of [
      ["--full"],
      ["--base"],
      ["--base", "--diff"],
      ["--base", "main", "README.md"],
      ["--diff", "src"],
    ])
      expect(() => parseCheckArgs(args)).toThrow();
  });

  it("checks committed integration changes, staged edits, deletions and untracked files", () => {
    const root = fixture();
    const base = git(root, "rev-parse", "HEAD");
    writeFileSync(path.join(root, "src/game.ts"), "export const creature = 2;\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "task change");
    writeFileSync(path.join(root, "src/new.ts"), "export const starter = 1;\n");
    writeFileSync(path.join(root, "src/staged.ts"), "export const roster = 1;\n");
    git(root, "add", "src/staged.ts");
    rmSync(path.join(root, "README.md"));
    expect(selectedPaths(root, { paths: [], base }).sort()).toEqual([
      "README.md",
      "src/game.ts",
      "src/new.ts",
      "src/staged.ts",
    ]);
  });

  it("treats named paths literally and fails closed on missing paths, external paths or bad Git refs", () => {
    const root = fixture();
    writeFileSync(path.join(root, "src/creature[1].ts"), "export {};\n");
    writeFileSync(path.join(root, "src/creature1.ts"), "export {};\n");
    expect(selectedPaths(root, { paths: ["src/creature[1].ts"], base: "HEAD" })).toEqual([
      "src/creature[1].ts",
    ]);
    for (const selection of [
      { paths: ["../other-project"], base: "HEAD" },
      { paths: ["missing.ts"], base: "HEAD" },
      { paths: ["README.md", "missing.ts"], base: "HEAD" },
      { paths: [], base: "missing-branch" },
    ])
      expect(() => selectedPaths(root, selection)).toThrow();
  });

  it("formats documentation without running smoke or invoking a shell", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 }));
    expect(runCheck(["README.md"], { root, runner, log: () => {} })).toBe(0);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][0]).toBe(process.execPath);
    expect(runner.mock.calls[0][1]).toEqual([
      path.join(root, "node_modules/prettier/bin/prettier.cjs"),
      "--check",
      "--ignore-unknown",
      "--",
      "README.md",
    ]);
    expect(runner.mock.calls[0][2].shell).toBeUndefined();
  });

  it("runs only selected formatting and fixed smoke for source changes", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 })),
      messages = [];
    expect(runCheck(["src/game.ts"], { root, runner, log: (message) => messages.push(message) })).toBe(0);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner.mock.calls[1][1]).toEqual([path.join(root, "scripts/checks/run-local-tests.mjs")]);
    expect(messages.join(" ")).toContain("CI owns full unit, static, build, browser and desktop validation");
  });

  it("stops on formatting failure and propagates smoke failure or termination", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 2 }));
    expect(runCheck(["src/game.ts"], { root, runner, log: () => {} })).toBe(2);
    expect(runner).toHaveBeenCalledTimes(1);
    for (const result of [{ status: 9 }, { status: null, signal: "SIGTERM" }]) {
      const smoke = vi.fn(() => result);
      expect(runLocalTests({ root, runner: smoke })).toBe(result.status ?? 1);
    }
  });

  it("bounds formatting by file count, individual size and argument bytes", () => {
    const root = fixture();
    const files = Array.from({ length: 51 }, (_, i) => `src/file-${i}.ts`);
    for (const file of files) writeFileSync(path.join(root, file), "export {};\n");
    expect(formatSelection(root, files.slice(0, 50)).deferred).toBe(false);
    expect(formatSelection(root, files)).toEqual({ files: [], deferred: true });
    writeFileSync(path.join(root, "src/large.ts"), " ".repeat(256_001));
    expect(formatSelection(root, ["src/large.ts"]).deferred).toBe(true);
    const long = Array.from({ length: 36 }, (_, i) => `src/${"x".repeat(220)}-${i}.ts`);
    for (const file of long) writeFileSync(path.join(root, file), "export {};\n");
    expect(formatSelection(root, long).deferred).toBe(true);
    expect(formatSelection(root, ["missing.ts"]).files).toEqual([]);
  });

  it("still runs smoke when formatting is too large for the local budget", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 })),
      messages = [];
    writeFileSync(path.join(root, "src/large.ts"), " ".repeat(256_001));
    expect(runCheck(["src/large.ts"], { root, runner, log: (message) => messages.push(message) })).toBe(0);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][1]).toEqual([path.join(root, "scripts/checks/run-local-tests.mjs")]);
    expect(messages.join(" ")).toContain("Formatting deferred to CI");
  });

  it("runs smoke on a clean checkout and never treats Git discovery failure as success", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 }));
    expect(runCheck([], { root, runner, log: () => {} })).toBe(0);
    expect(runner.mock.calls[0][1]).toEqual([path.join(root, "scripts/checks/run-local-tests.mjs")]);
    expect(() => runCheck(["--base", "missing"], { root, runner, log: () => {} })).toThrow();
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("keeps smoke in Node with one worker, a 512 MiB heap and a 30-second deadline", () => {
    const runner = vi.fn(() => ({ status: 0 }));
    expect(runLocalTests({ runner })).toBe(0);
    const [, args, options] = runner.mock.calls[0];
    expect(args.slice(1)).toEqual(["run", "--config", "vitest.local.config.mjs"]);
    expect(options.timeout).toBe(30_000);
    expect(options.env.NODE_OPTIONS).toMatch(/--max-old-space-size=512$/);
    expect(options.env.RAYON_NUM_THREADS).toBe("1");
    expect(localConfig.test).toMatchObject({
      environment: "node",
      pool: "threads",
      maxWorkers: 1,
      fileParallelism: false,
    });
    expect(localConfig.test.include).toHaveLength(3);
    for (const file of localConfig.test.include)
      expect(readFileSync(path.join(repo, file), "utf8")).not.toMatch(
        /^\/\/\s*@vitest-environment\s+(?:jsdom|happy-dom)\b/m,
      );
  });

  it("keeps full validation on the CI entrypoint when local defaults become lightweight", () => {
    const { scripts } = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
    expect(scripts.check).toBe("node scripts/checks/check.mjs");
    expect(scripts.verify).toBe("node scripts/checks/check.mjs");
    expect(scripts["package:win"]).toContain("--publish never");
    for (const command of ["check:full", "test:full", "build", "test:e2e"])
      expect(scripts["verify:full"]).toContain(`npm run ${command}`);
    const workflow = readFileSync(path.join(repo, ".github/workflows/ci.yml"), "utf8");
    for (const command of [
      "check:types",
      "check:lint",
      "check:format",
      "check:boundaries",
      "deadcode",
      "docs:check",
      "content:audit",
      "test:full",
      "build",
      "check:bundle",
      "assets:check:bundle",
      "package:win",
      "verify:package",
    ])
      expect(workflow).toContain(`run: npm run ${command}`);
    expect(workflow).toContain("run: npx playwright test --test-list=reports/ci/shard-$CI_SHARD.txt");
    expect(workflow).toContain("node scripts/ci/ci.mjs plan");
    expect(workflow).toContain("node scripts/ci/ci.mjs gate");
    expect(workflow).toContain("if: ${{ !cancelled() && needs.prepare.outputs.run != 'false' }}");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("name: browser-review");
    expect(workflow).toContain("reports/");
    expect(workflow).toContain("run: npm run package:win");
    expect(workflow).toContain("node scripts/release/smoke-desktop.mjs --packaged");
  });
});

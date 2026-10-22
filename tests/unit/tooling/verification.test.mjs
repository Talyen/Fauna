import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  parseCheckArgs,
  selectedPaths,
  formatSelection,
  checkPlan,
  runCheck,
} from "../../../scripts/checks/check.mjs";
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
    expect(parseCheckArgs([])).toEqual({ paths: [], base: null });
    expect(parseCheckArgs(["--working-tree"])).toEqual({ paths: [], base: "HEAD" });
    expect(parseCheckArgs(["--base", "main"])).toEqual({ paths: [], base: "main" });
    for (const args of [
      ["--full"],
      ["--base"],
      ["--base", "--diff"],
      ["--base", "main", "README.md"],
      ["--diff", "src"],
      ["--working-tree", "--base", "main"],
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
    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner.mock.calls[1][1]).toEqual([path.join(root, "scripts/checks/check-docs.mjs")]);
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

  it("runs selected lint and the owning compiler before smoke", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 })),
      messages = [];
    expect(runCheck(["src/game.ts"], { root, runner, log: (message) => messages.push(message) })).toBe(0);
    expect(runner.mock.calls.map((call) => path.basename(call[1][0]))).toEqual([
      "prettier.cjs",
      "oxlint",
      "tsc",
      "run-local-tests.mjs",
    ]);
    expect(runner.mock.calls[2][1].slice(1)).toEqual(["--noEmit", "-p", "tsconfig.json"]);
    expect(messages.join(" ")).toContain("CI owns complete static");
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

  it("batches every file by count, source size and argument bytes without dropping coverage", () => {
    const root = fixture();
    const files = Array.from({ length: 51 }, (_, i) => `src/file-${i}.ts`);
    for (const file of files) writeFileSync(path.join(root, file), "export {};\n");
    expect(formatSelection(root, files.slice(0, 50)).batches).toHaveLength(1);
    expect(formatSelection(root, files).batches.map((batch) => batch.length)).toEqual([50, 1]);
    expect(formatSelection(root, files).batches.flat()).toEqual(files);
    writeFileSync(path.join(root, "src/large.ts"), " ".repeat(256_001));
    expect(formatSelection(root, ["src/large.ts"]).batches).toEqual([["src/large.ts"]]);
    const long = Array.from({ length: 36 }, (_, i) => `src/${"x".repeat(220)}-${i}.ts`);
    for (const file of long) writeFileSync(path.join(root, file), "export {};\n");
    expect(formatSelection(root, long).batches.length).toBeGreaterThan(1);
    expect(formatSelection(root, long).batches.flat()).toEqual(long);
    expect(formatSelection(root, ["missing.ts"]).files).toEqual([]);
  });

  it("checks large files individually and reports a complete plan before execution", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 })),
      messages = [];
    writeFileSync(path.join(root, "src/large.ts"), " ".repeat(256_001));
    expect(runCheck(["src/large.ts"], { root, runner, log: (message) => messages.push(message) })).toBe(0);
    expect(runner.mock.calls.map((call) => path.basename(call[1][0]))).toEqual([
      "prettier.cjs",
      "oxlint",
      "tsc",
      "run-local-tests.mjs",
    ]);
    expect(messages.join(" ")).toContain("Plan: 1 selected files; 1 formatting batches");
    expect(messages.join(" ")).toContain("Task checks passed");
  });

  it("can inspect the plan without running checks and never misses contracts in later batches", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 })),
      messages = [];
    expect(runCheck(["--plan", "src"], { root, runner, log: (message) => messages.push(message) })).toBe(0);
    expect(runner).not.toHaveBeenCalled();
    expect(messages.join(" ")).toContain("Plan only; no checks ran");
    for (let i = 0; i < 51; i++) writeFileSync(path.join(root, `src/file-${i}.ts`), "export {};\n");
    writeFileSync(path.join(root, "src/zzz.ts"), 'import * as Dialog from "@radix-ui/react-dialog";');
    expect(runCheck(["src"], { root, runner, log: () => {} })).toBe(1);
    expect(runner.mock.calls.filter((call) => call[1][0].endsWith("prettier.cjs"))).toHaveLength(2);
  });

  it("selects transitive cross-layer regressions through aliases, re-exports and deleted dependencies", () => {
    const root = fixture();
    for (const dir of ["src/game", "src/application", "tests/integration"])
      mkdirSync(path.join(root, dir), { recursive: true });
    writeFileSync(path.join(root, "src/game/value.ts"), "export const value = 1;");
    writeFileSync(path.join(root, "src/game/index.ts"), 'export { value } from "./value.js";');
    writeFileSync(
      path.join(root, "src/application/commands.ts"),
      'import { value } from "@/game/index"; export { value };',
    );
    writeFileSync(
      path.join(root, "tests/integration/renamed.test.ts"),
      'import { value } from "../../src/application/commands";',
    );
    writeFileSync(
      path.join(root, "tests/integration/lazy.test.mjs"),
      'await import("../../src/application/commands.ts");',
    );
    writeFileSync(
      path.join(root, "tests/integration/required.test.mjs"),
      'require("../../src/application/commands.ts");',
    );
    const regressions = [
      "tests/integration/lazy.test.mjs",
      "tests/integration/renamed.test.ts",
      "tests/integration/required.test.mjs",
    ];
    expect(checkPlan(root, ["src/game/value.ts"]).tests).toEqual(regressions);
    rmSync(path.join(root, "src/game/value.ts"));
    expect(checkPlan(root, ["src/game/value.ts"]).tests).toEqual(regressions);
  });

  it("reports additional related suites instead of pretending a bounded selection is exhaustive", () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/integration"), { recursive: true });
    for (let i = 0; i < 14; i++)
      writeFileSync(path.join(root, `tests/integration/case-${i}.test.ts`), 'import "../../src/game";');
    const plan = checkPlan(root, ["src/game.ts"]);
    expect(plan.tests).toHaveLength(12);
    expect(plan.deferredTests).toHaveLength(2);
    // Explicitly selected regressions are never displaced by the related-suite limit.
    expect(checkPlan(root, ["src/game.ts", ...plan.deferredTests]).tests).toHaveLength(14);
  });

  it("runs smoke on a clean checkout and never treats Git discovery failure as success", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 }));
    expect(runCheck([], { root, runner, log: () => {} })).toBe(0);
    expect(runner.mock.calls[0][1]).toEqual([path.join(root, "scripts/checks/run-local-tests.mjs")]);
    expect(() => runCheck(["--base", "missing"], { root, runner, log: () => {} })).toThrow();
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("selects existing owner suites, changed regressions and compiler environments for deleted sources", () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/unit/game"), { recursive: true });
    writeFileSync(path.join(root, "tests/unit/game/engine.test.ts"), "");
    const plan = checkPlan(root, [
      "src/game/engine.ts",
      "src/platform/ports.ts",
      "tests/unit/game/engine.test.ts",
    ]);
    expect(plan.tests).toEqual(["tests/unit/game/engine.test.ts"]);
    expect(plan.configs).toEqual([
      "tsconfig.game.json",
      "tsconfig.json",
      "tsconfig.desktop.json",
      "tsconfig.desktop-boundary.json",
      "tsconfig.test.json",
    ]);
    expect(checkPlan(root, ["package-lock.json"]).configs).toHaveLength(6);
  });

  it("blocks handoff on selected lint, compiler, documentation or source contract failures", () => {
    const root = fixture();
    for (const failed of ["oxlint", "tsc"]) {
      const runner = vi.fn((_command, args) => ({ status: path.basename(args[0]) === failed ? 7 : 0 }));
      expect(runCheck(["src/game.ts"], { root, runner, log: () => {} })).toBe(7);
      expect(runner.mock.calls.some((call) => call[1][0].endsWith("run-local-tests.mjs"))).toBe(false);
    }
    writeFileSync(path.join(root, "src/game.ts"), 'import * as Dialog from "@radix-ui/react-dialog";');
    expect(runCheck(["src/game.ts"], { root, runner: vi.fn(() => ({ status: 0 })), log: () => {} })).toBe(1);
    mkdirSync(path.join(root, "src/ui"));
    writeFileSync(path.join(root, "src/ui/screen.css"), ".panel { overflow: scroll; }");
    expect(
      runCheck(["src/ui/screen.css"], { root, runner: vi.fn(() => ({ status: 0 })), log: () => {} }),
    ).toBe(1);
    expect(
      runCheck(["README.md"], {
        root,
        runner: (_command, args) => ({ status: args[0].endsWith("check-docs.mjs") ? 8 : 0 }),
        log: () => {},
      }),
    ).toBe(8);
  });

  it("bounds each selected suite independently and stops when a regression fails", () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/unit"), { recursive: true });
    for (const name of ["first", "second"]) writeFileSync(path.join(root, `tests/unit/${name}.test.mjs`), "");
    const suites = ["tests/unit/first.test.mjs", "tests/unit/second.test.mjs"];
    const runner = vi.fn(() => ({ status: 0 }));
    expect(runCheck(suites, { root, runner, log: () => {} })).toBe(0);
    const calls = runner.mock.calls.filter((call) => call[1][0].endsWith("vitest.mjs"));
    expect(calls.map((call) => call[1].slice(4))).toEqual(suites.map((suite) => [suite]));
    expect(calls.every((call) => call[2].timeout === 60_000)).toBe(true);
    const failure = vi.fn((_command, args) => ({
      status: args.includes(suites[0]) && args[0].endsWith("vitest.mjs") ? 9 : 0,
    }));
    expect(runCheck(suites, { root, runner: failure, log: () => {} })).toBe(9);
    expect(failure.mock.calls.filter((call) => call[1][0].endsWith("vitest.mjs"))).toHaveLength(1);
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

it("keeps Steam provenance independent of paid signing and untrusted build permissions", () => {
  const workflow = readFileSync(path.join(repo, ".github/workflows/ci.yml"), "utf8");
  const windows = workflow.slice(workflow.indexOf("  windows:"), workflow.indexOf("  verify:"));
  const provenance = workflow.slice(workflow.indexOf("  provenance:"));
  expect(windows).not.toContain("attestations: write");
  expect(windows).not.toContain("id-token: write");
  expect(provenance).toContain("needs: [verify]");
  expect(provenance).toContain("github.event_name == 'push'");
  expect(provenance).toContain("refs/heads/main");
  expect(provenance).toContain("candidate/dist/dependencies.cdx.json");
  expect(provenance).not.toContain("secrets.");
});

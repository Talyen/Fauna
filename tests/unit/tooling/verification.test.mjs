import { git, readFixture, repository, writeFixture } from "../../support/tooling.mjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  parseCheckArgs,
  selectedPaths,
  formatSelection,
  checkPlan,
  runCheck as runDefaultCheck,
  verify,
} from "../../../scripts/checks/check.mjs";
import { runLocalTests } from "../../../scripts/checks/run-local-tests.mjs";
import owners from "../../../scripts/checks/test-owners.json" with { type: "json" };
import localConfig from "../../../vitest.local.config.mjs";
import { localCommands } from "../../../scripts/local.mjs";
import { investigationArgs } from "../../../scripts/agent/investigate.mjs";

// Detailed execution remains available only through the explicit local opt-in.
const runCheck = (args, options = {}) =>
  runDefaultCheck(args, { ...options, env: { FAUNA_LOCAL_HEAVY: "1" } });

const repo = path.resolve(import.meta.dirname, "../../..");
const fixture = () =>
  repository(
    {
      "README.md": "# Fauna\n",
      "src/game.ts": "export const creature = 1;\n",
    },
    "fauna-verification-",
  );
afterEach(() => {
  vi.restoreAllMocks();
});

describe("lightweight local verification", () => {
  it.each([{}, { CI: "true" }])(
    "defers compilers, automatic and remembered suites without disabling source checks with %j",
    (env) => {
      const root = fixture();
      const suite = "tests/unit/game/engine.test.ts";
      mkdirSync(path.dirname(path.join(root, suite)), { recursive: true });
      for (const required of owners["src/game/"].suites) writeFixture(root, required, "export {};\n");
      mkdirSync(path.join(root, "src/game"));
      writeFixture(root, "src/game/value.ts", "export const value = 1;\n");
      const runner = vi.fn(() => ({ status: 0 }));
      const messages = [];
      expect(
        runDefaultCheck(["src/game/value.ts", "--test", suite], {
          root,
          runner,
          env,
          log: (message) => messages.push(message),
        }),
      ).toBe(0);
      expect(runner.mock.calls.map((call) => path.basename(call[1][0]))).toEqual(["prettier.cjs", "oxlint"]);
      expect(runner.mock.calls[1][1]).not.toContain("--type-aware");
      expect(messages.join(" ")).toContain("Deferred suites (CI)");
      runner.mockClear();
      expect(runDefaultCheck(["src/game/value.ts"], { root, runner, env, log: () => {} })).toBe(0);
      expect(runner.mock.calls).toHaveLength(2);
      const failed = vi.fn((_command, args) => ({ status: path.basename(args[0]) === "oxlint" ? 7 : 0 }));
      expect(runDefaultCheck(["src/game/value.ts"], { root, runner: failed, env, log: () => {} })).toBe(7);
    },
  );

  it("keeps exhaustive matrices in full CI while local changes verify their owning contract", () => {
    const plan = checkPlan(repo, ["tests/exhaustive/roster-combinations.test.ts"]);
    expect(plan.tests).toEqual(["tests/unit/game/engine.test.ts", "tests/unit/game/lineups.test.ts"]);
    expect(plan.configs).toContain("tsconfig.test.json");
    expect(readFixture(repo, "vitest.config.ts")).toContain("unit,integration,exhaustive");
  });

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
    writeFixture(root, "src/game.ts", "export const creature = 2;\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "task change");
    writeFixture(root, "src/new.ts", "export const starter = 1;\n");
    writeFixture(root, "src/staged.ts", "export const roster = 1;\n");
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
    writeFixture(root, "src/creature[1].ts", "export {};\n");
    writeFixture(root, "src/creature1.ts", "export {};\n");
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
    for (const file of files) writeFixture(root, file, "export {};\n");
    expect(formatSelection(root, files.slice(0, 50)).batches).toHaveLength(1);
    expect(formatSelection(root, files).batches.map((batch) => batch.length)).toEqual([50, 1]);
    expect(formatSelection(root, files).batches.flat()).toEqual(files);
    writeFixture(root, "src/large.ts", " ".repeat(256_001));
    expect(formatSelection(root, ["src/large.ts"]).batches).toEqual([["src/large.ts"]]);
    const long = Array.from({ length: 36 }, (_, i) => `src/${"x".repeat(220)}-${i}.ts`);
    for (const file of long) writeFixture(root, file, "export {};\n");
    expect(formatSelection(root, long).batches.length).toBeGreaterThan(1);
    expect(formatSelection(root, long).batches.flat()).toEqual(long);
    expect(formatSelection(root, ["missing.ts"]).files).toEqual([]);
  });

  it("checks large files individually and reports a complete plan before execution", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 })),
      messages = [];
    writeFixture(root, "src/large.ts", " ".repeat(256_001));
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
    for (let i = 0; i < 51; i++) writeFixture(root, `src/file-${i}.ts`, "export {};\n");
    writeFixture(root, "src/zzz.ts", 'import * as Dialog from "@radix-ui/react-dialog";');
    expect(runCheck(["src"], { root, runner, log: () => {} })).toBe(1);
    expect(runner.mock.calls.filter((call) => call[1][0].endsWith("prettier.cjs"))).toHaveLength(2);
  });

  it("suggests transitive cross-layer regressions through aliases, re-exports and deleted dependencies", () => {
    const root = fixture();
    for (const dir of ["src/game", "src/application", "tests/integration"])
      mkdirSync(path.join(root, dir), { recursive: true });
    writeFixture(root, "src/game/value.ts", "export const value = 1;");
    writeFixture(root, "src/game/index.ts", 'export { value } from "./value.js";');
    writeFixture(
      root,
      "src/application/commands.ts",
      'import { value } from "@/game/index"; export { value };',
    );
    writeFixture(
      root,
      "tests/integration/renamed.test.ts",
      'import { value } from "../../src/application/commands";',
    );
    writeFixture(
      root,
      "tests/integration/lazy.test.mjs",
      'await import("../../src/application/commands.ts");',
    );
    writeFixture(
      root,
      "tests/integration/required.test.mjs",
      'require("../../src/application/commands.ts");',
    );
    const regressions = [
      "tests/integration/lazy.test.mjs",
      "tests/integration/renamed.test.ts",
      "tests/integration/required.test.mjs",
    ];
    expect(checkPlan(root, ["src/game/value.ts"], [], { related: true }).relatedTests).toEqual(regressions);
    rmSync(path.join(root, "src/game/value.ts"));
    expect(checkPlan(root, ["src/game/value.ts"], [], { related: true }).relatedTests).toEqual(regressions);
  });

  it("reports additional related suites instead of pretending a bounded selection is exhaustive", () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/integration"), { recursive: true });
    for (let i = 0; i < 14; i++)
      writeFixture(root, `tests/integration/case-${i}.test.ts`, 'import "../../src/game";');
    expect(checkPlan(root, ["src/game.ts"]).relatedTests).toEqual([]);
    const plan = checkPlan(root, ["src/game.ts"], [], { related: true });
    expect(plan.tests).toEqual([]);
    expect(plan.relatedTests).toHaveLength(14);
    // Explicitly selected regressions are never displaced by automatic discovery.
    expect(checkPlan(root, ["src/game.ts", ...plan.relatedTests]).tests).toHaveLength(14);
  });

  it("runs stable declared owner contracts alongside filename-matched and explicit regressions", () => {
    const root = fixture();
    for (const file of [
      "tests/unit/ui/ui.test.tsx",
      "tests/unit/ui/pagination.test.tsx",
      "tests/unit/ui/menu-navigation.test.tsx",
      "tests/unit/ui/input.test.ts",
      "tests/unit/extra.test.ts",
    ]) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFixture(root, file, "export {};");
    }
    expect(
      checkPlan(root, ["src/ui/shared/navigation/pagination.tsx"], ["tests/unit/extra.test.ts"]).tests,
    ).toEqual([
      "tests/unit/extra.test.ts",
      "tests/unit/ui/input.test.ts",
      "tests/unit/ui/menu-navigation.test.tsx",
      "tests/unit/ui/pagination.test.tsx",
    ]);
    // A moved or deleted contract must be repaired in the checked-in owner map.
    for (const { suites } of Object.values(owners))
      for (const file of suites) expect(readFixture(repo, file).length).toBeGreaterThan(0);
  });

  it("blocks verification when a required owner suite is deleted or replaced by a directory", () => {
    const root = fixture();
    const suite = "tests/unit/game/engine.test.ts";
    mkdirSync(path.join(root, "src/game"), { recursive: true });
    writeFixture(root, "src/game/value.ts", "export const value = 1;\n");
    mkdirSync(path.dirname(path.join(root, suite)), { recursive: true });
    for (const required of owners["src/game/"].suites) writeFixture(root, required, "export {};\n");
    expect(checkPlan(root, ["src/game/value.ts"]).missingContracts).toEqual([]);
    rmSync(path.join(root, suite));
    for (const directory of [false, true]) {
      if (directory) mkdirSync(path.join(root, suite));
      const runner = vi.fn(() => ({ status: 0 }));
      const messages = [];
      const options = { root, runner, log: (message) => messages.push(message) };
      expect(runCheck(["src/game/value.ts"], options)).toBe(1);
      expect(runner).not.toHaveBeenCalled();
      expect(messages.join("\n")).toContain(`Missing required suite ${suite} for src/game/`);
      expect(runCheck(["--plan", "src/game/value.ts"], options)).toBe(0);
      expect(runner).not.toHaveBeenCalled();
    }
  });

  it("defers registered extended suites while retaining local contracts and explicit requests", () => {
    const root = fixture();
    const extended = "tests/exhaustive/roster-combinations.test.ts";
    const local = ["tests/unit/game/engine.test.ts", "tests/unit/game/lineups.test.ts"];
    for (const file of [extended, ...local]) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFixture(root, file, "export {};\n");
    }
    const plan = checkPlan(root, [extended, "src/game/engine.ts"]);
    expect(plan.tests).toEqual(local);
    expect(plan.ciTests).toContain(extended);
    const runner = vi.fn(() => ({ status: 0 }));
    const messages = [];
    expect(runCheck([extended], { root, runner, log: (message) => messages.push(message) })).toBe(0);
    const testCall = runner.mock.calls.find((call) => call[1][0].endsWith("vitest.mjs"));
    for (const suite of local) expect(testCall[1]).toContain(suite);
    expect(testCall[1]).not.toContain(extended);
    expect(messages.join("\n")).toContain(`CI-owned extended suite (not run by this gate): ${extended}`);
    expect(checkPlan(root, [extended], [extended]).tests).toEqual([...local, extended].sort());
    const explicit = vi.fn(() => ({ status: 0 }));
    expect(runCheck(["--test", extended], { root, runner: explicit, log: () => {} })).toBe(0);
    expect(explicit.mock.calls.at(-1)[1]).toContain(extended);
    expect(investigationArgs(root, ["unit", extended]).at(-1)).toBe(extended);
    rmSync(path.join(root, extended));
    expect(checkPlan(root, [extended]).missingContracts).toContainEqual({
      owner: extended,
      suite: extended,
    });
  });

  it("discovers every declared CI-owned suite through the unchanged full unit command", () => {
    const extended = Object.entries(owners)
      .filter(([, owner]) => owner.tier === "ci")
      .map(([file]) => file);
    expect(extended.length).toBeGreaterThan(0);
    for (const [file, owner] of Object.entries(owners)) {
      if (owner.tier === undefined) continue;
      expect(owner.tier).toBe("ci");
      expect(file).toMatch(/^tests\/(?:unit|integration|exhaustive)\/.+\.test\.[cm]?[jt]sx?$/);
      expect(owner.reason.length).toBeGreaterThan(0);
      expect(owner.suites.length).toBeGreaterThan(0);
      for (const local of owner.suites) expect(owners[local]?.tier).not.toBe("ci");
      expect(checkPlan(repo, [file]).tests).toEqual(expect.arrayContaining(owner.suites));
      expect(readFixture(repo, file).length).toBeGreaterThan(0);
    }
    const discovered = JSON.parse(
      execFileSync(
        process.execPath,
        [
          path.join(repo, "node_modules/vitest/vitest.mjs"),
          "list",
          ...extended,
          "--filesOnly",
          "--json",
          "--maxWorkers=1",
          "--no-file-parallelism",
        ],
        {
          cwd: repo,
          encoding: "utf8",
          timeout: 30_000,
          env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1024" },
        },
      ),
    );
    expect(discovered.map(({ file }) => path.relative(repo, file)).sort()).toEqual(extended.sort());
  });

  it("runs named regressions alongside the changed selection and dispatches bounded diagnostics", async () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/unit"), { recursive: true });
    writeFixture(root, "tests/unit/named.test.mjs", "");
    const runner = vi.fn(() => ({ status: 0 }));
    expect(
      runCheck(["--test", "tests/unit/named.test.mjs", "src/game.ts"], { root, runner, log: () => {} }),
    ).toBe(0);
    expect(runner.mock.calls.at(-1)[1]).toContain("tests/unit/named.test.mjs");
    expect(() => runCheck(["--test", "../outside.test.mjs"], { root, runner })).toThrow();
    expect(await verify(["--diagnostic", "types"], { root, runner, env: { FAUNA_LOCAL_HEAVY: "1" } })).toBe(
      0,
    );
    expect(runner.mock.calls.at(-1)[1].slice(-2)).toEqual(["run", "check:types"]);
  });

  it("keeps required coverage and related suggestions independent of timing history", () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/integration"), { recursive: true });
    writeFixture(root, "src/indirect.ts", 'import "./game";');
    const indirect = Array.from({ length: 13 }, (_, i) => `tests/integration/a-${i}.test.ts`);
    for (const file of indirect) writeFixture(root, file, 'import "../../src/indirect";');
    const direct = "tests/integration/z-direct.test.ts";
    writeFixture(root, direct, 'import "../../src/game";');
    expect(checkPlan(root, ["src/game.ts"], [], { related: true }).relatedTests[0]).toBe(direct);
    const before = checkPlan(root, ["src/game.ts"], [], { related: true });
    mkdirSync(path.join(root, "reports"));
    writeFixture(
      root,
      "reports/task-tests.json",
      JSON.stringify({ testResults: [{ name: path.join(root, direct), startTime: 1, endTime: 59001 }] }),
    );
    const plan = checkPlan(root, ["src/game.ts"], [], { related: true });
    expect(plan).toEqual(before);
    expect(plan.relatedTests).toHaveLength(14);
    writeFixture(root, "reports/task-tests.json", JSON.stringify({ testResults: {} }));
    expect(checkPlan(root, ["src/game.ts"], [], { related: true })).toEqual(before);
  });

  it("reports an empty changed selection without implying test coverage and fails closed on Git errors", () => {
    const root = fixture(),
      runner = vi.fn(() => ({ status: 0 }));
    expect(runCheck([], { root, runner, log: () => {} })).toBe(0);
    expect(runner).not.toHaveBeenCalled();
    expect(() => runCheck(["--base", "missing"], { root, runner, log: () => {} })).toThrow();
    expect(runner).not.toHaveBeenCalled();
  });

  it("selects existing owner suites, changed regressions and compiler environments for deleted sources", () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/unit/game"), { recursive: true });
    writeFixture(root, "tests/unit/game/engine.test.ts", "");
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
    expect(checkPlan(root, ["playwright.performance.config.ts"]).configs).toEqual(["tsconfig.node.json"]);
  });

  it("blocks handoff on selected lint, compiler, documentation or source contract failures", () => {
    const root = fixture();
    for (const failed of ["oxlint", "tsc"]) {
      const runner = vi.fn((_command, args) => ({ status: path.basename(args[0]) === failed ? 7 : 0 }));
      expect(runCheck(["src/game.ts"], { root, runner, log: () => {} })).toBe(7);
      expect(runner.mock.calls.some((call) => call[1][0].endsWith("run-local-tests.mjs"))).toBe(false);
    }
    writeFixture(root, "src/game.ts", 'import * as Dialog from "@radix-ui/react-dialog";');
    expect(runCheck(["src/game.ts"], { root, runner: vi.fn(() => ({ status: 0 })), log: () => {} })).toBe(1);
    mkdirSync(path.join(root, "src/ui"));
    writeFixture(root, "src/ui/screen.css", ".panel { color: #ffffff; }");
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

  it("batches selected regressions with one worker and a bounded deadline, propagating failure", () => {
    const root = fixture();
    mkdirSync(path.join(root, "tests/unit"), { recursive: true });
    for (const name of ["first", "second"]) writeFixture(root, `tests/unit/${name}.test.mjs`, "");
    const suites = ["tests/unit/first.test.mjs", "tests/unit/second.test.mjs"];
    const runner = vi.fn(() => ({ status: 0 }));
    expect(runCheck(suites, { root, runner, log: () => {} })).toBe(0);
    const calls = runner.mock.calls.filter((call) => call[1][0].endsWith("vitest.mjs"));
    expect(calls).toHaveLength(1);
    expect(calls[0][1].slice(-2)).toEqual(suites);
    expect(calls[0][1]).toContain("--bail=1");
    expect(calls[0][2].timeout).toBe(300_000);
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
      expect(readFixture(repo, file)).not.toMatch(/^\/\/\s*@vitest-environment\s+(?:jsdom|happy-dom)\b/m);
  });

  it("retains the public verification commands and keeps packaging nonpublishing", () => {
    const { scripts } = JSON.parse(readFixture(repo, "package.json"));
    for (const name of [
      "check",
      "check:full",
      "verify",
      "verify:changed",
      "verify:full",
      "test",
      "test:full",
      "test:smoke",
    ])
      expect(typeof scripts[name], name).toBe("string");
    // Publication is an authorization boundary, so this flag is a contract.
    expect(scripts["package:win"]).toMatch(/--publish(?:=|\s+)never(?:\s|$)/);
  });

  it("preserves verification coverage when npm commands are regrouped or workflow formatting changes", () => {
    const { scripts } = JSON.parse(readFixture(repo, "package.json"));
    const references = (source, found = new Set()) => {
      for (const [, name] of source.matchAll(/\bnpm\s+(?:--silent\s+)?run\s+([\w:-]+)/g)) {
        if (found.has(name)) continue;
        found.add(name);
        references(scripts[name] ?? "", found);
      }
      return [...found];
    };
    const recipeReferences = (kind) =>
      localCommands(kind, [], { ci: true }).flatMap(([, args]) => {
        const name = args[args.indexOf("run") + 1];
        return name === "check:full" ? [name, ...recipeReferences(name)] : [name];
      });
    expect(recipeReferences("verify:full")).toEqual(
      expect.arrayContaining([
        "check:types",
        "check:lint",
        "check:format",
        "check:boundaries",
        "deadcode",
        "docs:check",
        "content:audit",
        "test:full",
        "build",
        "test:e2e",
      ]),
    );
    const workflow = readFixture(repo, ".github/workflows/ci.yml");
    expect(references(workflow)).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });
});

it("keeps Steam provenance independent of paid signing and untrusted build permissions", () => {
  const workflow = readFixture(repo, ".github/workflows/ci.yml");
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

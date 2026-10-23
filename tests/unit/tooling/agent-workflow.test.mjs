import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import net from "node:net";
import { taskIntent, recordTaskIntent } from "../../../scripts/lib/task-intent.mjs";
import { runLocal, localPolicy } from "../../../scripts/local.mjs";
import { selectedPaths, parseCheckArgs, runCheck } from "../../../scripts/checks/check.mjs";
import { verificationIdentity } from "../../../scripts/checks/input-identity.mjs";
import { taskContext } from "../../../scripts/agent/agent-context.mjs";
import { review } from "../../../scripts/agent/agent-review.mjs";
import { investigationArgs, investigate } from "../../../scripts/agent/investigate.mjs";
import { runInvestigation } from "../../../scripts/agent/investigation-process.mjs";
import { acquireIntegrationLock } from "../../../scripts/lib/integration-lock.mjs";
import { captureFrame } from "../../../scripts/dev/capture.mjs";
import { integrate } from "../../../scripts/integrate.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";
import { reviewOptions } from "../../../scripts/dev/review-options.mjs";

const roots = [];
const git = (root, ...args) =>
  execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
function put(root, file, value) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), value);
}
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-agent-workflow-"));
  roots.push(root);
  git(root, "init", "-qb", "main");
  git(root, "config", "user.name", "Workflow fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "core.hooksPath", path.join(root, "no-hooks"));
  put(root, ".gitignore", "reports/\nnode_modules/\n.worktrees/\n");
  put(root, "README.md", "# Baseline\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.skipIf(process.platform === "win32")(
  "reports a denied final process-group signal without crashing deadline cleanup",
  async () => {
    const kill = process.kill.bind(process);
    vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (pid < 0 && signal === "SIGKILL") throw Object.assign(new Error("denied"), { code: "EPERM" });
      return kill(pid, signal);
    });
    const result = await runInvestigation(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      timeout: 100,
      stdio: "ignore",
    });
    expect(result.error.message).toContain("Command deadline exhausted");
    expect(result.error.message).toContain("cleanup failed (EPERM)");
    expect(result.signal).toBe("SIGTERM");
  },
);

it("defaults check and review to committed task work without importing concurrent main changes", () => {
  const root = fixture();
  git(root, "checkout", "-qb", "task/example");
  put(root, "README.md", "# Committed task\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "task");
  git(root, "checkout", "main");
  put(root, "main-only.md", "# Concurrent main\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "main");
  git(root, "checkout", "task/example");
  expect(selectedPaths(root, parseCheckArgs([]))).toEqual(["README.md"]);
  expect(selectedPaths(root, parseCheckArgs(["--working-tree"]))).toEqual([]);
  expect(readFileSync(review(root).patches, "utf8")).toContain("+\u0023 Committed task");
  expect(review(root, [], { base: "HEAD" }).selected).toEqual([]);
  put(root, "README.md", "# Staged task\n");
  git(root, "add", "README.md");
  put(root, "README.md", "# Working task\n");
  put(root, "new.md", "# New\n");
  const patch = readFileSync(review(root, [], { layers: true }).patches, "utf8");
  for (const value of ["Committed task", "Staged task", "Working task", "# New"])
    expect(patch).toContain(value);
  expect(selectedPaths(root, parseCheckArgs([])).sort()).toEqual(["README.md", "new.md"]);
  expect(patch).not.toContain("Concurrent main");
});

it("uses the same task scope for context, review and verification after commits and concurrent main work", () => {
  const root = fixture();
  for (const file of ["ARCHITECTURE", "UI", "MENU_DESIGN", "EXPEDITION_DESIGN", "RELEASE"])
    put(root, `Docs/${file}.md`, `# ${file}\n`);
  git(root, "add", ".");
  git(root, "commit", "-qm", "owner docs");
  git(root, "checkout", "-qb", "task/context");
  put(root, "src/ui/collection/example.tsx", "export {};");
  git(root, "add", ".");
  git(root, "commit", "-qm", "committed UI task");
  git(root, "checkout", "main");
  put(root, "desktop/main.cjs", "module.exports = {};");
  git(root, "add", ".");
  git(root, "commit", "-qm", "concurrent desktop task");
  git(root, "checkout", "task/context");
  expect(taskContext(root).topics).toEqual(expect.arrayContaining(["ui", "progression"]));
  expect(taskContext(root).topics).not.toContain("release");
  expect(taskContext(root, { base: "HEAD" }).topics).toEqual(["architecture"]);
  expect(selectedPaths(root, parseCheckArgs([]))).toEqual(review(root).selected.map((entry) => entry.file));
  put(root, "src/ui/settings/example.tsx", "export {};");
  expect(taskContext(root, { base: "HEAD" }).topics).toContain("ui");
});

it("retains committed renames/deletions and literal unusual paths in task review", () => {
  const root = fixture();
  put(root, "delete.md", "gone\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "second base");
  git(root, "checkout", "-qb", "codex/rename");
  const unusual = "odd ' $() [file]\n.md";
  git(root, "mv", "README.md", unusual);
  git(root, "rm", "delete.md");
  git(root, "commit", "-qm", "rename and delete");
  const result = review(root);
  expect(result.selected).toHaveLength(2);
  const patch = readFileSync(result.patches, "utf8");
  expect(patch).toContain("rename from README.md");
  expect(patch).toContain("-gone");
  const finalName = "final.md";
  git(root, "mv", unusual, finalName);
  put(root, finalName, "# Working rename\n");
  const renamed = readFileSync(review(root, ["README.md"]).patches, "utf8");
  expect(renamed).toContain("README.md");
  expect(renamed).toContain("final.md");
  expect(renamed).toContain("+# Working rename");
});

it("executes nonempty verification every time, including after committing and failed attempts", () => {
  const root = fixture();
  git(root, "checkout", "-qb", "task/cache");
  put(root, "README.md", "# Checked\n");
  const runner = vi.fn(() => ({ status: 0 }));
  const options = { root, runner, log: () => {} };
  expect(runCheck([], options)).toBe(0);
  const calls = runner.mock.calls.length;
  git(root, "add", ".");
  git(root, "commit", "-qm", "checked task");
  expect(runCheck([], options)).toBe(0);
  expect(runner).toHaveBeenCalledTimes(calls * 2);
  put(root, "README.md", "# Changed\n");
  runner.mockReturnValue({ status: 1 });
  expect(runCheck([], options)).toBe(1);
  put(root, "README.md", "# Checked\n");
  runner.mockReturnValue({ status: 0 });
  expect(runCheck([], options)).toBe(0);
  expect(runner.mock.calls.length).toBeGreaterThan(calls);
  const beforeSelection = runner.mock.calls.length;
  expect(runCheck(["README.md", ".gitignore"], options)).toBe(0);
  expect(runner.mock.calls.length).toBeGreaterThan(beforeSelection);
  const beforeBase = runner.mock.calls.length;
  expect(runCheck(["--base", "HEAD"], options)).toBe(0);
  expect(runner.mock.calls.length).toBe(beforeBase);
});

it("fingerprints repository inputs without traversing installed dependencies or output caches", () => {
  const root = fixture();
  put(root, "node_modules/tool/index.js", "tool");
  const base = git(root, "rev-parse", "HEAD");
  const identity = () => verificationIdentity(root, base, ["README.md"]);
  let before = identity();
  put(root, "node_modules/.vite/output", "generated");
  put(root, "node_modules/.vitest-cache/results.json", "generated");
  put(root, "reports/capture.png", "generated");
  expect(identity()).toBe(before);
  put(root, "node_modules/tool/index.js", "changed tool");
  symlinkSync("missing-install", path.join(root, "node_modules/broken-link"));
  expect(identity()).toBe(before);
  put(root, "package-lock.json", "changed install inputs");
  expect(identity()).not.toBe(before);
  before = identity();
  put(root, "other.md", "unselected input");
  expect(identity()).not.toBe(before);
  before = identity();
  symlinkSync("README.md", path.join(root, "link"));
  expect(identity()).not.toBe(before);
  before = identity();
  vi.stubEnv("CODEX_TOOL_CALL_ID", "another-call");
  expect(identity()).toBe(before);
  vi.stubEnv("npm_config_ignore_scripts", "different-config");
  expect(identity()).not.toBe(before);
  before = identity();
  vi.stubEnv("FAUNA_WORKFLOW_TEST", "different environment");
  expect(identity()).not.toBe(before);
  vi.unstubAllEnvs();
});

it("fails when inputs mutate during verification, while plan executes nothing", () => {
  const root = fixture();
  const runner = vi.fn(() => {
    put(root, "late.md", "changed");
    return { status: 0 };
  });
  const log = vi.fn();
  expect(runCheck(["README.md"], { root, runner, log })).toBe(1);
  expect(log.mock.calls.flat().join(" ")).toContain("inputs changed");
  runner.mockClear();
  expect(runCheck(["--plan", "README.md"], { root, runner, log })).toBe(0);
  expect(runner).not.toHaveBeenCalled();
});

it("bounds diagnostic resources independently of the number of unit suites", async () => {
  const root = fixture();
  put(root, "tests/unit/game/example.test.ts", "export {};");
  expect(investigationArgs(root, ["unit", "tests/unit/game/example.test.ts"])).toEqual([
    "run",
    "test:full",
    "--",
    "--maxWorkers=1",
    "--no-file-parallelism",
    "tests/unit/game/example.test.ts",
  ]);
  expect(investigationArgs(root, ["unit"])).toEqual([
    "run",
    "test:full",
    "--",
    "--maxWorkers=1",
    "--no-file-parallelism",
  ]);
  const suites = Array.from({ length: 13 }, (_, index) => `tests/unit/game/case-${index}.test.ts`);
  for (const suite of suites) put(root, suite, "export {};");
  expect(investigationArgs(root, ["unit", ...suites]).slice(-13)).toEqual(suites);
  expect(investigationArgs(root, ["browser", "battle"])).toEqual(["run", "test:e2e:route", "--", "battle"]);
  for (const args of [
    ["unit", "tests/unit/missing.test.ts"],
    ["browser"],
    ["browser", "unknown"],
    ["build", "--publish"],
    ["unit", "../other.test.ts"],
    ["performance", "--suite"],
  ])
    expect(() => investigationArgs(root, args)).toThrow();
  const runner = vi.fn(() => ({ status: null, signal: "SIGTERM" }));
  expect(await investigate(["types"], { root, runner, env: { FAUNA_LOCAL_HEAVY: "1" } })).toBe(1);
  expect(runner.mock.calls[0][2]).toMatchObject({ timeout: 300_000 });
  expect(runner.mock.calls[0][2].env.NODE_OPTIONS).toMatch(/--max-old-space-size=2048$/);
});

it("prepares required review conditions and rejects ambiguous, unsupported or repeated options", () => {
  expect(reviewOptions([], { capture: true }).conditions).toEqual([
    { width: 1280, height: 720, scale: 1.25 },
    { width: 1920, height: 1080, scale: 1 },
  ]);
  expect(reviewOptions(["--tier", "small"], { capture: true }).conditions).toEqual([
    { width: 1280, height: 720, scale: 1.25 },
  ]);
  expect(reviewOptions(["--browser", "--scenario", "recruit"]).scenario).toBe("recruit");
  expect(
    reviewOptions(["--viewport", "1920x1080", "--text-scale", "1"], { capture: true }).conditions,
  ).toEqual([{ width: 1920, height: 1080, scale: 1 }]);
  for (const args of [
    ["--scenario", "unknown"],
    ["--label", "../outside"],
    ["--viewport", "800x600"],
    ["--text-scale", "0.8"],
    ["--tier", "small", "--viewport", "1920x1080"],
    ["--tier", "small", "--tier", "layout"],
    ["--label"],
    ["--bogus"],
  ])
    expect(() => reviewOptions(args, { capture: true })).toThrow();
  for (const args of [
    ["--scenario", "battle"],
    ["--desktop", "--scenario", "battle"],
    ["--browser", "--desktop"],
  ])
    expect(() => reviewOptions(args)).toThrow();
});

it(
  "runs one final combined gate with added regressions and preserves the clean-main guard",
  { timeout: 30_000 },
  async () => {
    const root = fixture();
    const task = createWorktree(root, "final-gate");
    put(task.path, "README.md", "# Verified task\n");
    const suite = "tests/unit/regression.test.mjs";
    put(task.path, suite, "export {};\n");
    git(task.path, "add", ".");
    git(task.path, "commit", "-qm", "task");
    const runner = vi.fn(() => ({ status: 0 }));
    const launch = vi.fn((_command, args) => ({
      status: runCheck(args.slice(args.indexOf("--") + 1), { root: task.path, runner, log: () => {} }),
    }));
    put(root, "unfinished.md", "unrelated\n");
    await expect(
      integrate(root, task.branch, { runner: launch, log: () => {}, tests: [suite] }),
    ).rejects.toThrow("unfinished work");
    expect(launch).not.toHaveBeenCalled();
    rmSync(path.join(root, "unfinished.md"));
    await integrate(root, task.branch, { runner: launch, log: () => {}, tests: [suite] });
    expect(launch).toHaveBeenCalledTimes(1);
    const testRuns = runner.mock.calls.filter((call) => call[1][0].endsWith("vitest.mjs"));
    expect(testRuns).toHaveLength(1);
    expect(testRuns[0][1]).toContain(suite);
    expect(git(root, "show", "HEAD:README.md")).toBe("# Verified task");
  },
);

it("rejects CLI options that could narrow or bypass the final integration gate", { timeout: 30_000 }, () => {
  const root = fixture();
  const task = createWorktree(root, "no-bypass");
  const before = git(root, "rev-parse", "HEAD");
  for (const args of [["--working-tree"], ["--base", "HEAD"], ["--plan"], ["--test"]]) {
    expect(() =>
      execFileSync(
        process.execPath,
        [path.resolve(import.meta.dirname, "../../../scripts/integrate.mjs"), task.branch, ...args],
        { cwd: root, stdio: "pipe" },
      ),
    ).toThrow("Usage: npm run integrate");
    expect(git(root, "rev-parse", "HEAD")).toBe(before);
    expect(git(task.path, "status", "--porcelain")).toBe("");
  }
});

it("terminates a timed-out diagnostic instead of accepting a late successful exit", async () => {
  const result = await runInvestigation(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    timeout: 100,
    stdio: "ignore",
  });
  expect(result.error.message).toContain("deadline");
  expect(result.status).not.toBe(0);
  const failedSpawn = await runInvestigation("/missing/fauna-command", [], { timeout: 100, stdio: "ignore" });
  expect(failedSpawn.error).toBeTruthy();
});

it("retains diagnostic screenshots for both layout and preparation failures", async () => {
  const page = {
    on: vi.fn(),
    evaluate: vi.fn(async () => ["offscreen control"]),
    screenshot: vi.fn(async () => {}),
  };
  const options = { path: "diagnostic.png", prepare: async () => {}, layoutViolations: () => [] };
  expect(await captureFrame(page, options)).toEqual({
    file: "diagnostic.png",
    layoutFailures: ["offscreen control"],
    errors: [],
  });
  expect(page.screenshot).toHaveBeenCalledWith({ path: "diagnostic.png" });
  expect(
    await captureFrame(page, {
      ...options,
      prepare: async () => {
        throw new Error("not settled");
      },
    }),
  ).toMatchObject({ file: "diagnostic.png", errors: ["not settled"] });
  page.screenshot.mockRejectedValue(new Error("closed page"));
  expect(await captureFrame(page, options)).toMatchObject({
    file: null,
    errors: ["Screenshot unavailable: closed page"],
  });
});

it("waits for its integration lock without disturbing the owner and bounds exhausted waits", async () => {
  const root = fixture();
  const release = await acquireIntegrationLock(root);
  let ownerReleased = false;
  try {
    await expect(acquireIntegrationLock(root, { timeoutMs: 20, retryMs: 5 })).rejects.toThrow(
      "bounded wait exhausted",
    );
    const waiting = acquireIntegrationLock(root, { timeoutMs: 1000, retryMs: 5 });
    await release();
    ownerReleased = true;
    const finish = await waiting;
    await finish();
  } finally {
    if (!ownerReleased) await release();
  }
});

it("retains the integrated checkout, branch and evidence for follow-up work", async () => {
  const root = fixture();
  const task = createWorktree(root, "retained");
  put(task.path, "README.md", "# Integrated\n");
  put(task.path, "reports/frame.png", "evidence");
  git(task.path, "add", ".");
  git(task.path, "commit", "-qm", "task");
  const result = await integrate(root, task.branch, { runner: () => ({ status: 0 }), log: () => {} });
  expect(result).toMatchObject({ integrated: true, worktree: task.path });
  expect(git(root, "show", "HEAD:README.md")).toBe("# Integrated");
  expect(git(root, "branch", "--list", task.branch)).toContain(task.branch);
  expect(readFileSync(path.join(task.path, "reports/frame.png"), "utf8")).toBe("evidence");
  put(task.path, "follow-up.md", "ready for the next request");
  expect(git(task.path, "status", "--porcelain")).toContain("follow-up.md");
});

it("ignores unrelated environment and documentation for code checks while preserving render inputs", () => {
  const root = fixture();
  put(root, "src/value.ts", "export const value = 1;");
  const base = git(root, "rev-parse", "HEAD");
  const code = () => verificationIdentity(root, base, ["src/value.ts"]);
  const capture = () => verificationIdentity(root, base, [], process.env, "capture");
  const beforeCode = code(),
    beforeCapture = capture();
  put(root, "unrelated.md", "unrelated documentation");
  vi.stubEnv("UNRELATED_SESSION_LABEL", "new session");
  expect(code()).toBe(beforeCode);
  expect(capture()).toBe(beforeCapture);
  put(root, "Docs/CONTENT.md", "# Maintained contract");
  expect(code()).not.toBe(beforeCode);
  expect(capture()).toBe(beforeCapture);
  put(root, "src/value.ts", "export const value = 2;");
  expect(code()).not.toBe(beforeCode);
  expect(capture()).not.toBe(beforeCapture);
  vi.stubEnv("NODE_OPTIONS", "--conditions=development");
  expect(code()).not.toBe(verificationIdentity(root, base, ["src/value.ts"], {}));
});

it("prints ordinary multiline patches while retaining bounded output and machine-readable inventory", () => {
  const root = fixture();
  put(root, "README.md", "# Revised\nSecond line\n");
  const result = review(root);
  expect(result.preview).toContain("@@");
  expect(result.preview).toContain("+# Revised\n+Second line");
  expect(result.preview).not.toContain('"patch":');
  expect(JSON.parse(readFileSync(result.indexPath, "utf8")).selected[0].file).toBe("README.md");
  const bounded = review(root, [], { budget: 20 });
  const full = readFileSync(bounded.patches, "utf8");
  expect(bounded.preview + full.slice(20)).toBe(full);
  expect(bounded.omittedCharacters).toBe(full.length - 20);
});

it(
  "keeps a recorded custom task base across branch renames and reports empty checks explicitly",
  { timeout: 30_000 },
  () => {
    const root = fixture();
    git(root, "checkout", "-qb", "feature/custom-base");
    put(root, "feature.md", "base feature\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "feature base");
    const base = git(root, "rev-parse", "HEAD");
    recordTaskIntent(root, { base });
    put(root, "task.md", "task change\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "task change");
    git(root, "branch", "-m", "arbitrary-name");
    expect(selectedPaths(root, parseCheckArgs([]))).toEqual(["task.md"]);
    expect(review(root).selected.map((entry) => entry.file)).toEqual(["task.md"]);
    const log = vi.fn();
    const runner = vi.fn();
    expect(runCheck(["--working-tree"], { root, runner, log })).toBe(0);
    expect(runner).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(" ")).toContain("EMPTY CHECK");
  },
);

it("includes committed work on an unregistered branch regardless of its prefix", { timeout: 30_000 }, () => {
  const root = fixture();
  git(root, "checkout", "-qb", "fix-without-prefix");
  put(root, "README.md", "# Committed fix\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fix");
  expect(selectedPaths(root, parseCheckArgs([]))).toEqual(["README.md"]);
});

it(
  "remembers extra regressions after failure and finishes from a renamed task checkout",
  { timeout: 30_000 },
  async () => {
    const root = fixture();
    const suite = "tests/unit/existing.test.mjs";
    put(root, suite, "export {};\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "existing regression");
    const task = createWorktree(root, "remember-tests");
    put(task.path, "README.md", "# Task\n");
    git(task.path, "add", ".");
    git(task.path, "commit", "-qm", "task");
    const initialBase = taskIntent(task.path).base;
    const runner = vi.fn(() => ({ status: 1 }));
    expect(runCheck(["--base", "HEAD", "--test", suite], { root: task.path, runner, log: () => {} })).toBe(1);
    expect(taskIntent(task.path).tests).toEqual([suite]);
    expect(taskIntent(task.path).base).toBe(initialBase);
    expect(runCheck(["--plan", "--forget-test", suite], { root: task.path, runner, log: () => {} })).toBe(0);
    expect(taskIntent(task.path).tests).toEqual([suite]);
    git(task.path, "branch", "-m", "feature/renamed-task");
    const launch = vi.fn(() => ({ status: 0 }));
    await integrate(task.path, undefined, { runner: launch, log: () => {} });
    expect(launch.mock.calls[0][1]).toContain(suite);
    expect(selectedPaths(task.path, parseCheckArgs([]))).toEqual([]);
    expect(git(root, "show", "HEAD:README.md")).toBe("# Task");
    runner.mockReturnValue({ status: 0 });
    runCheck(["--forget-test", suite], { root: task.path, runner, log: () => {} });
    expect(taskIntent(task.path).tests).toEqual([]);
  },
);

it("shows the final net change once and exposes reverted intermediate edits only on demand", () => {
  const root = fixture();
  git(root, "checkout", "-qb", "feature/review");
  put(root, "README.md", "# Intermediate\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "intermediate");
  put(root, "README.md", "# Final\n");
  const result = review(root);
  expect(result.preview).toContain("+# Final");
  expect(result.preview).not.toContain("Intermediate");
  expect(result.preview.match(/diff --git/g)).toHaveLength(1);
  put(root, "unrelated.md", "unrelated change\n");
  expect(review(root, ["README.md"]).selected.map((entry) => entry.file)).toEqual(["README.md"]);
  rmSync(path.join(root, "unrelated.md"));
  put(root, "README.md", "# Baseline\n");
  expect(review(root).selected).toEqual([]);
  expect(review(root, [], { layers: true }).preview).toContain("Intermediate");
});

it("blocks expensive local entrypoints before launching work and bounds one exact regression", async () => {
  const root = fixture();
  const runner = vi.fn(async () => ({ status: 0 }));
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const kind of [
    "test:full",
    "verify:full",
    "check:full",
    "check:types",
    "check:lint",
    "check:format",
    "check:boundaries",
    "deadcode",
    "build",
    "test:e2e",
    "test:desktop",
    "test:interactions",
    "test:e2e:route",
    "perf",
    "balance:playthrough",
    "balance:compare",
  ]) {
    expect(await runLocal(kind, [], { root, env: {}, runner })).toBe(1);
    expect(localPolicy(kind, [], { root, env: { CI: "true" } })).toBeNull();
    expect(localPolicy(kind, [], { root, env: { FAUNA_LOCAL_HEAVY: "1" } })).toBeNull();
  }
  for (const args of [["tests"], ["--maxWorkers=8"], ["missing.test.ts"], ["tests/unit/../other.test.ts"]])
    expect(await runLocal("test", args, { root, env: {}, runner })).toBe(1);
  expect(await investigate(["browser", "battle"], { root, env: {}, runner })).toBe(1);
  expect(runner).not.toHaveBeenCalled();
  expect(error.mock.calls.flat().join(" ")).toContain("CI-owned");
  const suite = "tests/unit/example.test.mjs";
  put(root, suite, "export {};\n");
  expect(await runLocal("test", [suite], { root, env: {}, runner })).toBe(0);
  expect(runner.mock.calls[0][2].timeout).toBeLessThanOrEqual(30_000);
  expect(runner.mock.calls[0][2].env.NODE_OPTIONS).toMatch(/--max-old-space-size=1024$/);
  expect(localPolicy("test", [suite, "-t", "one regression"], { root, env: {} })).toBeNull();
  expect(localPolicy("test", [suite, "--maxWorkers=8"], { root, env: {} })).toContain("CI-owned");
  runner.mockClear();
  expect(await runLocal("test", [], { root, env: {}, runner })).toBe(0);
  expect(runner.mock.calls[0][1][0]).toMatch(/run-local-tests\.mjs$/);
});

it("enforces ordinary local command budgets while retaining CI parallelism and failing recipes early", async () => {
  const root = fixture();
  const runner = vi.fn(async () => ({ status: 0 }));
  expect(await runLocal("test", ["--maxWorkers=8"], { root, env: { FAUNA_LOCAL_HEAVY: "1" }, runner })).toBe(
    0,
  );
  const [, args, options] = runner.mock.calls[0];
  expect(args.at(-2)).toBe("--maxWorkers=1");
  expect(args.at(-1)).toBe("--no-file-parallelism");
  expect(options.timeout).toBeGreaterThan(0);
  expect(options.timeout).toBeLessThanOrEqual(300_000);
  expect(options.env.NODE_OPTIONS).toMatch(/--max-old-space-size=2048$/);
  runner.mockClear();
  await runLocal("test", [], { root, env: { CI: "true" }, runner });
  expect(runner.mock.calls[0][1]).not.toContain("--maxWorkers=1");
  expect(runner.mock.calls[0][2].timeout).toBeUndefined();
  runner.mockClear().mockResolvedValue({ status: 7 });
  expect(await runLocal("build", [], { root, env: { FAUNA_LOCAL_HEAVY: "1" }, runner })).toBe(7);
  expect(runner).toHaveBeenCalledTimes(1);
});

it(
  "migrates the old socket lock once and then ignores unrelated services on its former port",
  { timeout: 45000 },
  async () => {
    const root = fixture();
    put(root, "scripts/lib/integration-lock.mjs", "// previous integration entrypoint\n");
    const common = git(root, "rev-parse", "--absolute-git-dir");
    const port = 20000 + (createHash("sha256").update(common).digest().readUInt32BE(0) % 40000);
    const unrelated = net.createServer();
    const listen = () =>
      new Promise((resolve, reject) => {
        unrelated.once("error", reject);
        unrelated.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
      });
    const close = () =>
      new Promise((resolve, reject) => unrelated.close((error) => (error ? reject(error) : resolve())));
    await listen();
    try {
      await expect(acquireIntegrationLock(root)).rejects.toThrow("one-time upgrade");
    } finally {
      await close();
    }
    const release = await acquireIntegrationLock(root);
    await expect(acquireIntegrationLock(root)).rejects.toThrow("Integration lock is occupied");
    await release();
    await listen();
    try {
      const finish = await acquireIntegrationLock(root);
      await finish();
    } finally {
      await close();
    }
  },
);

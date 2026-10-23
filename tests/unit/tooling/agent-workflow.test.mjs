import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
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
  const patch = readFileSync(review(root).patches, "utf8");
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
  expect(renamed).toContain("rename from README.md");
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

it("selects bounded diagnostics without exposing arbitrary npm commands or broad browser runs", async () => {
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
  const suites = Array.from({ length: 13 }, (_, index) => `tests/unit/game/case-${index}.test.ts`);
  for (const suite of suites) put(root, suite, "export {};");
  expect(investigationArgs(root, ["unit", ...suites]).slice(-13)).toEqual(suites);
  expect(investigationArgs(root, ["browser", "battle"])).toEqual(["run", "test:e2e:route", "--", "battle"]);
  for (const args of [
    ["unit"],
    ["unit", "tests/unit/missing.test.ts"],
    ["browser"],
    ["browser", "unknown"],
    ["build", "--publish"],
    ["unit", "../other.test.ts"],
    ["performance", "--suite"],
  ])
    expect(() => investigationArgs(root, args)).toThrow();
  const runner = vi.fn(() => ({ status: null, signal: "SIGTERM" }));
  expect(await investigate(["types"], { root, runner })).toBe(1);
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

it("runs one final combined gate with added regressions and preserves the clean-main guard", async () => {
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
});

it("rejects CLI options that could narrow or bypass the final integration gate", () => {
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

it("reports successful integration separately from failed cleanup and preserves its checkout", async () => {
  const root = fixture();
  const task = createWorktree(root, "cleanup-failure");
  put(task.path, "README.md", "# Integrated\n");
  git(task.path, "add", ".");
  git(task.path, "commit", "-qm", "task");
  const result = await integrate(root, task.branch, {
    runner: () => ({ status: 0 }),
    log: () => {},
    cleanup: () => {
      throw new Error("archive unavailable");
    },
  });
  expect(result).toMatchObject({
    integrated: true,
    cleanup: { status: "pending", reason: "archive unavailable" },
  });
  expect(git(root, "show", "HEAD:README.md")).toBe("# Integrated");
  expect(readFileSync(path.join(task.path, "README.md"), "utf8")).toBe("# Integrated\n");
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

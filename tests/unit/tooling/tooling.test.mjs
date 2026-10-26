import { git, put, readFixture, repository } from "../../support/tooling.mjs";
import { describe, expect, it, vi } from "vitest";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { checkDocumentation } from "../../../scripts/checks/check-docs.mjs";
import { checkBundleBudget } from "../../../scripts/checks/check-bundle-budget.mjs";
import { summarizeReport, publishSummary } from "../../../scripts/ci/ci-summarize.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";
import { cleanupWorktrees } from "../../../scripts/worktree-cleanup.mjs";
import { integrate } from "../../../scripts/integrate.mjs";
import { acquireIntegrationLock } from "../../../scripts/lib/integration-lock.mjs";

const repo = () =>
  repository(
    {
      "package.json": JSON.stringify({ scripts: { check: "check", "docs:check": "docs" } }),
      "package-lock.json": "{}\n",
      ".gitignore": ".worktrees/\nnode_modules\n",
      "README.md": "# Fauna\n\n[Workflow](Docs/workflow.md#commands)\n",
      "Docs/workflow.md": "# Workflow\n\n## Commands\n\nnpm run check\n",
    },
    "fauna tooling-",
  );

describe("documentation contracts", () => {
  it("keeps archives and task evidence historical while validating maintained links into them", () => {
    const root = repo();
    put(root, "Docs/archive/old.md", "# Historical\n`src/retired.ts`\n[Old](gone.md)\nnpm run retired\n");
    put(root, "Docs/task-evidence/task.md", "# Task evidence\n`src/renamed.ts`\nnpm run old-command\n");
    expect(checkDocumentation(root)).toEqual([]);
    put(root, "README.md", "# Fauna\n[Workflow](Docs/workflow.md)\n[History](Docs/archive/old.md#missing)\n");
    expect(checkDocumentation(root)).toEqual(["README.md: missing heading Docs/archive/old.md#missing"]);
    put(root, "Docs/new-guide.md", "# Maintained guide\n");
    const warnings = [];
    expect(checkDocumentation(root, { warn: (message) => warnings.push(message) })).toEqual([
      "README.md: missing heading Docs/archive/old.md#missing",
    ]);
    expect(warnings.join("\n")).toContain("Docs/new-guide.md: document is unreachable");
  });
  it("blocks broken links, commands, anchors and paths while advising on orphaned untracked docs", () => {
    const root = repo();
    expect(checkDocumentation(root)).toEqual([]);
    put(
      root,
      "Docs/workflow.md",
      "# Workflow\n\n## Commands\n[Missing](gone.md) [Wrong anchor](../README.md#missing)\n`src/gone.ts`\n```sh\nnpm run absent\n```\n",
    );
    put(root, "Docs/orphan.md", "# Orphan\n");
    const warnings = [];
    const failures = checkDocumentation(root, { warn: (message) => warnings.push(message) }).join("\n");
    for (const message of [
      "missing link gone.md",
      "missing heading ../README.md#missing",
      "missing file reference src/gone.ts",
      "unknown npm script absent",
    ])
      expect(failures).toContain(message);
    expect(failures).not.toContain("document is unreachable");
    expect(warnings).toEqual(["Docs/orphan.md: document is unreachable from README.md or AGENTS.md"]);
  });

  it("ignores sample file paths, external provenance and ignored dependency docs, but validates commands in examples", () => {
    const root = repo();
    put(
      root,
      "Docs/workflow.md",
      "# Workflow\n\n## Commands\n`Alchemy: src/foreign.ts`\n```sh\n`src/example.ts`\nnpm --silent run check\n```\n[Web](https://example.invalid)\n",
    );
    put(root, "node_modules/foreign/README.md", "[Broken](missing.md)\n");
    expect(checkDocumentation(root)).toEqual([]);
    rmSync(path.join(root, "Docs/workflow.md"));
    expect(checkDocumentation(root)).toEqual(["README.md: missing link Docs/workflow.md#commands"]);
  });
});

describe("bundle allowance", () => {
  it("counts all JavaScript chunks and rejects missing, empty and oversized bundles", () => {
    const root = repo(),
      assets = path.join(root, "dist/assets");
    mkdirSync(assets, { recursive: true });
    const budget = { baselineBytes: 8, maxBytes: 10, warnBytes: 9 };
    expect(() => checkBundleBudget(assets, budget)).toThrow("Missing nonempty");
    put(root, "dist/assets/index-test.js", "");
    expect(() => checkBundleBudget(assets, budget)).toThrow("Missing nonempty");
    put(root, "dist/assets/index-test.js", "12345678");
    put(root, "dist/assets/nested/shared-test.js", "12");
    put(root, "dist/assets/style.css", "css does not count");
    const log = vi.fn();
    expect(checkBundleBudget(assets, budget, log).bytes).toBe(10);
    expect(log.mock.calls.flat().join(" ")).toContain("Warning");
    put(root, "dist/assets/nested/shared-test.js", "123");
    expect(() => checkBundleBudget(assets, budget, () => {})).toThrow("exceeds");
  });
});

describe("CI diagnostics", () => {
  it("lists suite startup errors and bounded assertion failures without unsafe Markdown", () => {
    const summary = summarizeReport("vitest", {
      success: false,
      numFailedTestSuites: 2,
      numFailedTests: 12,
      testResults: [
        { name: "startup.mjs", status: "failed", message: "Cannot import module\nstack" },
        {
          name: "test.mjs",
          assertionResults: Array.from({ length: 12 }, () => ({
            status: "failed",
            title: "<script>bad</script>",
            failureMessages: ["Expected true\nstack"],
          })),
        },
      ],
    });
    expect(summary).toContain("Runner error: startup.mjs: Cannot import module");
    expect(summary).toContain("2 more failures");
    expect(summary).not.toContain("<script>");
    expect(summary).not.toContain("stack");
  });

  it("includes nested browser failures, flaky outcomes and trace paths, and identifies unavailable reports", () => {
    const summary = summarizeReport("playwright", {
      stats: { expected: 1, unexpected: 1, flaky: 1, skipped: 0 },
      errors: [{ message: "Browser exited" }],
      suites: [
        {
          suites: [
            {
              specs: [
                {
                  file: "expedition.spec.ts",
                  line: 12,
                  title: "resume",
                  tests: [
                    {
                      status: "unexpected",
                      results: [
                        {
                          errors: [{ message: "No Continue button" }],
                          attachments: [{ path: "test-results/resume/trace.zip" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(summary).toContain("expedition.spec.ts:12");
    expect(summary).toContain("test-results/resume/trace.zip");
    expect(summary).toContain("flaky: 1");
    expect(() => summarizeReport("vitest", { testResults: [], numPassedTests: -1 })).toThrow(
      "Invalid test count",
    );
    expect(
      summarizeReport("playwright", {
        stats: {},
        suites: [{ specs: [{ title: "hidden failure", tests: [{ status: "unexpected" }] }] }],
      }),
    ).toContain("failed: 1");
    const root = repo();
    const output = path.join(root, "summary.md");
    publishSummary("vitest", path.join(root, "missing.json"), { output });
    expect(readFileSync(output, "utf8")).toContain("report unavailable");
    put(root, "invalid.json", "{}");
    publishSummary("playwright", path.join(root, "invalid.json"), { output });
    expect(readFileSync(output, "utf8")).not.toContain("Passed: 0");
  });
});

// These safety regressions launch real Git processes; host contention is not a latency failure.
describe("isolated worktrees and protected integration", { timeout: 30_000 }, () => {
  it("starts from committed main, preserves dirty main, links matching dependencies and reuses without resetting", () => {
    const root = repo();
    mkdirSync(path.join(root, "node_modules"));
    put(root, "README.md", "Uncommitted work stays on main\n");
    const task = createWorktree(root, "tooling");
    expect(task.linked).toBe(true);
    expect(git(task.path, "branch", "--show-current")).toBe("task/tooling");
    expect(readFixture(task.path, "README.md")).toContain("# Fauna");
    put(task.path, "experiment.txt", "unfinished task experiment");
    expect(createWorktree(root, "tooling").reused).toBe(true);
    expect(readFixture(task.path, "experiment.txt")).toContain("unfinished");
    expect(readFixture(root, "README.md")).toContain("Uncommitted");
  });

  it("does not share mismatched dependencies or replace preexisting branches and directories", () => {
    const root = repo();
    mkdirSync(path.join(root, "node_modules"));
    put(root, "package-lock.json", '{"changed":true}');
    expect(createWorktree(root, "different-deps").linked).toBe(false);
    mkdirSync(path.join(root, ".worktrees/existing"));
    expect(() => createWorktree(root, "existing")).toThrow("already exists");
    git(root, "branch", "task/old");
    expect(() => createWorktree(root, "old")).toThrow("branch already exists");
    for (const name of ["../outside", "Task", "", "a--b"]) expect(() => createWorktree(root, name)).toThrow();
  });

  it("serializes integrations and releases a crashed process's lock", async () => {
    const root = repo();
    const module = pathToFileURL(
      path.resolve(import.meta.dirname, "../../../scripts/lib/integration-lock.mjs"),
    ).href;
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { acquireIntegrationLock } from ${JSON.stringify(module)}; await acquireIntegrationLock(${JSON.stringify(root)}); console.log("locked"); setInterval(() => {}, 1000);`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const closed = once(child, "exit");
    try {
      await Promise.race([
        once(child.stdout, "data"),
        closed.then(() => {
          throw new Error("Lock holder exited early");
        }),
      ]);
      await expect(acquireIntegrationLock(root)).rejects.toThrow("occupied");
    } finally {
      child.kill("SIGKILL");
      await closed;
    }
    const release = await acquireIntegrationLock(root);
    await release();
    rmSync(path.join(root, ".git/fauna-integration.lock"));
    mkdirSync(path.join(root, ".git/fauna-integration.lock"));
    await expect(acquireIntegrationLock(root)).rejects.toThrow("Legacy integration lock");
  });

  it("preserves main on failed verification and checks the combined diff plus docs before integrating", async () => {
    const root = repo();
    const task = createWorktree(root, "integration");
    put(task.path, "Docs/workflow.md", "# Workflow\n\n## Commands\n\nTask change\n");
    git(task.path, "add", ".");
    git(task.path, "commit", "-qm", "task");
    put(root, "main-only.txt", "concurrent main change");
    git(root, "add", ".");
    git(root, "commit", "-qm", "main");
    const original = git(root, "rev-parse", "HEAD");
    await expect(
      integrate(root, task.branch, { runner: () => ({ status: 1 }), log: () => {} }),
    ).rejects.toThrow("main was not advanced");
    expect(git(root, "rev-parse", "HEAD")).toBe(original);
    const runner = vi.fn(() => ({ status: 0 }));
    await integrate(root, task.branch, { runner, log: () => {} });
    expect(runner.mock.calls.map((call) => call[1].slice(1))).toEqual([
      ["run", "verify:changed", "--", "--base", original],
    ]);
    expect(readFixture(root, "main-only.txt")).toContain("concurrent");
    expect(git(root, "show", "HEAD:Docs/workflow.md")).toContain("Task change");
    expect(existsSync(task.path)).toBe(true);
    expect(git(root, "branch", "--list", task.branch)).toContain(task.branch);
  });

  it("audits without removal, archives ignored artifacts and preserves dirty or unmerged tasks", async () => {
    const root = repo();
    put(root, ".gitignore", ".worktrees/\nnode_modules\nreports/\n");
    git(root, "add", ".gitignore");
    git(root, "commit", "-qm", "ignore reports");
    const clean = createWorktree(root, "clean");
    put(clean.path, "reports/evidence.txt", "keep this evidence");
    const dirty = createWorktree(root, "dirty");
    put(dirty.path, "unfinished.txt", "unfinished");
    const unmerged = createWorktree(root, "unmerged");
    put(unmerged.path, "feature.txt", "unique work");
    git(unmerged.path, "add", ".");
    git(unmerged.path, "commit", "-qm", "unmerged feature");
    const locked = createWorktree(root, "locked");
    git(root, "worktree", "lock", locked.path);
    git(root, "branch", "codex/merged-without-checkout");
    git(root, "branch", "personal-work");
    const audit = await cleanupWorktrees(root, { log: () => {} });
    expect(audit.find((entry) => entry.branch === clean.branch).status).toBe("eligible");
    expect(existsSync(clean.path)).toBe(true);
    expect(audit.find((entry) => entry.branch === locked.branch).status).toBe("preserved");
    const result = await cleanupWorktrees(root, { apply: true, log: () => {} });
    const removed = result.find((entry) => entry.branch === clean.branch);
    expect(removed.status).toBe("removed");
    expect(readFixture(removed.archive, "files/reports/evidence.txt")).toBe("keep this evidence");
    expect(existsSync(clean.path)).toBe(false);
    expect(git(root, "branch", "--list", clean.branch)).toBe("");
    expect(git(root, "branch", "--list", "codex/merged-without-checkout")).toBe("");
    expect(git(root, "branch", "--list", "personal-work")).toContain("personal-work");
    for (const task of [dirty, unmerged, locked]) {
      expect(result.find((entry) => entry.branch === task.branch).status).toBe("preserved");
      expect(existsSync(task.path)).toBe(true);
      expect(git(root, "branch", "--list", task.branch)).toContain(task.branch);
    }
    expect(readFixture(dirty.path, "unfinished.txt")).toBe("unfinished");
    expect(git(unmerged.path, "show", "HEAD:feature.txt")).toBe("unique work");
  });

  it("integrates a locked task without retiring its checkout", async () => {
    const root = repo();
    const task = createWorktree(root, "locked-integration");
    put(task.path, "feature.txt", "reviewed change");
    git(task.path, "add", ".");
    git(task.path, "commit", "-qm", "feature");
    git(root, "worktree", "lock", task.path);
    await expect(
      integrate(root, task.branch, {
        runner: () => ({ status: 0 }),
        log: () => {},
      }),
    ).resolves.toMatchObject({ integrated: true, worktree: task.path });
    expect(git(root, "show", "HEAD:feature.txt")).toBe("reviewed change");
    expect(existsSync(task.path)).toBe(true);
    git(root, "worktree", "unlock", task.path);
    await cleanupWorktrees(root, { apply: true, log: () => {} });
    expect(existsSync(task.path)).toBe(false);
  });

  it("rejects unfinished Git operations even on clean worktrees and prevents advancement after verification mutations", async () => {
    const root = repo();
    const task = createWorktree(root, "unsafe");
    const original = git(root, "rev-parse", "HEAD");
    const marker = git(task.path, "rev-parse", "--git-path", "CHERRY_PICK_HEAD");
    put(task.path, path.relative(task.path, path.resolve(task.path, marker)), original);
    await expect(integrate(root, task.branch)).rejects.toThrow("Unfinished Git operation");
    rmSync(path.resolve(task.path, marker));
    await expect(
      integrate(root, task.branch, {
        runner: () => {
          put(task.path, "late.txt", "new unfinished work");
          return { status: 0 };
        },
      }),
    ).rejects.toThrow("unfinished work");
    expect(git(root, "rev-parse", "HEAD")).toBe(original);
    expect(readFixture(task.path, "late.txt")).toContain("unfinished");
  });

  it("preserves a clean worktree with a multi-commit cherry-pick still in progress", async () => {
    const root = repo();
    const task = createWorktree(root, "sequenced");
    put(root, "README.md", "Main change\n");
    git(root, "add", "README.md");
    git(root, "commit", "-qm", "main change");
    const first = git(root, "rev-parse", "HEAD");
    put(root, "second.txt", "Next cherry-pick\n");
    git(root, "add", "second.txt");
    git(root, "commit", "-qm", "next change");
    const mainHead = git(root, "rev-parse", "HEAD");
    put(task.path, "README.md", "Task change\n");
    git(task.path, "add", "README.md");
    git(task.path, "commit", "-qm", "task change");
    expect(() => git(task.path, "cherry-pick", first, mainHead)).toThrow();
    put(task.path, "README.md", "Main change\n");
    git(task.path, "add", "README.md");
    git(task.path, "commit", "-qm", "resolve first pick");
    expect(git(task.path, "status", "--porcelain")).toBe("");
    const runner = vi.fn(() => ({ status: 0 }));
    await expect(integrate(root, task.branch, { runner })).rejects.toThrow("sequencer");
    expect(runner).not.toHaveBeenCalled();
    expect(git(root, "rev-parse", "HEAD")).toBe(mainHead);
    expect(existsSync(task.path)).toBe(true);
  });
});

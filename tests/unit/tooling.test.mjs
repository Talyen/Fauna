import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  realpathSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { checkDocumentation } from "../../scripts/check-docs.mjs";
import { checkBundleBudget } from "../../scripts/check-bundle-budget.mjs";
import { summarizeReport, publishSummary } from "../../scripts/ci-summarize.mjs";
import { createWorktree } from "../../scripts/worktree.mjs";
import { integrate } from "../../scripts/integrate.mjs";
import { acquireIntegrationLock } from "../../scripts/lib/integration-lock.mjs";

const roots = [];
function put(root, file, contents) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), contents);
}
function git(root, ...args) {
  return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function repo() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "fauna tooling-")));
  roots.push(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Tooling fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "core.hooksPath", path.join(root, "no-hooks"));
  put(root, "package.json", JSON.stringify({ scripts: { check: "check", "docs:check": "docs" } }));
  put(root, "package-lock.json", "{}\n");
  put(root, ".gitignore", ".worktrees/\nnode_modules\n");
  put(root, "README.md", "# Fauna\n\n[Workflow](Docs/workflow.md#commands)\n");
  put(root, "Docs/workflow.md", "# Workflow\n\n## Commands\n\nnpm run check\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("documentation contracts", () => {
  it("detects broken links, commands, anchors, paths and orphaned documents including untracked docs", () => {
    const root = repo();
    expect(checkDocumentation(root)).toEqual([]);
    put(
      root,
      "Docs/workflow.md",
      "# Workflow\n\n## Commands\n[Missing](gone.md) [Wrong anchor](../README.md#missing)\n`src/gone.ts`\n```sh\nnpm run absent\n```\n",
    );
    put(root, "Docs/orphan.md", "# Orphan\n");
    const failures = checkDocumentation(root).join("\n");
    for (const message of [
      "missing link gone.md",
      "missing heading ../README.md#missing",
      "missing file reference src/gone.ts",
      "unknown npm script absent",
      "document is unreachable",
    ])
      expect(failures).toContain(message);
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

describe("isolated worktrees and protected integration", () => {
  it("starts from committed main, preserves dirty main, links matching dependencies and reuses without resetting", () => {
    const root = repo();
    mkdirSync(path.join(root, "node_modules"));
    put(root, "README.md", "Uncommitted work stays on main\n");
    const task = createWorktree(root, "tooling");
    expect(task.linked).toBe(true);
    expect(git(task.path, "branch", "--show-current")).toBe("task/tooling");
    expect(readFileSync(path.join(task.path, "README.md"), "utf8")).toContain("# Fauna");
    put(task.path, "experiment.txt", "unfinished task experiment");
    expect(createWorktree(root, "tooling").reused).toBe(true);
    expect(readFileSync(path.join(task.path, "experiment.txt"), "utf8")).toContain("unfinished");
    expect(readFileSync(path.join(root, "README.md"), "utf8")).toContain("Uncommitted");
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
      path.resolve(import.meta.dirname, "../../scripts/lib/integration-lock.mjs"),
    ).href;
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { acquireIntegrationLock } from ${JSON.stringify(module)}; await acquireIntegrationLock(${JSON.stringify(root)}); console.log("locked");`,
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
      ["run", "check", "--", "--base", original],
      ["run", "docs:check"],
    ]);
    expect(readFileSync(path.join(root, "main-only.txt"), "utf8")).toContain("concurrent");
    expect(git(root, "rev-parse", "HEAD")).toBe(git(task.path, "rev-parse", "HEAD"));
    expect(existsSync(task.path)).toBe(true);
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
    expect(readFileSync(path.join(task.path, "late.txt"), "utf8")).toContain("unfinished");
  });
});

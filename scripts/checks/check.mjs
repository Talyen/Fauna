import path from "node:path";
import { lstatSync, readFileSync, existsSync, realpathSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { boundaryViolations } from "./boundaries.mjs";
import { sourceViolations } from "./ui-contract.mjs";
import { taskBase, taskPaths } from "../lib/task-selection.mjs";
import { verificationIdentity } from "./input-identity.mjs";
import owners from "./test-owners.json" with { type: "json" };
import { affectedTests } from "./affected-tests.mjs";
import { matchingDependencies, dependenciesAvailable } from "../dependencies.mjs";

import { git } from "../lib/git.mjs";
import { taskIntent, recordTaskIntent } from "../lib/task-intent.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CI_NOTICE = "Task checks. CI owns complete static, unit, build, browser and desktop validation.";

export function parseCheckArgs(args) {
  const paths = [];
  const tests = [];
  const forget = [];
  let base = null,
    diff = false,
    plan = false,
    related = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--plan") plan = true;
    else if (arg === "--related") related = true;
    else if (arg === "--diff" || arg === "--working-tree") diff = true;
    else if (arg === "--test" || arg === "--forget-test") {
      if (!args[i + 1] || args[i + 1].startsWith("-"))
        throw new Error(`${arg} requires a unit/integration suite path.`);
      (arg === "--test" ? tests : forget).push(args[++i]);
    } else if (arg === "--base") {
      if (base || !args[i + 1] || args[i + 1].startsWith("-"))
        throw new Error("--base requires one Git commit or branch.");
      base = args[++i];
    } else if (arg.startsWith("-")) throw new Error(`Unknown local check option: ${arg}`);
    else paths.push(arg);
  }
  if (base && diff) throw new Error("Choose --base or --working-tree, not both.");
  if (paths.length && (base || diff)) throw new Error("Choose explicit paths or a Git diff, not both.");
  return {
    paths,
    base: base ?? (diff ? "HEAD" : null),
    ...(plan ? { plan: true } : {}),
    ...(related ? { related: true } : {}),
    ...(tests.length ? { tests } : {}),
    ...(forget.length ? { forget } : {}),
  };
}

export { taskPaths as selectedPaths } from "../lib/task-selection.mjs";

export function formatSelection(root, paths) {
  const files = paths.filter((file) => lstatSync(path.join(root, file), { throwIfNoEntry: false })?.isFile());
  const batches = [];
  let batch = [],
    bytes = 0;
  for (const file of files) {
    const size = lstatSync(path.join(root, file)).size;
    if (
      batch.length &&
      (batch.length >= 50 ||
        bytes + size > 256_000 ||
        Buffer.byteLength(JSON.stringify([...batch, file])) > 8000)
    ) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(file);
    bytes += size;
  }
  if (batch.length) batches.push(batch);
  return { files, batches };
}

export function checkPlan(root, paths, namedTests = [], { related = false } = {}) {
  const configs = new Set();
  const tests = new Set(namedTests);
  const contracts = new Set();
  for (const file of paths) {
    const owner = Object.keys(owners)
      .filter((prefix) => file === prefix || (prefix.endsWith("/") && file.startsWith(prefix)))
      .sort((a, b) => b.length - a.length)[0];
    if (owner) {
      contracts.add(owner);
      for (const suite of owners[owner].suites) tests.add(suite);
    }
    const typed = /\.tsx?$/.test(file);
    if (typed && file.startsWith("src/game/")) configs.add("tsconfig.game.json");
    if (typed && file.startsWith("src/") && !file.startsWith("src/tooling/")) configs.add("tsconfig.json");
    if (typed && (file.startsWith("src/tooling/") || /^(?:vite|vitest|playwright)\.config\.ts$/.test(file)))
      configs.add("tsconfig.node.json");
    if (typed && (file.startsWith("tests/") || file.startsWith("design/"))) configs.add("tsconfig.test.json");
    if (file.startsWith("desktop/") || file === "src/platform/ports.ts") {
      configs.add("tsconfig.desktop.json");
      configs.add("tsconfig.desktop-boundary.json");
    }
    if (/^tsconfig.*\.json$/.test(file) || /^(?:package(?:-lock)?\.json|\.node-version)$/.test(file))
      for (const config of [
        "tsconfig.game.json",
        "tsconfig.json",
        "tsconfig.node.json",
        "tsconfig.test.json",
        "tsconfig.desktop.json",
        "tsconfig.desktop-boundary.json",
      ])
        configs.add(config);
    if (/^tests\/(?:unit|integration)\/.*\.test\.[cm]?[jt]sx?$/.test(file)) tests.add(file);
    const filenameOwner = /^(?:src\/(.+)|scripts\/(.+))\.[cm]?[jt]sx?$/.exec(file);
    if (filenameOwner)
      for (const extension of ["ts", "tsx", "mjs", "js"])
        tests.add(
          `tests/unit/${filenameOwner[1] ?? `tooling/${path.posix.basename(filenameOwner[2])}`}.test.${extension}`,
        );
  }
  const missingContracts = [...contracts].flatMap((owner) =>
    owners[owner].suites
      .filter((suite) => !lstatSync(path.join(root, suite), { throwIfNoEntry: false })?.isFile())
      .map((suite) => ({ owner, suite })),
  );
  const primary = [...tests].filter((file) => existsSync(path.join(root, file))).sort();
  const files =
    related && paths.some((file) => /\.(?:[cm]?[jt]sx?|json|css)$/.test(file))
      ? git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
          .split("\0")
          .filter(
            (file) =>
              /\.(?:[cm]?[jt]sx?|json|css)$/.test(file) &&
              lstatSync(path.join(root, file), { throwIfNoEntry: false })?.isFile(),
          )
      : [];
  const affected = related ? affectedTests(root, paths, files) : { tests: [], unresolved: [] };
  return {
    configs: [...configs],
    tests: primary,
    missingContracts,
    contracts: [...contracts].map((owner) => ({ owner, reason: owners[owner].reason })),
    relatedTests: affected.tests.filter((file) => !primary.includes(file)),
    unresolved: affected.unresolved,
  };
}

export function runCheck(args = [], { root = ROOT, runner = spawnSync, log = console.log } = {}) {
  const selection = parseCheckArgs(args);
  const base = taskBase(root, selection.base);
  const normalize = (file) => path.relative(root, path.resolve(root, file)).split(path.sep).join("/");
  const forget = (selection.forget ?? []).map(normalize);
  const requested = (selection.tests ?? []).map(normalize);
  const namedTests = [...new Set([...taskIntent(root).tests, ...requested])]
    .filter((file) => !forget.includes(file))
    .map((file) => {
      const relative = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");
      if (
        !/^tests\/(?:unit|integration)\/.+\.test\.[cm]?[jt]sx?$/.test(relative) ||
        !existsSync(path.join(root, relative))
      )
        throw new Error(
          `Choose an existing unit/integration suite: ${file}. Remove an obsolete selection with --forget-test ${file}.`,
        );
      return relative;
    });
  const paths = [...new Set([...taskPaths(root, { ...selection, base }), ...namedTests])];
  const format = formatSelection(root, paths);
  const plan = checkPlan(root, paths, namedTests, selection);
  const docs = paths.some((file) => /\.md$/i.test(file));
  const docsOnly = paths.length > 0 && paths.every((file) => /\.md$/i.test(file));
  log(CI_NOTICE);
  log(
    `Selection base: ${base}${selection.paths.length ? "; explicit paths" : "; committed and working changes"}.`,
  );
  log(
    `Plan: ${paths.length} selected files; ${format.batches.length} formatting batches; batched lint and source contracts; compilers: ${plan.configs.join(", ") || "none"}; documentation: ${docs ? "yes" : "no"}.`,
  );
  log(
    plan.tests.length
      ? `Focused suites: ${plan.tests.join(", ")}`
      : plan.missingContracts.length
        ? "Verification blocked: required owner suites are missing."
        : docsOnly
          ? "Documentation only; no tests needed."
          : paths.length
            ? "No matching suite; running fixed Node smoke (not affected-behavior coverage)."
            : "EMPTY CHECK: no changed files selected; no checks ran. Use npm test for unit/DOM tests, npm run check for full static checks, or --base to select a task range.",
  );
  for (const { owner, reason } of plan.contracts) log(`Contract ${owner}: ${reason}`);
  for (const { owner, suite } of plan.missingContracts)
    log(
      `Missing required suite ${suite} for ${owner}; repair scripts/checks/test-owners.json or restore the suite.`,
    );
  if (plan.relatedTests.length)
    log(`Related suites (optional --test additions; full coverage in CI): ${plan.relatedTests.join(", ")}`);
  if (plan.unresolved.length)
    log(`Import graph could not parse: ${plan.unresolved.join(", ")}. CI retains full coverage.`);
  log(
    "Required suites cover declared boundaries, changed tests and matching filenames. Add task-specific regressions with --test; --plan --related explores import dependencies. Full CI and rendered review remain separate evidence.",
  );
  if (selection.plan) {
    log("Plan only; no checks ran.");
    return 0;
  }
  if (requested.length || forget.length) recordTaskIntent(root, { tests: requested, forget });
  if (plan.missingContracts.length) return 1;
  if (!paths.length) return 0;
  const modules = path.join(root, "node_modules");
  if (
    lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink() &&
    (!existsSync(modules) ||
      !matchingDependencies(root, path.dirname(realpathSync(modules))) ||
      !dependenciesAvailable(root))
  ) {
    log(
      "Shared dependencies are incomplete or do not match this task. Run npm run deps, then retry the task check.",
    );
    return 1;
  }
  const identity = verificationIdentity(root, base, [...new Set([...paths, ...plan.tests])]);
  const run = (script, argv = [], timeout = 60_000) => {
    const result = runner(process.execPath, [path.join(root, script), ...argv], {
      cwd: root,
      stdio: "inherit",
      timeout,
      killSignal: "SIGTERM",
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=1024`.trim(),
        RAYON_NUM_THREADS: "1",
      },
    });
    if (result.error) log(`Local check ${script} could not finish: ${result.error.message}`);
    return result.status ?? 1;
  };
  for (const batch of format.batches) {
    const status = run("node_modules/prettier/bin/prettier.cjs", [
      "--check",
      "--ignore-unknown",
      "--",
      ...batch,
    ]);
    if (status !== 0) return status;
  }
  for (const batch of format.batches) {
    const sourceFiles = batch.filter((file) => /\.[cm]?[jt]sx?$/.test(file));
    {
      const violations = sourceFiles.flatMap((file) => {
        const source = readFileSync(path.join(root, file), "utf8");
        return [
          ...(file.startsWith("src/") ? boundaryViolations(file, source) : []),
          ...sourceViolations(file, source),
        ];
      });
      for (const file of batch.filter((file) => file.endsWith(".css")))
        violations.push(...sourceViolations(file, readFileSync(path.join(root, file), "utf8")));
      if (violations.length) {
        log(violations.join("\n"));
        return 1;
      }
    }
    if (sourceFiles.length) {
      const lint = run("node_modules/oxlint/bin/oxlint", [
        "--type-aware",
        "--deny-warnings",
        "--",
        ...sourceFiles,
      ]);
      if (lint !== 0) return lint;
    }
  }
  if (plan.configs.length) {
    const compiler = "node_modules/typescript/bin/tsc";
    for (const config of plan.configs) {
      log(`Type checking ${config}`);
      const status = run(compiler, ["--noEmit", "-p", config]);
      if (status !== 0) return status;
    }
  }
  if (docs) {
    const status = run("scripts/checks/check-docs.mjs");
    if (status !== 0) return status;
  }
  if (!plan.tests.length && !docsOnly) {
    const status = run("scripts/checks/run-local-tests.mjs");
    if (status !== 0) return status;
  }
  if (plan.tests.length) {
    mkdirSync(path.join(root, "reports"), { recursive: true });
    const status = run(
      "node_modules/vitest/vitest.mjs",
      [
        "run",
        "--maxWorkers=1",
        "--no-file-parallelism",
        "--bail=1",
        "--reporter=default",
        "--reporter=json",
        "--outputFile.json=reports/task-tests.json",
        ...plan.tests,
      ],
      300_000,
    );
    if (status !== 0) return status;
  }
  if (verificationIdentity(root, base, [...new Set([...paths, ...plan.tests])]) !== identity) {
    log("Verification inputs changed during the check; retry before handoff.");
    return 1;
  }
  log(
    "Task checks passed. Local handoff gate complete; full CI and any required rendered review remain separate.",
  );
  return 0;
}

export async function verify(args = process.argv.slice(2), options = {}) {
  if (args[0] === "--diagnostic") {
    const { investigate } = await import("../agent/investigate.mjs");
    return investigate(args.slice(1), options);
  }
  return runCheck(args, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = await verify();

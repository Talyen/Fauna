import path from "node:path";
import { lstatSync, readFileSync, existsSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { boundaryViolations } from "./boundaries.mjs";
import { sourceViolations } from "./ui-contract.mjs";
import { taskBase } from "../lib/task-selection.mjs";
import {
  verificationIdentity,
  verified,
  clearVerification,
  recordVerification,
} from "./verification-record.mjs";
import { affectedTests } from "./affected-tests.mjs";
import { matchingDependencies, dependenciesAvailable } from "../dependencies.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CI_NOTICE = "Task checks. CI owns complete static, unit, build, browser and desktop validation.";

export function parseCheckArgs(args) {
  const paths = [];
  let base = null,
    diff = false,
    plan = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--plan") plan = true;
    else if (arg === "--diff" || arg === "--working-tree") diff = true;
    else if (arg === "--base") {
      if (base || !args[i + 1] || args[i + 1].startsWith("-"))
        throw new Error("--base requires one Git commit or branch.");
      base = args[++i];
    } else if (arg.startsWith("-")) throw new Error(`Unknown local check option: ${arg}`);
    else paths.push(arg);
  }
  if (base && diff) throw new Error("Choose --base or --working-tree, not both.");
  if (paths.length && (base || diff)) throw new Error("Choose explicit paths or a Git diff, not both.");
  return { paths, base: base ?? (diff ? "HEAD" : null), ...(plan ? { plan: true } : {}) };
}

function git(root, args) {
  return execFileSync("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function selectedPaths(root, selection) {
  if (selection.paths.length) {
    const paths = selection.paths.map((input) => {
      const relative = path.relative(root, path.resolve(root, input));
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
        throw new Error(`Check paths must stay inside this repository: ${input}`);
      return relative.split(path.sep).join("/") || ".";
    });
    const selected = git(root, [
      "--literal-pathspecs",
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...paths,
    ]);
    const files = [...new Set(selected.split("\0").filter(Boolean))];
    for (const input of paths)
      if (!files.some((file) => input === "." || file === input || file.startsWith(`${input}/`)))
        throw new Error(`No repository files match: ${input}`);
    return files;
  }
  const base = taskBase(root, selection.base);
  return [
    ...new Set(
      [
        ...git(root, ["diff", "--name-only", "-z", "--diff-filter=ACMRD", base, "--"]).split("\0"),
        ...git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
      ].filter(Boolean),
    ),
  ];
}

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

export function checkPlan(root, paths) {
  const configs = new Set();
  const tests = new Set();
  for (const file of paths) {
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
    const owner = /^(?:src\/(.+)|scripts\/(.+))\.[cm]?[jt]sx?$/.exec(file);
    if (owner)
      for (const extension of ["ts", "tsx", "mjs", "js"])
        tests.add(`tests/unit/${owner[1] ?? `tooling/${path.posix.basename(owner[2])}`}.test.${extension}`);
  }
  const primary = [...tests].filter((file) => existsSync(path.join(root, file)));
  const files = paths.some((file) => /\.(?:[cm]?[jt]sx?|json|css)$/.test(file))
    ? git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
        .split("\0")
        .filter(
          (file) =>
            /\.(?:[cm]?[jt]sx?|json|css)$/.test(file) &&
            lstatSync(path.join(root, file), { throwIfNoEntry: false })?.isFile(),
        )
    : [];
  const affected = affectedTests(root, paths, files);
  const related = affected.tests.filter((file) => !primary.includes(file));
  return {
    configs: [...configs],
    tests: [...primary, ...related.slice(0, 12)],
    deferredTests: related.slice(12),
    unresolved: affected.unresolved,
  };
}

export function runCheck(
  args = [],
  { root = ROOT, runner = spawnSync, log = console.log, cache = runner === spawnSync } = {},
) {
  const selection = parseCheckArgs(args);
  const base = taskBase(root, selection.base);
  const paths = selectedPaths(root, { ...selection, base });
  const format = formatSelection(root, paths);
  const plan = checkPlan(root, paths);
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
      : docsOnly
        ? "Documentation only; no tests needed."
        : "No matching suite; running fixed Node smoke (not affected-behavior coverage).",
  );
  if (plan.deferredTests.length)
    log(`Additional related suites left to CI: ${plan.deferredTests.join(", ")}`);
  if (plan.unresolved.length)
    log(`Import graph could not parse: ${plan.unresolved.join(", ")}. CI retains full coverage.`);
  log(
    "Selection follows static imports and literal import()/require(); computed imports, runtime file reads and external dependencies may need a named regression suite. Builds, full CI and rendered review are separate evidence.",
  );
  if (selection.plan) {
    log("Plan only; no checks ran.");
    return 0;
  }
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
  const identity = cache ? verificationIdentity(root, base, paths) : null;
  if (cache && verified(root, identity)) {
    log(
      "Reused passing task check: source, selection, base, runtime, environment and installed dependency metadata match. Rendered review and full CI remain separate.",
    );
    return 0;
  }
  if (cache) clearVerification(root);
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
  for (const suite of plan.tests) {
    const status = run("node_modules/vitest/vitest.mjs", [
      "run",
      "--maxWorkers=1",
      "--no-file-parallelism",
      suite,
    ]);
    if (status !== 0) return status;
  }
  if (cache) {
    if (verificationIdentity(root, base, paths) !== identity) {
      log("Verification inputs changed during the check; retry before handoff.");
      return 1;
    }
    recordVerification(root, identity);
  }
  log(
    "Task checks passed. Local handoff gate complete; full CI and any required rendered review remain separate.",
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = runCheck(process.argv.slice(2));

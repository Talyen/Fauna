import path from "node:path";
import { lstatSync, readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { boundaryViolations } from "./boundaries.mjs";
import { sourceViolations } from "./ui-contract.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CI_NOTICE =
  "Selected local checks. CI owns complete static, unit, build, browser and desktop validation.";

export function parseCheckArgs(args) {
  const paths = [];
  let base = null,
    diff = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--diff") diff = true;
    else if (arg === "--base") {
      if (base || !args[i + 1] || args[i + 1].startsWith("-"))
        throw new Error("--base requires one Git commit or branch.");
      base = args[++i];
    } else if (arg.startsWith("-")) throw new Error(`Unknown local check option: ${arg}`);
    else paths.push(arg);
  }
  if (paths.length && (base || diff)) throw new Error("Choose explicit paths or a Git diff, not both.");
  return { paths, base: base ?? "HEAD" };
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
  const base = git(root, ["rev-parse", "--verify", "--end-of-options", `${selection.base}^{commit}`]).trim();
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
  const bounded =
    files.length <= 50 &&
    files.every((file) => lstatSync(path.join(root, file)).size <= 256_000) &&
    Buffer.byteLength(JSON.stringify(files)) <= 8000;
  return { files: bounded ? files : [], deferred: !bounded };
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
  return {
    configs: [...configs],
    tests: [...tests].filter((file) => existsSync(path.join(root, file))),
  };
}

export function runCheck(args = [], { root = ROOT, runner = spawnSync, log = console.log } = {}) {
  const paths = selectedPaths(root, parseCheckArgs(args));
  const format = formatSelection(root, paths);
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
  log(CI_NOTICE);
  if (format.deferred)
    log(
      "File-based formatting, lint and contracts deferred to CI: selection exceeds the local file, size or argument budget.",
    );
  else if (format.files.length) {
    const status = run("node_modules/prettier/bin/prettier.cjs", [
      "--check",
      "--ignore-unknown",
      "--",
      ...format.files,
    ]);
    if (status !== 0) return status;
  }
  if (paths.length && paths.every((file) => /\.md$/i.test(file))) {
    return run("scripts/checks/check-docs.mjs");
  }
  const sourceFiles = format.files.filter((file) => /\.[cm]?[jt]sx?$/.test(file));
  {
    const violations = sourceFiles.flatMap((file) => {
      const source = readFileSync(path.join(root, file), "utf8");
      return [
        ...(file.startsWith("src/") ? boundaryViolations(file, source) : []),
        ...sourceViolations(file, source),
      ];
    });
    for (const file of format.files.filter((file) => file.endsWith(".css")))
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
  const plan = checkPlan(root, paths);
  if (plan.configs.length) {
    const compiler = "node_modules/typescript/bin/tsc";
    for (const config of plan.configs) {
      log(`Type checking ${config}`);
      const status = run(compiler, ["--noEmit", "-p", config]);
      if (status !== 0) return status;
    }
  }
  if (paths.some((file) => /\.md$/i.test(file))) {
    const status = run("scripts/checks/check-docs.mjs");
    if (status !== 0) return status;
  }
  if (plan.tests.length > 50 || Buffer.byteLength(JSON.stringify(plan.tests)) > 8000) {
    log("Focused suite selection exceeds the local budget; complete suites deferred to CI.");
    plan.tests = [];
  }
  log(
    plan.tests.length
      ? `Focused suites: ${plan.tests.join(", ")}`
      : "No matching suite; running fixed Node smoke.",
  );
  if (!plan.tests.length) return run("scripts/checks/run-local-tests.mjs");
  for (const suite of plan.tests) {
    const status = run("node_modules/vitest/vitest.mjs", [
      "run",
      "--maxWorkers=1",
      "--no-file-parallelism",
      suite,
    ]);
    if (status !== 0) return status;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = runCheck(process.argv.slice(2));

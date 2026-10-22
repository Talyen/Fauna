import path from "node:path";
import { lstatSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CI_NOTICE = "Local gate only. CI owns full unit, static, build, browser and desktop validation.";

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

export function runCheck(args = [], { root = ROOT, runner = spawnSync, log = console.log } = {}) {
  const paths = selectedPaths(root, parseCheckArgs(args));
  const format = formatSelection(root, paths);
  const run = (script, argv = []) => {
    const result = runner(process.execPath, [path.join(root, script), ...argv], {
      cwd: root,
      stdio: "inherit",
      timeout: 30_000,
      killSignal: "SIGTERM",
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=512`.trim(),
        RAYON_NUM_THREADS: "1",
      },
    });
    if (result.error) log(`Local check could not finish: ${result.error.message}`);
    return result.status ?? 1;
  };
  log(CI_NOTICE);
  if (format.deferred)
    log("Formatting deferred to CI: selection exceeds the local file, size or argument budget.");
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
    log("Documentation-only change: Node smoke skipped.");
    return 0;
  }
  return run("scripts/checks/run-local-tests.mjs");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = runCheck(process.argv.slice(2));

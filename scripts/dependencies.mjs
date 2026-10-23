import { existsSync, lstatSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { worktrees } from "./lib/git.mjs";
import { npmCommand } from "./lib/npm-command.mjs";

export function dependenciesAvailable(root) {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const lockFile = path.join(root, "package-lock.json");
  const locked = existsSync(lockFile) ? (JSON.parse(readFileSync(lockFile, "utf8")).packages ?? {}) : {};
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter((name) => !Object.hasOwn(manifest.optionalDependencies ?? {}, name))
    .every((name) => {
      const installed = path.join(root, "node_modules", name, "package.json");
      return (
        existsSync(installed) &&
        (!locked[`node_modules/${name}`]?.version ||
          JSON.parse(readFileSync(installed, "utf8")).version === locked[`node_modules/${name}`].version)
      );
    });
}

export function ensureDependencies(root, options = {}) {
  if (!existsSync(path.join(root, "package.json"))) return 0;
  const modules = path.join(root, "node_modules");
  const linked = lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink();
  if (linked) return installDependencies(root, { ...options, quiet: true });
  if (dependenciesAvailable(root)) return 0;
  return installDependencies(root, options);
}

export function matchingDependencies(left, right) {
  const identity = (root) => {
    const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const fields = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
      "overrides",
      "allowScripts",
      "engines",
      "packageManager",
      "scripts",
    ];
    // Only lifecycle scripts affect installation; adding a task command does not invalidate a link.
    const lifecycle = [
      "preinstall",
      "install",
      "postinstall",
      "prepare",
      "prepublish",
      "preprepare",
      "postprepare",
    ];
    return JSON.stringify(
      fields.map((field) =>
        field === "scripts"
          ? lifecycle.map((name) => manifest.scripts?.[name] ?? null)
          : (manifest[field] ?? null),
      ),
    );
  };
  try {
    return (
      identity(left) === identity(right) &&
      ["package-lock.json", ".npmrc"].every((file) => {
        const a = path.join(left, file),
          b = path.join(right, file);
        return existsSync(a) === existsSync(b) && (!existsSync(a) || readFileSync(a).equals(readFileSync(b)));
      })
    );
  } catch {
    return false;
  }
}

export function installDependencies(
  root,
  { runner = spawnSync, log = console.log, env = process.env, quiet = false } = {},
) {
  root = realpathSync(root);
  const modules = path.join(root, "node_modules");
  const linked = lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink();
  if (linked) {
    const registered = worktrees(root);
    const main = registered.find((tree) => tree.branch === "refs/heads/main")?.path;
    if (!main || path.resolve(main) === root || !registered.some((tree) => path.resolve(tree.path) === root))
      throw new Error("Cannot safely identify this task's shared dependencies.");
    if (existsSync(modules) && realpathSync(modules) !== realpathSync(path.join(main, "node_modules")))
      throw new Error("Dependency link has an unexpected owner; preserved it.");
    if (existsSync(modules) && matchingDependencies(root, main) && dependenciesAvailable(root)) {
      if (!quiet) log("Shared dependencies match; no installation needed.");
      return 0;
    }
    // Remove the task's link itself, never the linked checkout's dependency directory.
    unlinkSync(modules);
    log("Detached task dependency link; installing in this checkout.");
  }
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const pinned = /^npm@([\d.]+)$/.exec(manifest.packageManager ?? "")?.[1];
  const running = /^npm\/([^\s]+)/.exec(env.npm_config_user_agent ?? "")?.[1];
  const [command, args] = npmCommand(
    pinned && running !== pinned ? ["exec", "--yes", `--package=npm@${pinned}`, "--", "npm", "ci"] : ["ci"],
    env,
  );
  const result = runner(command, args, {
    cwd: root,
    stdio: "inherit",
    env,
    ...(env.CI !== "true" ? { timeout: 300_000, killSignal: "SIGTERM" } : {}),
  });
  if (result.error) log(result.error.message);
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error("Usage: npm run deps");
  process.exitCode = installDependencies(process.cwd());
}

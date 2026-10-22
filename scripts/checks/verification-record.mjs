import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { git } from "../lib/git.mjs";

function recordPath(root) {
  return path.resolve(root, git(root, ["rev-parse", "--git-path", "fauna-task-check.json"]).trim());
}

/** Content identity survives committing unchanged checked files, but includes every repository input. */
export function verificationIdentity(root, base, paths, env = process.env) {
  const digest = createHash("sha256");
  const add = (value) => digest.update(JSON.stringify(value) + "\n");
  const environment = Object.entries(env)
    .filter(
      ([key]) =>
        !/^(?:npm_lifecycle_(?:event|script)$|npm_command$|npm_config_local_prefix$|PWD$|OLDPWD$|INIT_CWD$|SHLVL$|_$)/.test(
          key,
        ),
    )
    .sort(([a], [b]) => a.localeCompare(b));
  add([
    1,
    realpathSync(root),
    base,
    [...paths].sort(),
    process.execPath,
    process.version,
    process.platform,
    process.arch,
    environment,
  ]);
  const files = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  for (const file of [...new Set(files.split("\0").filter(Boolean))].sort()) {
    const absolute = path.join(root, file);
    const stat = lstatSync(absolute, { throwIfNoEntry: false });
    add([file, stat?.mode ?? null, stat?.size ?? null]);
    if (stat?.isSymbolicLink()) add(readlinkSync(absolute));
    else if (stat?.isFile()) digest.update(readFileSync(absolute));
  }
  // Installed-file metadata detects reinstalls and edits, including shared installs.
  // Tool-generated caches are outputs, not verification inputs.
  function installed(directory) {
    for (const name of readdirSync(directory).sort()) {
      if ([".vite", ".vite-temp", ".vitest-cache", ".cache"].includes(name)) continue;
      const file = path.join(directory, name);
      const stat = lstatSync(file);
      add([file, stat.mode, stat.size, stat.mtimeMs, stat.ctimeMs]);
      if (stat.isDirectory()) installed(file);
      else if (stat.isSymbolicLink()) add(readlinkSync(file));
    }
  }
  const modules = path.join(root, "node_modules");
  if (lstatSync(modules, { throwIfNoEntry: false })) installed(realpathSync(modules));
  return digest.digest("hex");
}

export function verified(root, identity) {
  try {
    return JSON.parse(readFileSync(recordPath(root), "utf8")).identity === identity;
  } catch {
    return false;
  }
}

export function clearVerification(root) {
  rmSync(recordPath(root), { force: true });
}

export function recordVerification(root, identity) {
  const target = recordPath(root);
  const temporary = `${target}.${randomUUID()}`;
  try {
    writeFileSync(temporary, JSON.stringify({ identity }));
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

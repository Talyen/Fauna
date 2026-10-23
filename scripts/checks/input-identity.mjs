import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";
import { git } from "../lib/git.mjs";

/** Detect changing inputs during a run; this identity never skips verification. */
export function verificationIdentity(root, base, paths, env = process.env, purpose = "check") {
  const digest = createHash("sha256");
  const add = (value) => digest.update(JSON.stringify(value) + "\n");
  const environment = Object.entries(env)
    .filter(([key]) =>
      /^(?:PATH|HOME|USERPROFILE|TMPDIR|TMP|TEMP|LANG|LC_.*|TZ|CI|DISPLAY|WAYLAND_DISPLAY|NODE_.*|VITEST.*|FAUNA_.*|PLAYWRIGHT_.*|npm_config_(?:ignore_scripts|omit|include|legacy_peer_deps))$/.test(
        key,
      ),
    )
    .sort(([a], [b]) => a.localeCompare(b));
  add([
    3,
    purpose,
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
  const selected = new Set(paths);
  const docs = paths.some((file) => /\.md$/i.test(file));
  const relevant = (file) =>
    selected.has(file) ||
    (purpose === "capture"
      ? /^(?:src\/|public\/|tests\/(?:support|e2e\/support)\/|scripts\/|(?:package(?:-lock)?|tsconfig[^/]*)\.json$|vite\.config\.ts$)/.test(
          file,
        )
      : !/\.md$/i.test(file) || docs || /^(?:Docs\/|AGENTS\.md$|README\.md$|CONTRIBUTING\.md$)/.test(file));
  for (const file of [...new Set(files.split("\0").filter(Boolean))].filter(relevant).sort()) {
    const absolute = path.join(root, file);
    const stat = lstatSync(absolute, { throwIfNoEntry: false });
    add([file, stat?.mode ?? null, stat?.size ?? null]);
    if (stat?.isSymbolicLink()) add(readlinkSync(absolute));
    else if (stat?.isFile()) digest.update(readFileSync(absolute));
  }
  return digest.digest("hex");
}

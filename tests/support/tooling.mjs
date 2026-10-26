import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";

export const readFixture = (root, file) => readFileSync(path.join(root, file), "utf8");
export const writeFixture = (root, file, value) => writeFileSync(path.join(root, file), value);
export function put(root, file, value) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFixture(root, file, value);
}

export function temporaryDirectory(prefix, parent = tmpdir()) {
  const root = realpathSync(mkdtempSync(path.join(parent, prefix)));
  // Register ownership before any later fixture setup can fail.
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

export function git(root, ...args) {
  return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
}

export function repository(files, prefix = "fauna-tooling-") {
  const root = temporaryDirectory(prefix);
  git(root, "init", "-qb", "main");
  git(root, "config", "user.name", "Tooling fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "core.hooksPath", path.join(root, "no-hooks"));
  for (const [file, contents] of Object.entries(files)) put(root, file, contents);
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  return root;
}

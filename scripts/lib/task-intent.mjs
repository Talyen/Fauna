import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { git } from "./git.mjs";

const directories = new Map();
const intentPath = (root) => {
  if (!directories.has(root))
    directories.set(
      root,
      path.resolve(root, git(root, ["rev-parse", "--git-path", "fauna-task.json"]).trim()),
    );
  return directories.get(root);
};

// Worktree-local intent survives commits and branch renames; it never stores passing results.
export function taskIntent(root) {
  const file = intentPath(root);
  if (!existsSync(file)) return { tests: [] };
  const intent = JSON.parse(readFileSync(file, "utf8"));
  if (
    intent.version !== 1 ||
    typeof intent.base !== "string" ||
    !Array.isArray(intent.tests) ||
    intent.tests.some((suite) => typeof suite !== "string")
  )
    throw new Error(`Invalid task intent: ${file}`);
  return intent;
}

export function recordTaskIntent(root, { base, tests = [], forget = [] } = {}) {
  const current = taskIntent(root);
  const intent = {
    version: 1,
    base: base ?? current.base ?? git(root, ["merge-base", "HEAD", "main"]).trim(),
    tests: [...new Set([...current.tests, ...tests])].filter((suite) => !forget.includes(suite)).sort(),
  };
  const file = intentPath(root);
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(intent, null, 2) + "\n");
  renameSync(temporary, file);
  return intent;
}

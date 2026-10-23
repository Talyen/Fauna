import { git } from "./git.mjs";
import path from "node:path";

/** Task commands include committed work; main and ad-hoc branches keep HEAD selection. */
export function taskBase(root, base) {
  if (base) return git(root, ["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`]).trim();
  const branch = git(root, ["branch", "--show-current"]).trim();
  return /^(?:task|codex)\//.test(branch)
    ? git(root, ["merge-base", "HEAD", "refs/heads/main"]).trim()
    : git(root, ["rev-parse", "HEAD"]).trim();
}

export function selectPaths(root, inputs) {
  return inputs.map((input) => {
    const relative = path.relative(root, path.resolve(root, input)).split(path.sep).join("/");
    if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative))
      throw new Error(`Path outside repository: ${input}`);
    return relative || ".";
  });
}

/** One file selection for verification, context and other task consumers. */
export function taskPaths(root, { paths = [], base } = {}) {
  const selected = paths.length
    ? git(root, [
        "--literal-pathspecs",
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        ...selectPaths(root, paths),
      ])
    : git(root, ["diff", "--name-only", "-z", "--diff-filter=ACMRD", taskBase(root, base), "--"]) +
      git(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const files = [...new Set(selected.split("\0").filter(Boolean))];
  for (const input of selectPaths(root, paths))
    if (!files.some((file) => input === "." || file === input || file.startsWith(`${input}/`)))
      throw new Error(`No repository files match: ${input}`);
  return files;
}

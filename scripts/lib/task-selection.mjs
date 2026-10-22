import { git } from "./git.mjs";

/** Task commands include committed work; main and ad-hoc branches keep HEAD selection. */
export function taskBase(root, base) {
  if (base) return git(root, ["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`]).trim();
  const branch = git(root, ["branch", "--show-current"]).trim();
  return /^(?:task|codex)\//.test(branch)
    ? git(root, ["merge-base", "HEAD", "refs/heads/main"]).trim()
    : git(root, ["rev-parse", "HEAD"]).trim();
}

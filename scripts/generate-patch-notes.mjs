import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git } from "./lib/git.mjs";
import { releaseVersion } from "./lib/release-identity.mjs";
const ROOT = path.resolve(import.meta.dirname, "..");
const TYPES = { feat: "New", balance: "Balance", fix: "Fixes", perf: "Performance" };
const PLAYER_PATH =
  /^(src\/(?:game|ui|platform)\/|src\/application\/(?:session|cloud)\.ts$|public\/|assets\/|desktop\/(?!after-pack))/;
export function playerNote(body, files) {
  const lines = body.trim().split(/\r?\n/);
  const visibility = lines.filter((line) => /^User-Facing:\s*(yes|no)\s*$/i.test(line)).at(-1);
  if (visibility && /no\s*$/i.test(visibility)) return null;
  const explicit = lines
    .find((line) => /^Player-Note:\s*\S/i.test(line))
    ?.replace(/^Player-Note:\s*/i, "")
    .trim();
  const subject = lines[0]?.match(/^(feat|fix|balance|perf)(?:\([^\r\n)]+\))?!?:\s+(.+)$/);
  if (!explicit && !visibility && (!subject || !files.some((file) => PLAYER_PATH.test(file)))) return null;
  const text = explicit ?? subject?.[2] ?? lines[0].replace(/^[a-z]+(?:\([^)]*\))?!?:\s*/, "");
  return { section: subject ? TYPES[subject[1]] : "Changes", text: text[0].toUpperCase() + text.slice(1) };
}
export function notesArgs(args) {
  const result = { tag: undefined, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run" && !result.dryRun) result.dryRun = true;
    else if (args[i] === "--tag" && !result.tag && args[i + 1] && !args[i + 1].startsWith("-"))
      result.tag = args[++i];
    else throw new Error(`Invalid patch-note option: ${args[i]}`);
  }
  if (result.tag && !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(result.tag))
    throw new Error("Invalid release tag.");
  return result;
}
export function generatePatchNotes(root, { tag } = {}) {
  if (tag) releaseVersion(root, tag);
  const target = tag ? `refs/tags/${tag}` : "HEAD";
  const head = git(root, ["rev-parse", "--verify", `${target}^{commit}`]).trim();
  const tags = git(root, ["tag", "--merged", head, "--list", "v[0-9]*"])
    .split("\n")
    .filter((value) => /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value));
  // Measure ancestry distance; tag date and unrelated newer tags cannot change the range.
  const candidates = tags
    .filter((value) => !tag || git(root, ["rev-parse", `${value}^{commit}`]).trim() !== head)
    .map((value) => ({
      tag: value,
      distance: Number(git(root, ["rev-list", "--count", `${value}..${head}`])),
    }))
    .sort((a, b) => a.distance - b.distance || a.tag.localeCompare(b.tag));
  const base = candidates[0]?.tag;
  const commits = git(root, ["rev-list", "--reverse", "--no-merges", base ? `${base}..${head}` : head])
    .trim()
    .split("\n")
    .filter(Boolean);
  const groups = new Map();
  for (const commit of commits) {
    const body = git(root, ["show", "-s", "--format=%B", commit]);
    const files = git(root, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "-z", commit])
      .split("\0")
      .filter(Boolean);
    const note = playerNote(body, files);
    if (!note) continue;
    if (!groups.has(note.section)) groups.set(note.section, new Set());
    groups.get(note.section).add(note.text);
  }
  const sections = ["New", "Balance", "Fixes", "Performance", "Changes"].filter((name) => groups.has(name));
  const markdown =
    `# ${tag ? `Fauna ${tag}` : "Fauna — Unreleased"}\n\n` +
    (sections.length
      ? sections
          .map((name) => `## ${name}\n\n${[...groups.get(name)].map((text) => `- ${text}`).join("\n")}\n`)
          .join("\n")
      : "No player-facing changes.\n");
  return { markdown, head, base: base ?? null, commits: commits.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = notesArgs(process.argv.slice(2));
  const result = generatePatchNotes(ROOT, options);
  if (options.dryRun) process.stdout.write(result.markdown);
  else {
    const directory = path.join(ROOT, "reports/release-notes");
    await mkdir(directory, { recursive: true });
    const output = path.join(directory, `${options.tag ?? "UNRELEASED"}.md`);
    await writeFile(output, result.markdown);
    console.log(
      `Patch-note draft: ${output}; ${result.base ?? "initial commit"} → ${result.head}. Review wording before publication.`,
    );
  }
}

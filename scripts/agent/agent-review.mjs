import { execFileSync } from "node:child_process";
import { isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, lstatSync, readlinkSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../..");
export function reviewGit(root, args) {
  return execFileSync("git", ["--no-optional-locks", "--literal-pathspecs", "--no-pager", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}
export function selectPaths(root, inputs) {
  return inputs.map((input) => {
    const relative = path.relative(root, path.resolve(root, input)).split(path.sep).join("/");
    if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative))
      throw new Error(`Path outside repository: ${input}`);
    return relative || ".";
  });
}
export function inventory(root) {
  const fields = reviewGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).split("\0");
  const entries = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field) continue;
    const status = field.slice(0, 2),
      file = field.slice(3);
    const from = /[RC]/.test(status) ? fields[++i] : undefined;
    entries.push({ status, file, ...(from ? { from } : {}) });
  }
  return entries;
}
export function review(root, inputs = [], { status = false, summary = false, budget = 12000 } = {}) {
  const paths = selectPaths(root, inputs);
  const all = inventory(root);
  const selected = all.filter(
    (entry) =>
      !paths.length ||
      [entry.file, entry.from]
        .filter(Boolean)
        .some((file) => paths.some((p) => p === "." || file === p || file.startsWith(`${p}/`))),
  );
  if (status) {
    const directory = path.join(root, "reports", "agent-diff", randomUUID());
    mkdirSync(directory, { recursive: true });
    const indexPath = path.join(directory, "index.json");
    writeFileSync(indexPath, JSON.stringify({ inventory: all, selected }, null, 2));
    const rendered = JSON.stringify(selected, null, 2);
    return {
      inventory: all,
      selected,
      indexPath,
      patches: null,
      preview: rendered.slice(0, budget),
      omittedCharacters: Math.max(0, rendered.length - budget),
      completePatchReview: false,
    };
  }
  const patches = selected.map((entry) => {
    if (entry.status === "??") {
      const file = path.join(root, entry.file);
      if (lstatSync(file).isSymbolicLink())
        return { ...entry, patch: `New symlink: ${JSON.stringify(readlinkSync(file))}` };
      const bytes = readFileSync(file);
      return {
        ...entry,
        patch:
          bytes.includes(0) || !isUtf8(bytes)
            ? `Binary file: ${bytes.length} bytes; sha256=${createHash("sha256").update(bytes).digest("hex")}`
            : bytes.toString("utf8"),
      };
    }
    const names = [entry.file, entry.from].filter(Boolean);
    return {
      ...entry,
      patch: [
        reviewGit(root, ["diff", "--cached", "--binary", "--", ...names]),
        reviewGit(root, ["diff", "--binary", "--", ...names]),
      ].join("\n"),
    };
  });
  const directory = path.join(root, "reports", "agent-diff", randomUUID());
  mkdirSync(directory, { recursive: true });
  let line = 1;
  const sections = patches.map((entry) => {
    const body = `${entry.status} ${JSON.stringify(entry.file)}${entry.from ? ` <- ${JSON.stringify(entry.from)}` : ""}\n${entry.patch}\n`;
    const start = line;
    line += body.split("\n").length;
    return {
      body,
      index: { status: entry.status, file: entry.file, from: entry.from, start, end: line - 1 },
    };
  });
  const index = {
    inventory: all,
    selected: sections.map((s) => s.index),
    patches: path.join(directory, "patches.txt"),
  };
  writeFileSync(index.patches, sections.map((s) => s.body).join("\n"));
  const indexPath = path.join(directory, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  const detail = status ? selected : summary ? index.selected : patches;
  const rendered = JSON.stringify(detail, null, 2);
  return {
    ...index,
    indexPath,
    preview: rendered.slice(0, budget),
    omittedCharacters: Math.max(0, rendered.length - budget),
    completePatchReview: false,
  };
}
export function main(args = process.argv.slice(2)) {
  const flags = new Set(args.filter((arg) => ["--status", "--summary", "--json"].includes(arg)));
  const paths = args.filter((arg) => !flags.has(arg) && arg !== "--");
  if (paths.some((arg) => arg.startsWith("--")))
    throw new Error("Usage: review:diff -- [--status|--summary] [--json] [paths]");
  const result = review(ROOT, paths, { status: flags.has("--status"), summary: flags.has("--summary") });
  if (flags.has("--json"))
    console.log(JSON.stringify({ ...result, inventory: undefined, selected: undefined }));
  else
    console.log(
      `${result.preview}\nOmitted characters: ${result.omittedCharacters}. Full inventory and patch ranges: ${result.indexPath}\nFull patches: ${result.patches ?? "not collected in status mode"}\nRead omitted patches before claiming a complete review.`,
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

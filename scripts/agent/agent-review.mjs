import { execFileSync } from "node:child_process";
import { isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, lstatSync, readlinkSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { taskBase, selectPaths } from "../lib/task-selection.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
export function reviewGit(root, args) {
  return execFileSync("git", ["--no-optional-locks", "--literal-pathspecs", "--no-pager", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}
export { selectPaths } from "../lib/task-selection.mjs";
export function inventory(root, base = "HEAD") {
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
  const committed = reviewGit(root, [
    "diff",
    "--name-status",
    "-z",
    "--find-renames",
    base,
    "HEAD",
    "--",
  ]).split("\0");
  for (let i = 0; i < committed.length && committed[i];) {
    const status = committed[i++];
    const from = committed[i++];
    const file = /^[RC]/.test(status) ? committed[i++] : from;
    const names = [file, ...(/^[RC]/.test(status) ? [from] : [])];
    const existing = entries.find((entry) =>
      names.some((name) => entry.file === name || entry.from === name),
    );
    if (existing)
      existing.names = [
        ...new Set([...(existing.names ?? []), existing.file, existing.from, ...names].filter(Boolean)),
      ];
    else entries.push({ status, file, ...(/^[RC]/.test(status) ? { from } : {}) });
  }
  return entries;
}

function netInventory(root, base) {
  const fields = reviewGit(root, ["diff", "--name-status", "-z", "--find-renames", base, "--"]).split("\0");
  const entries = [];
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++];
    const from = fields[i++];
    const renamed = /^[RC]/.test(status);
    entries.push({ status, file: renamed ? fields[i++] : from, ...(renamed ? { from } : {}) });
  }
  for (const file of reviewGit(root, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean))
    entries.push({ status: "??", file });
  return entries;
}
export function review(
  root,
  inputs = [],
  { status = false, summary = false, layers = false, budget = 48000, base: requestedBase } = {},
) {
  const paths = selectPaths(root, inputs);
  const base = taskBase(root, requestedBase);
  const all = layers ? inventory(root, base) : netInventory(root, base);
  if (!layers && paths.length) {
    const history = inventory(root, base);
    for (const entry of all) {
      const related = history.filter((item) =>
        [item.file, item.from, ...(item.names ?? [])]
          .filter(Boolean)
          .some((name) => name === entry.file || name === entry.from),
      );
      entry.names = [
        ...new Set(related.flatMap((item) => [item.file, item.from, ...(item.names ?? [])]).filter(Boolean)),
      ];
    }
  }
  const selected = all.filter(
    (entry) =>
      !paths.length ||
      [entry.file, entry.from, ...(entry.names ?? [])]
        .filter(Boolean)
        .some((file) => paths.some((p) => p === "." || file === p || file.startsWith(`${p}/`))),
  );
  if (status) {
    const directory = path.join(root, "reports", "agent-diff", randomUUID());
    mkdirSync(directory, { recursive: true });
    const indexPath = path.join(directory, "index.json");
    writeFileSync(indexPath, JSON.stringify({ base, inventory: all, selected }, null, 2));
    const rendered = selected.map((entry) => `${entry.status} ${JSON.stringify(entry.file)}`).join("\n");
    return {
      base,
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
    const names = layers
      ? (entry.names ?? [entry.file, entry.from].filter(Boolean))
      : [entry.file, entry.from].filter(Boolean);
    const committed = layers ? reviewGit(root, ["diff", "--binary", base, "HEAD", "--", ...names]) : "";
    if (entry.status === "??") {
      const file = path.join(root, entry.file);
      if (lstatSync(file).isSymbolicLink())
        return { ...entry, patch: `${committed}\nNew symlink: ${JSON.stringify(readlinkSync(file))}` };
      const bytes = readFileSync(file);
      return {
        ...entry,
        patch:
          committed +
          "\n" +
          (bytes.includes(0) || !isUtf8(bytes)
            ? `Binary file: ${bytes.length} bytes; sha256=${createHash("sha256").update(bytes).digest("hex")}`
            : bytes.toString("utf8")),
      };
    }
    return {
      ...entry,
      patch: (layers
        ? [
            committed,
            reviewGit(root, ["diff", "--cached", "--binary", "--", ...names]),
            reviewGit(root, ["diff", "--binary", "--", ...names]),
          ]
        : [reviewGit(root, ["diff", "--binary", "--find-renames", base, "--", ...names])]
      ).join("\n"),
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
    base,
    inventory: all,
    selected: sections.map((s) => s.index),
    patches: path.join(directory, "patches.txt"),
  };
  writeFileSync(index.patches, sections.map((s) => s.body).join("\n"));
  const indexPath = path.join(directory, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  const rendered = summary
    ? index.selected
        .map(
          (entry) =>
            `${entry.status} ${JSON.stringify(entry.file)} (patch lines ${entry.start}–${entry.end})`,
        )
        .join("\n")
    : sections.map((section) => section.body).join("\n");
  return {
    ...index,
    indexPath,
    preview: rendered.slice(0, budget),
    omittedCharacters: Math.max(0, rendered.length - budget),
    completePatchReview: false,
  };
}
export function main(args = process.argv.slice(2)) {
  let base;
  const remaining = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base") {
      if (base || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error("--base requires one ref.");
      base = args[++i];
    } else remaining.push(args[i]);
  }
  const flags = new Set(
    remaining.filter((arg) =>
      ["--status", "--summary", "--json", "--working-tree", "--diff", "--layers"].includes(arg),
    ),
  );
  if ((flags.has("--working-tree") || flags.has("--diff")) && base)
    throw new Error("Choose --base or --working-tree.");
  if (flags.has("--working-tree") || flags.has("--diff")) base = "HEAD";
  const paths = remaining.filter((arg) => !flags.has(arg) && arg !== "--");
  if (paths.some((arg) => arg.startsWith("--")))
    throw new Error(
      "Usage: review:diff -- [--status|--summary] [--json] [--layers] [--base ref|--working-tree] [paths]",
    );
  const result = review(ROOT, paths, {
    status: flags.has("--status"),
    summary: flags.has("--summary"),
    layers: flags.has("--layers"),
    base,
  });
  if (flags.has("--json"))
    console.log(JSON.stringify({ ...result, inventory: undefined, selected: undefined }));
  else
    console.log(
      `Selection base: ${result.base}; ${flags.has("--layers") ? "committed/staged/unstaged layers" : "net task change"}\n${!result.selected.length ? "EMPTY REVIEW: no net changed files selected. No patch was reviewed.\n" : ""}${result.preview}\n${result.omittedCharacters ? `Omitted ${result.omittedCharacters} characters; read the remaining patches before completing review.\n` : ""}Full inventory and patch ranges: ${result.indexPath}\nFull patches: ${result.patches ?? "not collected in status mode"}`,
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

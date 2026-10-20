import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git } from "./lib/git.mjs";
import { extractMarkdownLinkTargets, headingSlugs, stripFencedBlocks } from "./lib/markdown.mjs";

export function checkDocumentation(root) {
  const files = [
    ...new Set(
      git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean),
    ),
  ];
  const available = files.filter((file) =>
    lstatSync(path.join(root, file), { throwIfNoEntry: false })?.isFile(),
  );
  const docs = new Map(
    available
      .filter((file) => /\.md$/i.test(file))
      .map((file) => [file, readFileSync(path.join(root, file), "utf8")]),
  );
  const scripts = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts ?? {};
  const failures = [];
  const edges = new Map();
  const fail = (file, message) => failures.push(`${file}: ${message}`);
  for (const [file, source] of docs) {
    const prose = stripFencedBlocks(source);
    const links = extractMarkdownLinkTargets(prose);
    const targets = new Set();
    edges.set(file, targets);
    for (const { target } of links) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
      let decoded;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        fail(file, `invalid encoded link ${target}`);
        continue;
      }
      const [relative, anchor] = decoded.split("#");
      const absolute = relative ? path.resolve(root, path.dirname(file), relative) : path.join(root, file);
      const local = path.relative(root, absolute).split(path.sep).join("/");
      if (local === ".." || local.startsWith("../")) {
        fail(file, `link escapes repository: ${target}`);
        continue;
      }
      if (!existsSync(absolute)) {
        fail(file, `missing link ${target}`);
        continue;
      }
      if (docs.has(local)) {
        targets.add(local);
        if (anchor && !headingSlugs(docs.get(local)).has(anchor)) fail(file, `missing heading ${target}`);
      }
    }
    for (const match of prose.matchAll(/`([^`\n]+)`/g)) {
      const reference = match[1].trim();
      if (/[*?{}$<>\s]/.test(reference)) continue;
      const candidate = reference.replace(/[:#]\d.*$/, "").split("#")[0];
      const isRoot = /^(?:src|tests|scripts|Docs|desktop|public|\.github)\//.test(candidate);
      const isRelative = /^\.\.?\//.test(candidate);
      if (!isRoot && !isRelative) continue;
      // Ignore command fragments and generated artifacts rather than inventing missing files.
      if (/^(?:reports|release|dist|test-results)\//.test(candidate)) continue;
      const resolved = path.resolve(root, isRelative ? path.dirname(file) : ".", candidate);
      if (!existsSync(resolved)) fail(file, `missing file reference ${reference}`);
    }
    // Commands in fenced examples are contracts too; prose-only link/path checking avoids sample paths.
    for (const match of source.matchAll(/\bnpm\s+(?:--silent\s+)?run\s+([a-z][a-z0-9:-]*)/g)) {
      if (!Object.hasOwn(scripts, match[1])) fail(file, `unknown npm script ${match[1]}`);
    }
  }
  const reachable = new Set(["README.md", "AGENTS.md"]);
  const queue = [...reachable];
  while (queue.length)
    for (const target of edges.get(queue.pop()) ?? []) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  for (const file of docs.keys())
    if (!reachable.has(file)) fail(file, "document is unreachable from README.md or AGENTS.md");
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error("Usage: npm run docs:check");
  const failures = checkDocumentation(path.resolve(import.meta.dirname, ".."));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else console.log("Documentation links, anchors, file references, npm commands and reachability passed.");
}

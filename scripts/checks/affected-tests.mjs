import { parseSync } from "@swc/core";
import { readFileSync } from "node:fs";
import path from "node:path";

const suite = /^tests\/(?:unit|integration|exhaustive)\/.*\.test\.(?:[cm]?[jt]sx?)$/;
const code = /\.[cm]?[jt]sx?$/;

/** Static imports, re-exports and literal import()/require() calls, including type imports. */
function imports(file, source) {
  const found = new Set();
  const ast = parseSync(source, {
    syntax: "typescript",
    tsx: /\.[jt]sx$/.test(file),
    target: "es2022",
  });
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (["ImportDeclaration", "ExportAllDeclaration", "ExportNamedDeclaration"].includes(node.type)) {
      if (node.source) found.add(node.source.value);
    }
    if (
      node.type === "CallExpression" &&
      (node.callee?.type === "Import" || node.callee?.value === "require") &&
      node.arguments[0]?.expression?.type === "StringLiteral"
    )
      found.add(node.arguments[0].expression.value);
    for (const [key, child] of Object.entries(node)) {
      if (key === "span") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  }
  visit(ast);
  return found;
}

/** Follow the reverse import graph so differently named and cross-layer suites are included. */
export function affectedTests(root, changed, files) {
  const known = new Set([...files, ...changed]);
  const consumers = new Map();
  const unresolved = [];
  for (const file of files.filter((file) => code.test(file))) {
    let specifiers;
    try {
      specifiers = imports(file, readFileSync(path.join(root, file), "utf8"));
    } catch {
      unresolved.push(file);
      continue;
    }
    for (const specifier of specifiers) {
      const clean = specifier.split("?")[0];
      const target = clean.startsWith("@/")
        ? `src/${clean.slice(2)}`
        : clean.startsWith(".")
          ? path.posix.normalize(path.posix.join(path.posix.dirname(file), clean))
          : null;
      if (!target) continue;
      const stem = target.replace(/\.[cm]?jsx?$/, "");
      const resolved = [
        target,
        ...[".ts", ".tsx", ".mjs", ".js", ".cjs", ".json", "/index.ts", "/index.tsx", "/index.js"].map(
          (extension) => `${stem}${extension}`,
        ),
      ].find((candidate) => known.has(candidate));
      if (!resolved) continue;
      if (!consumers.has(resolved)) consumers.set(resolved, new Set());
      consumers.get(resolved).add(file);
    }
  }
  const visited = new Set(changed);
  const distance = new Map(changed.map((file) => [file, 0]));
  const queue = [...changed];
  for (let i = 0; i < queue.length; i++)
    for (const consumer of consumers.get(queue[i]) ?? [])
      if (!visited.has(consumer)) {
        visited.add(consumer);
        distance.set(consumer, distance.get(queue[i]) + 1);
        queue.push(consumer);
      }
  return {
    tests: files
      .filter((file) => suite.test(file) && visited.has(file))
      .sort((a, b) => distance.get(a) - distance.get(b) || a.localeCompare(b)),
    unresolved,
  };
}

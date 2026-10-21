import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { reviewGit, selectPaths } from "./agent-review.mjs";
const ROOT = path.resolve(import.meta.dirname, "..");
export const topics = {
  architecture: {
    patterns: ["src/application/", "src/platform/", "src/game/save", "src/game/types"],
    docs: ["Docs/ARCHITECTURE.md"],
    entries: ["src/application/session.ts", "src/platform/ports.ts", "src/game/save.ts"],
  },
  combat: {
    patterns: [
      "src/game/engine",
      "src/game/combat",
      "src/game/rules",
      "src/game/preview",
      "src/game/keywords",
      "src/application/battle-policy",
      "src/ui/battle",
      "src/ui/autoplay",
    ],
    docs: ["Docs/ARCHITECTURE.md", "Docs/KEYWORDS.md"],
    entries: ["src/game/engine.ts", "src/game/combat.ts", "src/application/battle-policy.ts"],
  },
  progression: {
    patterns: [
      "src/game/progression",
      "src/game/encounters",
      "src/ui/expedition",
      "src/ui/journey",
      "src/ui/unlock",
    ],
    docs: ["Docs/EXPEDITION_DESIGN.md"],
    entries: ["src/game/progression.ts", "src/game/encounters.ts"],
  },
  ui: {
    patterns: ["src/ui/", "src/components/", "design/"],
    docs: ["Docs/UI.md", "Docs/MENU_DESIGN.md"],
    entries: ["src/ui/App.tsx", "src/ui/tokens.css"],
  },
  content: {
    patterns: ["src/game/content", "src/assets/", "public/", "assets/"],
    docs: ["Docs/CONTENT.md"],
    entries: ["src/game/content.ts", "src/game/content-validation.ts"],
  },
  tooling: {
    patterns: [
      "scripts/",
      "tests/",
      ".github/",
      "performance/",
      "package-lock",
      "vite.config",
      "vitest",
      "playwright.config",
    ],
    docs: ["CONTRIBUTING.md", "Docs/DEVELOPMENT_TOOLS.md", "scripts/README.md"],
    entries: ["scripts/check.mjs"],
  },
  release: {
    patterns: ["desktop/", "scripts/verify-package", "package.json"],
    docs: ["Docs/RELEASE.md"],
    entries: ["desktop/main.cjs", "scripts/verify-package.mjs"],
  },
};
export function sections(root, file) {
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  let fence = null;
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i])?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (!fence) {
      const match = /^(#{1,6})\s+(.+)/.exec(lines[i]);
      if (match) headings.push({ path: file, heading: match[2], start: i + 1, level: match[1].length });
    }
  }
  return headings.map((entry, i) => ({
    ...entry,
    end: headings.slice(i + 1).find((h) => h.level <= entry.level)?.start - 1 || lines.length,
  }));
}
export function context(root, paths = [], requested = []) {
  for (const topic of requested)
    if (!Object.hasOwn(topics, topic)) throw new Error(`Unknown topic: ${topic}`);
  const selected = new Set(requested);
  for (const file of selectPaths(root, paths)) {
    const matches = Object.keys(topics).filter((topic) =>
      topics[topic].patterns.some((prefix) => file.startsWith(prefix)),
    );
    for (const topic of matches.length ? matches : ["architecture"]) selected.add(topic);
  }
  if (!selected.size) selected.add("architecture");
  const docs = [...new Set([...selected].flatMap((topic) => topics[topic].docs))];
  return {
    topics: [...selected],
    sections: docs.flatMap((file) => sections(root, file)),
    entries: [...new Set([...selected].flatMap((topic) => topics[topic].entries))],
  };
}
export function main(args = process.argv.slice(2)) {
  const requested = [],
    paths = [];
  let json = false,
    diff = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--task") requested.push(args[++i]);
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--diff") diff = true;
    else if (args[i] !== "--") {
      if (args[i].startsWith("--")) throw new Error(`Unknown option: ${args[i]}`);
      paths.push(args[i]);
    }
  }
  if (!args.length) {
    console.log(
      `Topics: ${Object.keys(topics).join(", ")}\nUsage: context -- [paths|--diff] [--task topic] [--json]`,
    );
    return;
  }
  if (diff && paths.length) throw new Error("Choose paths or --diff.");
  if (diff)
    paths.push(
      ...reviewGit(ROOT, ["diff", "--name-only", "-z", "HEAD"]).split("\0").filter(Boolean),
      ...reviewGit(ROOT, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean),
    );
  const result = context(ROOT, paths, requested);
  const directory = path.join(ROOT, "reports", "agent-context");
  mkdirSync(directory, { recursive: true });
  const reportPath = path.join(directory, `${randomUUID()}.json`);
  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  const preview = { topics: result.topics, sections: [], entries: [], omitted: 0, reportPath };
  for (const section of result.sections) {
    if (JSON.stringify(preview).length + JSON.stringify(section).length < 10_000)
      preview.sections.push(section);
    else preview.omitted++;
  }
  for (const entry of result.entries) {
    if (JSON.stringify(preview).length + entry.length < 10_000) preview.entries.push(entry);
    else preview.omitted++;
  }
  console.log(
    json
      ? JSON.stringify(preview)
      : [
          ...preview.sections.map(
            (section) => `${section.path}:${section.start}-${section.end} ${section.heading}`,
          ),
          ...preview.entries.map((entry) => `Entry: ${entry}`),
          `Omitted pointers: ${preview.omitted}. Complete selection: ${reportPath}`,
        ].join("\n"),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { selectPaths, taskPaths } from "../lib/task-selection.mjs";
const ROOT = path.resolve(import.meta.dirname, "../..");
export const topics = {
  architecture: {
    patterns: ["src/application/", "src/platform/", "src/game/save", "src/game/types"],
    docs: ["Docs/ARCHITECTURE.md"],
    entries: ["src/application/session.ts", "src/platform/ports.ts", "src/game/save.ts"],
  },
  combat: {
    patterns: [
      "src/game/engine",
      "src/game/journey",
      "src/game/team",
      "src/game/combat",
      "src/game/card-zones",
      "src/game/random",
      "src/game/ability-rules",
      "src/game/preview",
      "src/game/keywords",
      "src/application/battle-policy",
      "src/ui/battle",
    ],
    docs: ["Docs/ARCHITECTURE.md", "Docs/KEYWORDS.md"],
    entries: [
      "src/game/engine.ts",
      "src/game/combat/abilities.ts",
      "src/game/combat/index.ts",
      "src/application/battle-policy.ts",
    ],
  },
  progression: {
    patterns: [
      "src/game/progression",
      "src/game/journey",
      "src/game/team",
      "src/game/content/talents",
      "src/game/content/boons",
      "src/game/encounters",
      "src/game/destinations",
      "src/ui/expedition/",
      "src/ui/collection/",
      "src/ui/talents/",
    ],
    docs: ["Docs/EXPEDITION_DESIGN.md"],
    entries: ["src/game/progression.ts", "src/game/encounters.ts", "src/game/destinations.ts"],
  },
  ui: {
    patterns: ["src/ui/", "src/components/", "src/lib/", "design/"],
    docs: ["Docs/UI.md", "Docs/ui/screens.md"],
    entries: ["src/ui/App.tsx", "src/ui/shell/game-shell.tsx", "src/ui/tokens.css"],
  },
  layout: {
    patterns: [
      "src/ui/shared/navigation/pagination",
      "src/ui/shared/navigation/screen",
      "src/ui/shared/cards/art-card",
      "src/ui/tokens.css",
    ],
    docs: ["Docs/UI.md"],
    headings: [
      "Shared layout recipes",
      "Layout, artwork size and spacing",
      "Shared components and enforcement",
      "Required review",
    ],
    entries: [
      "src/ui/shared/navigation/pagination.tsx",
      "src/ui/shared/navigation/screen.tsx",
      "src/ui/shared/cards/art-card.tsx",
      "src/ui/tokens.css",
      "tests/unit/ui/adaptive-browsing.test.tsx",
    ],
  },
  recovery: {
    patterns: [
      "src/application/session",
      "src/application/cloud",
      "src/application/diagnostics",
      "src/ui/shared/diagnostics",
      "desktop/storage",
      "desktop/recovery",
      "tests/integration/recovery/",
    ],
    docs: ["Docs/ARCHITECTURE.md", "Docs/UI.md"],
    headings: [
      "Recovery and persistent failures",
      "Recovery owners",
      "Save contract",
      "Cloud reconciliation and device preferences",
      "Discovery and diagnostics",
    ],
    entries: [
      "src/application/session.ts",
      "src/application/cloud.ts",
      "src/application/diagnostics.ts",
      "src/ui/shared/diagnostics.tsx",
      "desktop/storage.cjs",
      "desktop/recovery.cjs",
      "tests/integration/recovery",
    ],
  },
  content: {
    patterns: ["src/game/content", "src/game/card-rules", "src/assets/", "public/", "assets/"],
    docs: ["Docs/CONTENT.md"],
    entries: ["src/game/content.ts", "src/game/content-validation.ts"],
  },
  tooling: {
    patterns: [
      "scripts/",
      "src/tooling/",
      "tests/",
      ".github/",
      "performance/",
      "package-lock",
      "vite.config",
      "vitest",
      "playwright.config",
    ],
    docs: ["CONTRIBUTING.md", "scripts/README.md", "tests/README.md"],
    entries: ["scripts/checks/check.mjs"],
  },
  release: {
    patterns: ["desktop/", "scripts/release/", "package.json"],
    docs: ["Docs/RELEASE.md"],
    entries: ["desktop/main.cjs", "scripts/release/verify-package.mjs"],
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
    // Focused suites inherit their runtime owner's guidance as well as test policy.
    const owner = /^tests\/unit\/(game|application|platform|ui|tooling)\/(.+)\.test\.[^.]+$/.exec(file);
    const candidates = [file];
    if (owner) {
      candidates.push(`src/${owner[1]}/${owner[2]}`);
      if (owner[1] === "ui") candidates.push(`src/ui/${owner[2].replace(/-ui$/, "")}/`);
      if (owner[1] === "game") candidates.push("src/game/types");
    }
    if (file.startsWith("tests/integration/")) candidates.push("src/game/types");
    const matches = Object.keys(topics).filter((topic) =>
      topics[topic].patterns.some((prefix) => candidates.some((candidate) => candidate.startsWith(prefix))),
    );
    for (const topic of matches.length ? matches : ["architecture"]) selected.add(topic);
  }
  if (!selected.size) selected.add("architecture");
  const docs = [...new Set([...selected].flatMap((topic) => topics[topic].docs))];
  return {
    topics: [...selected],
    sections: docs.flatMap((file) => {
      const owners = [...selected].filter((topic) => topics[topic].docs.includes(file));
      return sections(root, file).filter((section) =>
        owners.some((topic) => !topics[topic].headings || topics[topic].headings.includes(section.heading)),
      );
    }),
    entries: [...new Set([...selected].flatMap((topic) => topics[topic].entries))],
  };
}
export function taskContext(root, { paths = [], base, topics: requested = [] } = {}) {
  const files = requested.length && !paths.length && !base ? [] : taskPaths(root, { paths, base });
  return context(root, files, requested);
}

export function main(args = process.argv.slice(2)) {
  const requested = [],
    paths = [];
  let json = false,
    working = false,
    base;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help") continue;
    if (args[i] === "--task") requested.push(args[++i]);
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--diff" || args[i] === "--working-tree") working = true;
    else if (args[i] === "--base") {
      if (base || !args[i + 1] || args[i + 1].startsWith("-")) throw new Error("--base requires one ref.");
      base = args[++i];
    } else if (args[i] !== "--") {
      if (args[i].startsWith("--")) throw new Error(`Unknown option: ${args[i]}`);
      paths.push(args[i]);
    }
  }
  if (args.includes("--help")) {
    console.log(
      `Topics: ${Object.keys(topics).join(", ")}\nUsage: context -- [paths|--base ref|--working-tree] [--task topic] [--json]`,
    );
    return;
  }
  if (base && working) throw new Error("Choose --base or --working-tree.");
  if (paths.length && (base || working)) throw new Error("Choose paths or a Git diff.");
  const result = taskContext(ROOT, { paths, base: working ? "HEAD" : base, topics: requested });
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

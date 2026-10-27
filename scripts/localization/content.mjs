import fs from "node:fs";
import path from "node:path";
import { extractGlossaryRules } from "./glossary-rules.mjs";
import { extractPassiveRules } from "./passive-rules.mjs";
import { extractTalentRules } from "./talent-rules.mjs";
import { extractBoonRules } from "./boon-rules.mjs";
import { parseSync } from "@swc/core";

/** Extract literal authored names by gameplay ID; generated rules have a separate migration. */
export function extractContent(files) {
  const messages = new Map();
  const add = (id, value, location) => {
    if (typeof id !== "string" || typeof value !== "string" || !value.trim())
      throw new Error(`${location}: content localization requires literal ID and name`);
    const previous = messages.get(id);
    if (previous && previous.text !== value) throw new Error(`${location}: conflicting content ${id}`);
    messages.set(id, { text: value });
  };
  const fields = (node) =>
    Object.fromEntries(
      (node.properties ?? [])
        .filter((item) => item.type === "KeyValueProperty")
        .map((item) => [item.key.value, item.value]),
    );
  for (const { location, source } of files) {
    const ast = parseSync(source, { syntax: "typescript", tsx: false, target: "es2022" });
    const creature = /\/content\/creatures\/[^/]+\.ts$/.test(location);
    const talent = /\/content\/talents\/[^/]+\.ts$/.test(location);
    const boon = location.endsWith("/content/boons.ts");
    const food = location.endsWith("/content/food.ts");
    const keywords = location === "src/game/keywords.ts";
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (
        creature &&
        node.type === "KeyValueProperty" &&
        node.key?.value === "species" &&
        node.value?.type === "ObjectExpression"
      ) {
        const values = fields(node.value);
        const id = values.id?.type === "StringLiteral" ? values.id.value : undefined;
        for (const key of ["name", "title", "trait"]) {
          const value = values[key];
          if (!id || value?.type !== "StringLiteral")
            throw new Error(`${location}: species ${key} must be literal`);
          add(`content.species.${id}.${key}`, value.value, location);
        }
      }
      if (
        keywords &&
        node.type === "KeyValueProperty" &&
        node.value?.type === "CallExpression" &&
        node.value.callee?.type === "Identifier" &&
        node.value.callee.value === "entry"
      ) {
        const label = node.value.arguments[0]?.expression;
        if (!node.key?.value || label?.type !== "StringLiteral")
          throw new Error(`${location}: keyword ID and label must be literal`);
        add(`content.keyword.${node.key.value}.label`, label.value, location);
      }
      if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
        const callee = node.callee.value;
        const args = node.arguments.map((arg) => arg.expression);
        if ((creature && ["card", "attack"].includes(callee)) || (talent && callee === "talent")) {
          if (args[0]?.type !== "StringLiteral" || args[1]?.type !== "StringLiteral")
            throw new Error(`${location}: ${callee} ID and name must be literal`);
          add(`content.${talent ? "talent" : "card"}.${args[0].value}.name`, args[1].value, location);
        } else if (boon && callee === "boon" && args[0]?.type === "ObjectExpression") {
          const values = fields(args[0]);
          if (values.id?.type !== "StringLiteral" || values.name?.type !== "StringLiteral")
            throw new Error(`${location}: Boon ID and name must be literal`);
          add(`content.boon.${values.id.value}.name`, values.name.value, location);
        }
      }
      if (food && node.type === "ObjectExpression") {
        const values = fields(node);
        if (values.id?.type === "StringLiteral" && values.id.value.startsWith("food-")) {
          if (values.name?.type !== "StringLiteral")
            throw new Error(`${location}: food name must be literal`);
          add(`content.card.${values.id.value}.name`, values.name.value, location);
        }
      }
      for (const [key, child] of Object.entries(node)) {
        if (key === "span") continue;
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === "object") visit(child);
      }
    }
    visit(ast);
  }
  return Object.fromEntries([...messages].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
export function extractProjectContent(root) {
  const dir = path.join(root, "src/game/content");
  const files = fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
    .map((file) => ({
      location: path.relative(root, file).replaceAll(path.sep, "/"),
      source: fs.readFileSync(file, "utf8"),
    }));
  const keywordFile = path.join(root, "src/game/keywords.ts");
  files.push({ location: "src/game/keywords.ts", source: fs.readFileSync(keywordFile, "utf8") });
  const names = extractContent(files);
  const rules = extractBoonRules(
    fs.readFileSync(path.join(root, "src/game/rules/boons.ts"), "utf8"),
    fs.readFileSync(keywordFile, "utf8"),
  );
  const talentRules = extractTalentRules(
    fs.readFileSync(path.join(root, "src/game/rules/talents.ts"), "utf8"),
    fs.readFileSync(keywordFile, "utf8"),
  );
  const authoredTalentRules = Object.fromEntries(
    Object.entries(talentRules).filter(([id]) => Object.hasOwn(names, id.replace(/\.rule$/, ".name"))),
  );
  return Object.fromEntries(
    Object.entries({
      ...names,
      ...rules,
      ...authoredTalentRules,
      ...extractGlossaryRules(
        fs.readFileSync(path.join(root, "src/game/glossary.ts"), "utf8"),
        fs.readFileSync(keywordFile, "utf8"),
        fs.readFileSync(path.join(root, "src/game/resurrection-rules.ts"), "utf8"),
      ),
      ...extractPassiveRules(files, fs.readFileSync(keywordFile, "utf8")),
    }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

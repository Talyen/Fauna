import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractProjectContent } from "./content.mjs";
import { parseSync } from "@swc/core";

function parameters(text, location) {
  if (!text.trim()) throw new Error(`${location}: localization source cannot be empty`);
  const names = [...text.matchAll(/\{\{([a-zA-Z][\w]*)\}\}/g)].map((match) => match[1]);
  if (/\{\{|\}\}/.test(text.replace(/\{\{[a-zA-Z][\w]*\}\}/g, "")))
    throw new Error(`${location}: malformed localization parameter`);
  return [...new Set(names)].sort().join(",");
}

/** Extract only explicit message calls; this is not a completeness check. */
export function extractMessages(files) {
  const messages = new Map();
  for (const { location, source } of files) {
    const ast = parseSync(source, { syntax: "typescript", tsx: location.endsWith(".tsx"), target: "es2022" });
    function visit(node) {
      if (!node || typeof node !== "object") return;
      const callee = node.callee;
      if (
        node.type === "CallExpression" &&
        callee?.type === "MemberExpression" &&
        callee.object?.type === "Identifier" &&
        callee.object.value === "i18n" &&
        ["message", "template", "plural"].includes(callee.property?.value)
      ) {
        const [id, source] = node.arguments.map((arg) => arg.expression);
        if (id?.type !== "StringLiteral" || !/^[a-z][\w]*(?:\.[a-zA-Z][\w]*)+$/.test(id.value))
          throw new Error(`${location}: localization requires a stable literal message ID`);
        let record;
        if (["message", "template"].includes(callee.property.value) && source?.type === "StringLiteral")
          record = { text: source.value };
        else if (callee.property.value === "plural" && source?.type === "ObjectExpression") {
          const forms = Object.fromEntries(
            source.properties.map((prop) => {
              if (prop.type !== "KeyValueProperty" || prop.value.type !== "StringLiteral")
                throw new Error(`${location}: plural forms must be literal strings`);
              return [prop.key.value, prop.value.value];
            }),
          );
          if (source.properties.length !== 2 || Object.keys(forms).sort().join(",") !== "one,other")
            throw new Error(`${location}: English plural requires one and other forms`);
          record = { forms: { one: forms.one, other: forms.other } };
        } else throw new Error(`${location}: localization source must be literal`);
        if (record.text !== undefined) parameters(record.text, location);
        else if (parameters(record.forms.one, location) !== parameters(record.forms.other, location))
          throw new Error(`${location}: English plural forms require the same named parameters`);
        const old = messages.get(id.value);
        if (old && JSON.stringify(old) !== JSON.stringify(record))
          throw new Error(`${location}: conflicting English source for ${id.value}`);
        messages.set(id.value, record);
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

export function extractProjectMessages(root) {
  const files = fs
    .readdirSync(path.join(root, "src/ui"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
    .map((file) => ({ location: path.relative(root, file), source: fs.readFileSync(file, "utf8") }));
  return extractMessages(files);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "../..");
  const destination = path.join(root, "src/ui/shared/localization/messages.en.json");
  const messages = extractProjectMessages(root);
  const output = JSON.stringify(messages, null, 2) + "\n";
  const contentFile = path.join(root, "src/ui/shared/localization/content.en.json");
  const content = extractProjectContent(root);
  const contentOutput = JSON.stringify(content, null, 2) + "\n";
  switch (process.argv[2]) {
    case "extract":
      fs.writeFileSync(destination, output);
      fs.writeFileSync(contentFile, contentOutput);
      console.log(
        `Extracted ${Object.keys(messages).length} explicit UI messages and ${Object.keys(content).length} authored entries`,
      );
      break;
    case "check":
      if (!fs.existsSync(destination) || fs.readFileSync(destination, "utf8") !== output) {
        console.error("English localization catalog is stale; run npm run localization:extract");
        process.exitCode = 1;
      } else if (!fs.existsSync(contentFile) || fs.readFileSync(contentFile, "utf8") !== contentOutput) {
        console.error("English content catalog is stale; run npm run localization:extract");
        process.exitCode = 1;
      } else
        console.log(
          `English localization catalogs are current (${Object.keys(messages).length} UI messages; ${Object.keys(content).length} authored entries)`,
        );
      break;
    default:
      throw new Error("Use extract or check");
  }
}

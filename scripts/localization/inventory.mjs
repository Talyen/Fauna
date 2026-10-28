import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "@swc/core";

// This is a migration inventory, not a catalog or a completeness check.
const textAttributes = new Set([
  "aria-label",
  "aria-description",
  "aria-valuetext",
  "aria-roledescription",
  "alt",
  "title",
  "placeholder",
  "label",
  "description",
]);
const readable = (value) => /\p{L}/u.test(value);

export function inventorySource(source, filename) {
  const ast = parseSync(source, { syntax: "typescript", tsx: true, target: "es2022" });
  const bytes = Buffer.from(source);
  const lineStarts = [0];
  for (let index = 0; index < bytes.length; index++) if (bytes[index] === 10) lineStarts.push(index + 1);
  const location = (offset) => {
    let low = 0,
      high = lineStarts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle;
    }
    return {
      line: low + 1,
      column: Array.from(bytes.subarray(lineStarts[low], offset).toString()).length + 1,
    };
  };
  const entries = [];
  const add = (node, kind, value) => {
    const text = value.replace(/\s+/g, " ").trim();
    if (!readable(text)) return;
    const leading = node.type === "JSXText" ? node.value.match(/^\s*/)[0] : "";
    const position = location(node.span.start - 1 + Buffer.byteLength(leading));
    entries.push({
      file: filename,
      ...position,
      kind,
      text,
    });
  };
  function expression(node, kind) {
    if (node.type === "StringLiteral") add(node, kind, node.value);
    else if (node.type === "TemplateLiteral") {
      const value = node.quasis.map((part) => part.cooked ?? part.raw).join("{…}");
      add(node, node.expressions.length ? `${kind}-template` : kind, value);
    } else if (node.type === "ConditionalExpression") {
      expression(node.consequent, kind);
      expression(node.alternate, kind);
    } else if (node.type === "BinaryExpression" && ["&&", "??", "||"].includes(node.operator)) {
      if (node.operator !== "&&") expression(node.left, kind);
      expression(node.right, kind);
    } else if (node.type === "ArrayExpression") {
      for (const element of node.elements)
        if (element && !element.spread) expression(element.expression, kind);
    } else if (
      [
        "ParenthesisExpression",
        "TsAsExpression",
        "TsConstAssertion",
        "TsSatisfiesExpression",
        "TsNonNullExpression",
        "TsTypeAssertion",
      ].includes(node.type)
    )
      expression(node.expression, kind);
  }
  function visit(node, parent) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXText") add(node, "jsx", node.value);
    else if (node.type === "JSXAttribute" && textAttributes.has(node.name.value)) {
      if (node.value?.type === "StringLiteral") add(node.value, "attribute", node.value.value);
      else if (node.value?.type === "JSXExpressionContainer") expression(node.value.expression, "attribute");
    } else if (node.type === "JSXExpressionContainer" && parent?.type !== "JSXAttribute") {
      expression(node.expression, "jsx-expression");
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "span") continue;
      if (Array.isArray(child)) child.forEach((item) => visit(item, node));
      else if (child && typeof child === "object") visit(child, node);
    }
  }
  visit(ast);
  return entries;
}

export function inventoryDirectory(root) {
  const directory = path.join(root, "src/ui");
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .sort()
    .flatMap((file) => inventorySource(fs.readFileSync(path.join(root, file), "utf8"), file));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "../..");
  const entries = inventoryDirectory(root);
  console.log(
    JSON.stringify(
      {
        scope:
          "Literal JSX text and selected text attributes in src/ui; dynamic and content text require separate review",
        count: entries.length,
        entries,
      },
      null,
      2,
    ),
  );
}

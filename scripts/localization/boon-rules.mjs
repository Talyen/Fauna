import { parseSync } from "@swc/core";
import { evaluateRule } from "./rule-evaluator.mjs";
import { walk } from "./source-ast.mjs";

export function keywordPattern(source) {
  const words = [];
  walk(parseSync(source, { syntax: "typescript", target: "es2022" }), (node) => {
    if (
      node.type !== "KeyValueProperty" ||
      node.value?.type !== "CallExpression" ||
      node.value.callee?.value !== "entry"
    )
      return;
    const args = node.value.arguments.map((item) => item.expression);
    if (args[2]?.value !== "active") return;
    if (args[0]?.type !== "StringLiteral") throw new Error("Keyword label must be literal");
    const aliases =
      args[4]?.type === "ArrayExpression" ? args[4].elements.map((item) => item?.expression) : [];
    if (aliases.some((item) => item?.type !== "StringLiteral"))
      throw new Error("Keyword aliases must be literal");
    words.push(args[0].value, ...aliases.map((item) => item.value));
  });
  return new RegExp(
    `\\b(${words
      .map((word) => word.toLowerCase())
      .sort((a, b) => b.length - a.length)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b`,
    "gi",
  );
}
export function templateFor(text, pattern) {
  let keyword = 0,
    value = 0,
    cursor = 0,
    output = "";
  const plain = (input) => input.replace(/\d+(?:\.\d+)?/g, () => `{{value${value++}}}`);
  for (const match of text.matchAll(pattern)) {
    output += plain(text.slice(cursor, match.index));
    const id = `keyword${keyword++}`;
    output += `<${id}>${match[0]}</${id}>`;
    cursor = match.index + match[0].length;
  }
  return output + plain(text.slice(cursor));
}
export function evaluate(node, params, name, bindings = {}) {
  return evaluateRule(node, { ...bindings, [name]: params }, {}, true);
}
/** Resolve only the finite literal Boon authoring DSL; never execute source code. */
export function extractBoonRules(ruleSource, keywordSource) {
  const pattern = keywordPattern(keywordSource);
  const result = {};
  walk(parseSync(ruleSource, { syntax: "typescript", target: "es2022" }), (node) => {
    if (
      node.type !== "KeyValueProperty" ||
      node.value?.type !== "CallExpression" ||
      node.value.callee?.value !== "boon"
    )
      return;
    const id = node.key?.value;
    const [data, description] = node.value.arguments.map((arg) => arg.expression);
    if (
      typeof id !== "string" ||
      data?.type !== "ObjectExpression" ||
      description?.type !== "ArrowFunctionExpression"
    )
      throw new Error("Unsupported Boon authoring form");
    const params = Object.fromEntries(
      data.properties.map((prop) => {
        if (prop.type !== "KeyValueProperty") throw new Error(`Invalid parameters for ${id}`);
        return [prop.key.value, evaluate(prop.value, {}, "")];
      }),
    );
    const text = evaluate(description.body, params, description.params[0]?.value ?? "");
    if (typeof text !== "string" || !text) throw new Error(`Invalid description for ${id}`);
    result[`content.boon.${id}.rule`] = { text: templateFor(text, pattern), reference: text };
  });
  return result;
}

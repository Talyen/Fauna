import { parseSync } from "@swc/core";

export function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const [key, child] of Object.entries(node)) {
    if (key === "span") continue;
    if (Array.isArray(child)) child.forEach((item) => walk(item, visit));
    else if (child && typeof child === "object") walk(child, visit);
  }
}
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
  switch (node?.type) {
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return node.value;
    case "Identifier":
      if (node.value === name) return params;
      if (Object.hasOwn(bindings, node.value)) return bindings[node.value];
      break;
    case "MemberExpression": {
      const object = evaluate(node.object, params, name, bindings);
      if (node.property?.type === "Identifier" && object && Object.hasOwn(object, node.property.value))
        return object[node.property.value];
      break;
    }
    case "TemplateLiteral":
      return node.quasis
        .map(
          (part, index) =>
            (part.cooked ?? part.raw) +
            (index < node.expressions.length
              ? String(evaluate(node.expressions[index], params, name, bindings))
              : ""),
        )
        .join("");
    case "ParenthesisExpression":
    case "TsConstAssertion":
      return evaluate(node.expression, params, name, bindings);
    case "ConditionalExpression":
      return evaluate(node.test, params, name, bindings)
        ? evaluate(node.consequent, params, name, bindings)
        : evaluate(node.alternate, params, name, bindings);
    case "BinaryExpression": {
      const left = evaluate(node.left, params, name, bindings),
        right = evaluate(node.right, params, name, bindings);
      if (node.operator === "===") return left === right;
      if (node.operator === "*") return left * right;
      break;
    }
  }
  throw new Error(`Unsupported rule description expression: ${node?.type ?? "missing"}`);
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

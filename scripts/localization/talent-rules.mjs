import { parseSync } from "@swc/core";
import { evaluate, keywordPattern, templateFor } from "./boon-rules.mjs";

/** Resolve Talent rules from their authored literal DSL without executing source. */
export function extractTalentRules(ruleSource, keywordSource) {
  const ast = parseSync(ruleSource, { syntax: "typescript", target: "es2022" });
  const helper = ast.body.find(
    (node) => node.type === "FunctionDeclaration" && node.identifier.value === "repeatRule",
  );
  const declarations = ast.body
    .filter((node) => node.type === "VariableDeclaration")
    .flatMap((node) => node.declarations);
  const wrapped = declarations.find((node) => node.id?.value === "talentModifiers")?.init?.arguments?.[0]
    ?.expression;
  const catalog = wrapped?.type === "TsConstAssertion" ? wrapped.expression : wrapped;
  if (
    catalog?.type !== "ObjectExpression" ||
    !helper ||
    helper.body.stmts.length !== 1 ||
    helper.body.stmts[0].type !== "ReturnStatement"
  )
    throw new Error("Unsupported Talent authoring catalog");
  const helperRule = helper.body.stmts[0].argument;
  const pattern = keywordPattern(keywordSource);
  const result = {};
  function readRule(call, bindings = {}) {
    const [data, description] = call.arguments.map((arg) => arg.expression);
    if (data?.type !== "ObjectExpression" || description?.type !== "ArrowFunctionExpression")
      throw new Error("Unsupported Talent rule");
    const params = Object.fromEntries(
      data.properties.map((prop) => {
        if (prop.type === "Identifier") return [prop.value, evaluate(prop, {}, "", bindings)];
        if (prop.type !== "KeyValueProperty") throw new Error("Unsupported Talent parameter");
        return [prop.key.value, evaluate(prop.value, {}, "", bindings)];
      }),
    );
    return evaluate(description.body, params, description.params[0]?.value ?? "", bindings);
  }
  for (const property of catalog.properties) {
    if (property.type !== "KeyValueProperty" || typeof property.key?.value !== "string")
      throw new Error("Unsupported Talent entry");
    const id = property.key.value,
      node = property.value;
    let text;
    if (node.type === "ObjectExpression") {
      const value = node.properties.find(
        (item) => item.type === "KeyValueProperty" && item.key.value === "text",
      )?.value;
      text = evaluate(value, {}, "");
    } else if (node.type === "CallExpression" && node.callee?.value === "rule") text = readRule(node);
    else if (node.type === "CallExpression" && node.callee?.value === "repeatRule") {
      const args = node.arguments.map((arg) => evaluate(arg.expression, {}, ""));
      const bindings = Object.fromEntries(
        helper.params.map((param, index) => [param.pat.value, args[index]]),
      );
      if (helperRule?.type !== "CallExpression" || helperRule.callee?.value !== "rule")
        throw new Error("Unsupported repeat rule");
      text = readRule(helperRule, bindings);
    } else throw new Error(`Unsupported Talent entry: ${id}`);
    if (typeof text !== "string" || !text) throw new Error(`Invalid Talent description: ${id}`);
    result[`content.talent.${id}.rule`] = { text: templateFor(text, pattern), reference: text };
  }
  return result;
}

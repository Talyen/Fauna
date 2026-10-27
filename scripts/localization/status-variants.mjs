import { createHash } from "node:crypto";
import { parseSync } from "@swc/core";
import { keywordPattern, templateFor, walk } from "./boon-rules.mjs";
import { evaluateRule } from "./rule-evaluator.mjs";
import { readKeywordLabels } from "./card-model.mjs";
import { extractGlossaryRules } from "./glossary-rules.mjs";
import { statusRuleVariantId } from "../../src/ui/shared/localization/rule-key.mjs";

/** Extract complete transient status messages from their UI model without executing source. */
export function extractStatusVariants(statusSource, glossarySource, keywordSource, resurrectionSource) {
  const ast = parseSync(statusSource, { syntax: "typescript", target: "es2022" });
  const expressions = {},
    labels = readKeywordLabels(keywordSource),
    glossary = extractGlossaryRules(glossarySource, keywordSource, resurrectionSource);
  const keywordDefinitions = Object.fromEntries(
    Object.entries(labels).map(([id, label]) => [
      id,
      { label, description: glossary[`content.glossary.keyword.${id}.definition.rule`]?.reference },
    ]),
  );
  let pending;
  walk(ast, (node) => {
    if (node.type === "VariableDeclarator" && node.id?.value === "pending")
      pending = node.init?.type === "TsConstAssertion" ? node.init.expression : node.init;
    if (
      node.type !== "CallExpression" ||
      node.callee?.object?.value !== "entries" ||
      node.callee.property?.value !== "push"
    )
      return;
    const argument = node.arguments[0]?.expression;
    if (argument?.type !== "ObjectExpression") return;
    const id = argument.properties.find((property) => property.key?.value === "id")?.value;
    const text = argument.properties.find((property) => property.key?.value === "text")?.value;
    if (id?.type === "StringLiteral" && text) {
      if (Object.hasOwn(expressions, id.value)) throw new Error(`Duplicate status: ${id.value}`);
      expressions[id.value] = text;
    }
  });
  if (pending?.type !== "ArrayExpression") throw new Error("Unsupported pending status catalog");
  for (const item of pending.elements) {
    const tuple = item?.expression;
    if (tuple?.type !== "ArrayExpression" || tuple.elements.length !== 3)
      throw new Error("Unsupported pending status");
    const id = tuple.elements[0]?.expression,
      text = tuple.elements[2]?.expression;
    if (id?.type !== "StringLiteral" || !text || Object.hasOwn(expressions, id.value))
      throw new Error("Invalid pending status");
    expressions[id.value] = text;
  }
  const pattern = keywordPattern(keywordSource),
    contextHash = createHash("sha256")
      .update(statusSource)
      .update(keywordSource)
      .update(resurrectionSource)
      .digest("hex"),
    result = {};
  for (const [id, expression] of Object.entries(expressions)) {
    for (const controlled of [undefined, "freeze", "stun"]) {
      for (const count of [0, 1, 2]) {
        const combat = {
          controlled,
          controlTurns: count,
          cooldown: count,
          grace: count,
          rhythm: count,
          nextPhysical: count,
        };
        walk(expression, (node) => {
          if (
            node.type === "MemberExpression" &&
            node.object?.type === "Identifier" &&
            node.object.value === "combat" &&
            (node.property?.type !== "Identifier" || !Object.hasOwn(combat, node.property.value))
          )
            throw new Error(`Unsupported status value: ${node.property?.value ?? "computed"}`);
          if (
            node.type === "MemberExpression" &&
            node.object?.object?.value === "KEYWORD_DEFINITIONS" &&
            node.property?.value === "description" &&
            typeof keywordDefinitions[node.object.property?.value]?.description !== "string"
          )
            throw new Error(`Unsupported status keyword: ${node.object.property?.value ?? "computed"}`);
        });
        const text = evaluateRule(expression, { combat, KEYWORD_DEFINITIONS: keywordDefinitions }, {});
        if (typeof text !== "string" || !text) throw new Error(`Invalid status description: ${id}`);
        const template = templateFor(text, pattern),
          key = statusRuleVariantId(id, template);
        if (result[key] && result[key].text !== template)
          throw new Error(`Status rule hash collision: ${key}`);
        result[key] ??= { text: template, reference: text, contextHash };
      }
    }
  }
  return result;
}

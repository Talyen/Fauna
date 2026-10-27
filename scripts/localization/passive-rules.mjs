import { parseSync } from "@swc/core";
import { evaluate, keywordPattern, templateFor, walk } from "./boon-rules.mjs";

/** Read the finite creature passive authoring forms without executing gameplay code. */
export function extractPassiveRules(files, keywordSource) {
  const pattern = keywordPattern(keywordSource);
  const result = {};
  const fields = (object) =>
    Object.fromEntries(
      object.properties.filter((p) => p.type === "KeyValueProperty").map((p) => [p.key.value, p.value]),
    );
  for (const { location, source } of files) {
    if (!/\/content\/creatures\/[^/]+\.ts$/.test(location)) continue;
    walk(parseSync(source, { syntax: "typescript", target: "es2022" }), (node) => {
      if (
        node.type !== "KeyValueProperty" ||
        node.key?.value !== "species" ||
        node.value?.type !== "ObjectExpression"
      )
        return;
      const species = fields(node.value),
        id = species.id?.value,
        tiers = species.passiveTiers;
      if (typeof id !== "string") throw new Error(`${location}: invalid species ID`);
      let texts;
      if (tiers?.type === "ArrayExpression") {
        texts = tiers.elements.map((entry) => evaluate(fields(entry.expression).description, {}, ""));
      } else if (tiers?.type === "CallExpression" && tiers.callee?.value === "sixPassiveTiers") {
        const [values, build] = tiers.arguments.map((arg) => arg.expression);
        const body = build?.body?.type === "ParenthesisExpression" ? build.body.expression : build?.body;
        if (
          values?.type !== "ArrayExpression" ||
          build?.type !== "ArrowFunctionExpression" ||
          body?.type !== "ObjectExpression"
        )
          throw new Error(`${location}: unsupported passive tiers`);
        texts = values.elements.map((entry) =>
          evaluate(fields(body).description, evaluate(entry.expression, {}, ""), build.params[0]?.value),
        );
      } else throw new Error(`${location}: unsupported passive tiers`);
      if (texts.length !== 6 || texts.some((text) => typeof text !== "string" || !text))
        throw new Error(`${location}: invalid passive descriptions`);
      texts.forEach((text, rank) => {
        result[`content.species.${id}.passive.${rank}.rule`] = {
          text: templateFor(text, pattern),
          reference: text,
        };
      });
    });
  }
  return result;
}

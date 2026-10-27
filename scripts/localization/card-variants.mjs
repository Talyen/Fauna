import { createHash } from "node:crypto";
import { parseSync } from "@swc/core";
import { keywordPattern, templateFor } from "./boon-rules.mjs";
import { walk } from "./source-ast.mjs";
import { cardRuleVariantId } from "../../src/ui/shared/localization/rule-key.mjs";
import {
  describeCompleteCard,
  enemyCardModel,
  readAuthoredCards,
  readCardDescriptionFunctions,
  readKeywordLabels,
  readSupplementalPolicies,
} from "./card-model.mjs";

// Values and room power vary at runtime. The sampled forms cover equality to 1
// and its complement; reject new numeric branches until extraction covers them.
function checkDynamicBranches(ability, supplemental, policies) {
  const branchTest = (node) => {
    if (["ConditionalExpression", "IfStatement"].includes(node.type)) return node.test;
    if (node.type !== "BinaryExpression") return undefined;
    if (["&&", "||", "??"].includes(node.operator)) return node.left;
    if (["===", "!==", "==", "!=", ">", ">=", "<", "<="].includes(node.operator)) return node;
    return undefined;
  };
  const references = (node, names) => {
    if (!node || typeof node !== "object") return false;
    if (node.type === "Identifier") return names.has(node.value);
    if (node.type === "MemberExpression")
      return (
        references(node.object, names) ||
        (node.property?.type === "Computed" && references(node.property.expression, names))
      );
    return Object.entries(node).some(
      ([key, value]) =>
        key !== "span" &&
        (Array.isArray(value) ? value.some((item) => references(item, names)) : references(value, names)),
    );
  };
  for (const [id, fn] of Object.entries(ability)) {
    const dynamic = new Set(["value", "power", "level"]);
    let size;
    do {
      size = dynamic.size;
      walk(fn, (node) => {
        if (
          node.type === "VariableDeclarator" &&
          node.id?.type === "Identifier" &&
          references(node.init, dynamic)
        )
          dynamic.add(node.id.value);
        if (
          node.type === "AssignmentExpression" &&
          node.left?.type === "Identifier" &&
          references(node.right, dynamic)
        )
          dynamic.add(node.left.value);
      });
    } while (dynamic.size !== size);
    walk(fn, (node) => {
      const test = branchTest(node);
      if (!test || !references(test, dynamic)) return;
      if (
        test?.type !== "BinaryExpression" ||
        test.operator !== "===" ||
        test.left?.type !== "Identifier" ||
        !["value", "power"].includes(test.left.value) ||
        test.right?.type !== "NumericLiteral" ||
        test.right.value !== 1
      )
        throw new Error(`Unsupported dynamic card branch: ${id}`);
    });
  }
  for (const [id, fn] of Object.entries(supplemental)) {
    if (policies[id]?.scaling !== "power") continue;
    walk(fn, (node) => {
      const test = branchTest(node);
      if (!test) return;
      let amount = false;
      walk(test, (part) => {
        if (
          part.type === "MemberExpression" &&
          part.object?.value === "effect" &&
          part.property?.value === "amount"
        )
          amount = true;
      });
      if (amount) throw new Error(`Unsupported scaled supplemental branch: ${id}`);
    });
  }
}

/** Catalog every authored card's known player and enemy rule form using its actual DSL. */
export function extractCardVariants(files, sources, keywordSource) {
  if (typeof sources.abilityValues !== "string") throw new Error("Missing card value owner");
  const cards = readAuthoredCards(files),
    labels = readKeywordLabels(keywordSource),
    pattern = keywordPattern(keywordSource);
  const ability = readCardDescriptionFunctions(sources.abilities),
    supplemental = readCardDescriptionFunctions(sources.supplemental),
    policies = readSupplementalPolicies(sources.supplemental);
  const core = parseSync(sources.cardRules, { syntax: "typescript", target: "es2022" }).body.filter(
    (node) => {
      const declaration = node.type === "ExportDeclaration" ? node.declaration : node;
      return (
        declaration?.type === "FunctionDeclaration" &&
        ["cardText", "enemyCard", "enemyHealing"].includes(declaration.identifier?.value)
      );
    },
  );
  if (core.length !== 3) throw new Error("Missing card rule owner");
  const cardText = core
    .map((node) => (node.type === "ExportDeclaration" ? node.declaration : node))
    .find((node) => node.identifier?.value === "cardText");
  checkDynamicBranches({ ...ability, cardText }, supplemental, policies);
  const normalize = (value) =>
    JSON.stringify(value, (key, item) => (["span", "ctxt", "raw"].includes(key) ? undefined : item));
  const scaleAst = parseSync(sources.contracts, { syntax: "typescript", target: "es2022" })
    .body.filter(
      (node) => node.type === "ExportDeclaration" && node.declaration?.type === "VariableDeclaration",
    )
    .flatMap((node) => node.declaration.declarations)
    .find((node) => node.id?.value === "scalePower")?.init;
  const expectedScale = parseSync(
    "const scalePower = (amount: number, power = 1) => Math.round(amount * power);",
    { syntax: "typescript", target: "es2022" },
  ).body[0].declarations[0].init;
  if (!scaleAst || normalize(scaleAst) !== normalize(expectedScale))
    throw new Error("Unsupported card power scaling");
  const result = {};
  for (const card of Object.values(cards)) {
    const enemy = enemyCardModel(card, sources.abilities, sources.supplemental);
    const effectKinds = [...new Set((card.effects ?? []).map((effect) => effect.kind))].sort();
    const contextHash = createHash("sha256")
      .update(
        normalize({
          card,
          core,
          scale: sources.contracts,
          abilityValues: sources.abilityValues,
          abilities: [ability[card.effect], ability[enemy.effect]],
          extras: effectKinds.map((id) => ({ rule: supplemental[id], policy: policies[id] })),
        }),
      )
      .digest("hex");
    const models = JSON.stringify(card) === JSON.stringify(enemy) ? [card] : [card, enemy];
    for (const model of models) {
      for (const value of new Set([card.value, 1, 2])) {
        for (const power of [1, 1.7]) {
          const text = describeCompleteCard(model, 0, value, power, sources, labels);
          const template = templateFor(text, pattern),
            id = cardRuleVariantId(card.id, template);
          if (result[id] && result[id].text !== template) throw new Error(`Card rule hash collision: ${id}`);
          result[id] ??= { text: template, reference: text, contextHash };
        }
      }
    }
  }
  return result;
}

import { createHash } from "node:crypto";
import { parseSync } from "@swc/core";
import { keywordPattern, templateFor } from "./boon-rules.mjs";
import { cardRuleVariantId } from "../../src/ui/shared/localization/rule-key.mjs";
import {
  describeCompleteCard,
  enemyCardModel,
  readAuthoredCards,
  readCardDescriptionFunctions,
  readKeywordLabels,
  readSupplementalPolicies,
} from "./card-model.mjs";

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

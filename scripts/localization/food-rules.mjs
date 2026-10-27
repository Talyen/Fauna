import { parseSync } from "@swc/core";
import { evaluate, keywordPattern, templateFor, walk } from "./boon-rules.mjs";

/** Extract the finite Food description branches from the game's authoring code. */
export function extractFoodRules(foodSource, cardRulesSource, abilitySource, keywordSource, boonSource) {
  const parse = (source) => parseSync(source, { syntax: "typescript", target: "es2022" });
  let food, branch, mana, healing;
  walk(parse(foodSource), (node) => {
    if (node.type === "VariableDeclarator" && node.id?.value === "FOOD_CARDS") {
      const argument = node.init?.arguments?.[0]?.expression;
      food = argument?.type === "TsSatisfiesExpression" ? argument.expression : argument;
    }
  });
  walk(parse(cardRulesSource), (node) => {
    if (
      node.type === "IfStatement" &&
      node.test?.operator === "===" &&
      node.test.left?.object?.value === "card" &&
      node.test.left?.property?.value === "species" &&
      node.test.right?.type === "NullLiteral"
    )
      branch = node.consequent;
  });
  walk(parse(abilitySource), (node) => {
    if (
      node.type === "KeyValueProperty" &&
      node.key?.value === "mana" &&
      node.value?.type === "ObjectExpression"
    )
      mana = node.value.properties.find((item) => item.key?.value === "describe")?.value;
  });
  walk(parse(boonSource), (node) => {
    if (node.type !== "KeyValueProperty" || node.key?.value !== "cornucopia") return;
    const parameters = node.value?.arguments?.[0]?.expression;
    healing = parameters?.properties?.find((property) => property.key?.value === "healing")?.value;
  });
  if (
    food?.type !== "ArrayExpression" ||
    branch?.type !== "BlockStatement" ||
    branch.stmts.length !== 5 ||
    healing?.type !== "NumericLiteral" ||
    mana?.type !== "ArrowFunctionExpression"
  )
    throw new Error("Unsupported Food authoring form");
  const [heal, guard, all, cornucopia, consume] = branch.stmts;
  const isEffect = (node, effect) =>
    node?.type === "IfStatement" &&
    node.test?.operator === "===" &&
    node.test.left?.object?.value === "card" &&
    node.test.left?.property?.value === "effect" &&
    node.test.right?.value === effect;
  const assignment = (node, operator) =>
    node?.consequent?.type === "ExpressionStatement" &&
    node.consequent.expression?.type === "AssignmentExpression" &&
    node.consequent.expression.operator === operator &&
    node.consequent.expression.left?.value === "text"
      ? node.consequent.expression.right
      : null;
  if (
    !isEffect(heal, "heal") ||
    !isEffect(guard, "guard") ||
    all?.test?.callee?.value !== "foodForAllies" ||
    cornucopia?.test?.operator !== "&&" ||
    cornucopia.test.left?.operator !== "===" ||
    cornucopia.test.left.left?.object?.value !== "card" ||
    cornucopia.test.left.left?.property?.value !== "id" ||
    cornucopia.test.left.right?.value !== "food-mana-berries" ||
    cornucopia.test.right?.callee?.value !== "cornucopiaHealing" ||
    cornucopia.test.right?.arguments?.length !== 1 ||
    cornucopia.test.right.arguments[0]?.expression?.value !== "state" ||
    consume?.test?.object?.value !== "card" ||
    consume.test.property?.value !== "consume"
  )
    throw new Error("Unsupported Food rule branches");
  const base = { heal: assignment(heal, "="), guard: assignment(guard, "="), mana: mana.body },
    allRule = assignment(all, "="),
    suffix = assignment(consume, "+="),
    extra = assignment(cornucopia, "+=");
  if (
    !base.heal ||
    !base.guard ||
    allRule?.type !== "ConditionalExpression" ||
    suffix?.type !== "StringLiteral" ||
    extra?.type !== "TemplateLiteral" ||
    extra.expressions.length !== 1 ||
    extra.expressions[0]?.callee?.value !== "cornucopiaHealing" ||
    extra.expressions[0]?.arguments?.length !== 1 ||
    extra.expressions[0].arguments[0]?.expression?.value !== "state"
  )
    throw new Error("Unsupported Food description");
  const result = {},
    pattern = keywordPattern(keywordSource);
  for (const item of food.elements) {
    if (item?.expression?.type !== "ObjectExpression") throw new Error("Invalid Food record");
    const fields = Object.fromEntries(
      item.expression.properties.map((property) => {
        if (property.type !== "KeyValueProperty") throw new Error("Invalid Food property");
        return [property.key.value, property.value];
      }),
    );
    const id = evaluate(fields.id, {}, ""),
      effect = evaluate(fields.effect, {}, ""),
      value = evaluate(fields.value, {}, "");
    if (
      fields.species?.type !== "NullLiteral" ||
      !base[effect] ||
      fields.consume?.value !== true ||
      fields.effects ||
      fields.leech ||
      fields.repeatChance ||
      fields.restore
    )
      throw new Error(`Unsupported Food rule: ${id}`);
    const bindings = { card: { effect, restore: false }, value };
    const add = (key, node) => {
      const text = evaluate(node, {}, "", bindings) + suffix.value;
      result[`content.card.${id}.${key}rule`] = { text: templateFor(text, pattern), reference: text };
    };
    add("", base[effect]);
    if (effect === "heal" || effect === "guard") add("all.", allRule);
    if (id === "food-mana-berries") {
      const extraText = evaluate({ ...extra, expressions: [healing] }, {}, "", bindings);
      const text = evaluate(base[effect], {}, "", bindings) + extraText + suffix.value;
      result[`content.card.${id}.cornucopia.rule`] = { text: templateFor(text, pattern), reference: text };
    }
  }
  return result;
}

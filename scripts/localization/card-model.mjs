import { parseSync } from "@swc/core";
import { describeRule } from "./rule-evaluator.mjs";

/** Read each description function from the rule catalog, without running authored source. */
export function readCardDescriptionFunctions(source) {
  const ast = parseSync(source, { syntax: "typescript", target: "es2022" });
  const declarations = ast.body
    .filter((node) => node.type === "VariableDeclaration")
    .flatMap((node) => node.declarations);
  const catalog = declarations.find((node) => node.id?.value === "rules")?.init?.arguments?.[0]?.expression;
  if (catalog?.type !== "ObjectExpression") throw new Error("Unsupported card rule catalog");
  return Object.fromEntries(
    catalog.properties.map((entry) => {
      if (entry.type !== "KeyValueProperty" || entry.value?.type !== "ObjectExpression")
        throw new Error("Unsupported card rule entry");
      const describe = entry.value.properties.find((property) => property.key?.value === "describe");
      const fn = describe?.type === "KeyValueProperty" ? describe.value : describe;
      if (!fn || !["ArrowFunctionExpression", "MethodProperty"].includes(fn.type))
        throw new Error(`Unsupported description: ${entry.key.value}`);
      return [entry.key.value, fn];
    }),
  );
}

/** Render the authored description DSL from the supplied data and keyword labels. */
export function describeCardRule(fn, args, labels) {
  const text = describeRule(fn, args, {
    label: (id) => {
      if (!Object.hasOwn(labels, id)) throw new Error(`Unknown description keyword: ${id}`);
      return labels[id];
    },
    scalePower: (amount, power = 1) => Math.round(amount * power),
  });
  if (typeof text !== "string" || !text) throw new Error("Invalid card description");
  return text;
}

function readLiteral(node) {
  switch (node?.type) {
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return node.value;
    case "NullLiteral":
      return null;
    case "ArrayExpression":
      return node.elements.map((item) => {
        if (!item || item.spread) throw new Error("Unsupported card array item");
        return readLiteral(item.expression);
      });
    case "ObjectExpression":
      return Object.fromEntries(
        node.properties.map((property) => {
          if (property.type !== "KeyValueProperty" || typeof property.key?.value !== "string")
            throw new Error("Unsupported card option");
          return [property.key.value, readLiteral(property.value)];
        }),
      );
    default:
      throw new Error(`Unsupported card literal: ${node?.type ?? "missing"}`);
  }
}

/** Read literal card builder arguments while preserving authored gameplay IDs. */
export function readAuthoredCards(files) {
  const cards = {};
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression" && ["card", "attack"].includes(node.callee?.value)) {
      const args = node.arguments.map((argument) => {
        if (argument.spread) throw new Error("Unsupported card argument spread");
        return readLiteral(argument.expression);
      });
      if (args.length < 4 || args.length > 5) throw new Error("Unsupported card builder arguments");
      const [id, name, third, fourth, options = {}] = args;
      if (
        typeof id !== "string" ||
        typeof name !== "string" ||
        typeof options !== "object" ||
        options === null ||
        Array.isArray(options)
      )
        throw new Error("Invalid authored card");
      if (["id", "name", "species", "effect", "value"].some((key) => Object.hasOwn(options, key)))
        throw new Error(`Unsupported card identity override: ${id}`);
      const attack = node.callee.value === "attack";
      const card = {
        id,
        name,
        species: id.slice(0, id.indexOf("-")),
        effect: attack ? "attack" : third,
        value: attack ? third : fourth,
        ...(attack ? { damageType: fourth } : {}),
        ...options,
      };
      if (
        !card.species ||
        typeof card.effect !== "string" ||
        typeof card.value !== "number" ||
        Object.hasOwn(cards, id)
      )
        throw new Error(`Invalid or duplicate authored card: ${id}`);
      cards[id] = card;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "span") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  for (const { source } of files) visit(parseSync(source, { syntax: "typescript", target: "es2022" }));
  return cards;
}

/** Read the shared defaults and explicit policies used to scale supplemental effects. */
export function readSupplementalPolicies(source) {
  const ast = parseSync(source, { syntax: "typescript", target: "es2022" });
  const declarations = ast.body
    .filter((node) => node.type === "VariableDeclaration")
    .flatMap((node) => node.declarations);
  const global = declarations.find((node) => node.id?.value === "global")?.init;
  const defaults = global?.type === "TsSatisfiesExpression" ? global.expression.expression : undefined;
  const catalog = declarations.find((node) => node.id?.value === "rules")?.init?.arguments?.[0]?.expression;
  if (defaults?.type !== "ObjectExpression" || catalog?.type !== "ObjectExpression")
    throw new Error("Unsupported supplemental policies");
  const properties = (object) =>
    Object.fromEntries(
      object.properties
        .filter((item) => item.type === "KeyValueProperty")
        .map((item) => [item.key.value, item.value]),
    );
  const shared = properties(defaults);
  if (shared.scaling?.value !== "fixed" || shared.enemy?.value !== true)
    throw new Error("Unsupported supplemental defaults");
  return Object.fromEntries(
    catalog.properties.map((entry) => {
      if (entry.type !== "KeyValueProperty" || entry.value?.type !== "ObjectExpression")
        throw new Error("Unsupported supplemental rule");
      const fields = properties(entry.value),
        scaling = fields.scaling?.value ?? shared.scaling.value,
        enemy = fields.enemy?.value ?? shared.enemy.value;
      if (!["fixed", "power"].includes(scaling) || typeof enemy !== "boolean")
        throw new Error("Unsupported supplemental policy");
      return [entry.key.value, { scaling, enemy }];
    }),
  );
}

const parsedSources = new WeakMap();

/** Evaluate the complete player card-text function against literal authored data. */
export function describeCompleteCard(card, level, value, power, sources, labels) {
  let parsed = parsedSources.get(sources);
  if (
    !parsed ||
    parsed.cardRules !== sources.cardRules ||
    parsed.abilities !== sources.abilities ||
    parsed.supplemental !== sources.supplemental
  ) {
    const ast = parseSync(sources.cardRules, { syntax: "typescript", target: "es2022" });
    const fn = ast.body.find(
      (node) => node.type === "ExportDeclaration" && node.declaration?.identifier?.value === "cardText",
    )?.declaration;
    if (!fn) throw new Error("Missing card text owner");
    parsed = {
      ...sources,
      fn,
      ability: readCardDescriptionFunctions(sources.abilities),
      supplemental: readCardDescriptionFunctions(sources.supplemental),
      policies: readSupplementalPolicies(sources.supplemental),
    };
    parsedSources.set(sources, parsed);
  }
  const { fn, ability, supplemental, policies } = parsed;
  const label = (id) => {
    if (!Object.hasOwn(labels, id)) throw new Error(`Unknown description keyword: ${id}`);
    return labels[id];
  };
  const result = describeRule(fn, [card, level, value, power, undefined], {
    keywordLabel: label,
    abilityRule: (id) => ({ kind: "ability", id }),
    supplementalRule: (id) => ({ kind: "supplemental", id }),
    abilityExtras: (input, factor) =>
      (input.effects ?? []).map((effect) => {
        if (!policies[effect.kind]) throw new Error(`Unknown supplemental policy: ${effect.kind}`);
        return policies[effect.kind].scaling === "power"
          ? { ...effect, amount: Math.round(effect.amount * factor) }
          : effect;
      }),
    describe: (owner, ...args) => {
      const rules = owner.kind === "ability" ? ability : owner.kind === "supplemental" ? supplemental : null;
      if (!rules || !Object.hasOwn(rules, owner.id)) throw new Error(`Unknown card description: ${owner.id}`);
      return describeCardRule(rules[owner.id], args, labels);
    },
  });
  if (typeof result !== "string" || !result) throw new Error("Invalid complete card description");
  return result;
}

/** Read the adaptation policy used when an authored card appears on an enemy. */
function readAbilityAdaptations(source) {
  const ast = parseSync(source, { syntax: "typescript", target: "es2022" });
  const declarations = ast.body
    .filter((node) => node.type === "VariableDeclaration")
    .flatMap((node) => node.declarations);
  const wrapped = declarations.find((node) => node.id?.value === "automatic")?.init;
  const automatic = wrapped?.type === "TsSatisfiesExpression" ? wrapped.expression.expression : undefined;
  const catalog = declarations.find((node) => node.id?.value === "rules")?.init?.arguments?.[0]?.expression;
  if (automatic?.type !== "ObjectExpression" || catalog?.type !== "ObjectExpression")
    throw new Error("Unsupported ability policies");
  const fallback = automatic.properties.find((property) => property.key?.value === "adaptation")?.value
    ?.value;
  if (fallback !== "extras") throw new Error("Unsupported ability adaptation default");
  return Object.fromEntries(
    catalog.properties.map((entry) => {
      if (entry.type !== "KeyValueProperty" || entry.value?.type !== "ObjectExpression")
        throw new Error("Unsupported ability policy");
      const adaptation =
        entry.value.properties.find((property) => property.key?.value === "adaptation")?.value?.value ??
        fallback;
      if (!["extras", "healingExtra"].includes(adaptation)) throw new Error("Unsupported ability adaptation");
      return [entry.key.value, adaptation];
    }),
  );
}

let enemyPolicies;

/** Produce the documented enemy adaptation without mutating the authored card. */
export function enemyCardModel(card, abilitiesSource, supplementalSource) {
  if (
    !enemyPolicies ||
    enemyPolicies.abilitiesSource !== abilitiesSource ||
    enemyPolicies.supplementalSource !== supplementalSource
  )
    enemyPolicies = {
      abilitiesSource,
      supplementalSource,
      adaptations: readAbilityAdaptations(abilitiesSource),
      policies: readSupplementalPolicies(supplementalSource),
    };
  const { adaptations, policies } = enemyPolicies;
  if (!Object.hasOwn(adaptations, card.effect)) throw new Error(`Unknown ability adaptation: ${card.effect}`);
  const healing =
    adaptations[card.effect] === "healingExtra"
      ? card.effects?.find((effect) => effect.kind === "heal")
      : undefined;
  if (healing)
    return {
      ...card,
      effect: "heal",
      target: healing.target === "recipient" ? undefined : "self",
      value: healing.amount,
      effects: [],
    };
  return {
    ...card,
    effects: card.effects?.filter((effect) => {
      if (!policies[effect.kind]) throw new Error(`Unknown supplemental policy: ${effect.kind}`);
      return policies[effect.kind].enemy;
    }),
  };
}

/** Read literal display labels used by rule descriptions. */
export function readKeywordLabels(source) {
  const ast = parseSync(source, { syntax: "typescript", target: "es2022" });
  let catalog;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id?.value === "KEYWORD_DEFINITIONS")
      catalog = node.init?.arguments?.[0]?.expression;
    for (const [key, child] of Object.entries(node)) {
      if (key === "span") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  visit(ast);
  if (catalog?.type !== "ObjectExpression") throw new Error("Unsupported keyword catalog");
  return Object.fromEntries(
    catalog.properties.map((entry) => {
      const label = entry.value?.arguments?.[0]?.expression;
      if (
        entry.type !== "KeyValueProperty" ||
        entry.value?.callee?.value !== "entry" ||
        label?.type !== "StringLiteral"
      )
        throw new Error("Unsupported keyword label");
      return [entry.key.value, label.value];
    }),
  );
}

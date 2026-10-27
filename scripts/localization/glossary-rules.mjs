import { parseSync } from "@swc/core";
import { evaluate, keywordPattern, templateFor, walk } from "./boon-rules.mjs";

/** Read authored glossary entries and active keyword definitions without executing game code. */
export function extractGlossaryRules(glossarySource, keywordSource, resurrectionSource) {
  const parse = (source) => parseSync(source, { syntax: "typescript", target: "es2022" });
  const constants = {};
  walk(parse(resurrectionSource), (node) => {
    if (node.type === "VariableDeclarator" && node.id?.type === "Identifier")
      constants[node.id.value] = evaluate(node.init, {}, "");
  });
  const keywords = {};
  walk(parse(keywordSource), (node) => {
    if (
      node.type !== "KeyValueProperty" ||
      node.value?.type !== "CallExpression" ||
      node.value.callee?.value !== "entry"
    )
      return;
    const [label, , availability, description] = node.value.arguments.map((arg) => arg.expression);
    if (availability?.value !== "active") return;
    keywords[node.key.value] = {
      term: evaluate(label, {}, ""),
      definition: evaluate(description, {}, "", constants),
    };
  });
  const pattern = keywordPattern(keywordSource),
    result = {};
  const add = (id, term, definition) => {
    if (typeof id !== "string" || typeof term !== "string" || typeof definition !== "string")
      throw new Error("Invalid glossary entry");
    for (const [kind, text] of Object.entries(
      id.startsWith("keyword.") ? { definition } : { term, definition },
    )) {
      const key = `content.glossary.${id}.${kind}.rule`;
      if (Object.hasOwn(result, key)) throw new Error(`Duplicate glossary entry: ${id}`);
      result[key] = { text: templateFor(text, pattern), reference: text };
    }
  };
  let array;
  walk(parse(glossarySource), (node) => {
    if (node.type === "VariableDeclarator" && node.id?.value === "GLOSSARY")
      array = node.init?.type === "TsConstAssertion" ? node.init.expression : node.init;
  });
  if (array?.type !== "ArrayExpression") throw new Error("Unsupported glossary catalog");
  // Fail closed when the computed keyword list changes instead of silently
  // extracting a stale interpretation of its filter or mapping.
  const keywordExpression = parse(
    'const list = KEYWORD_IDS.filter((id) => KEYWORD_DEFINITIONS[id].availability === "active" && !["health", "block", "mana"].includes(id)).map((id) => ({ id: `keyword.${id}`, term: KEYWORD_DEFINITIONS[id].label, definition: KEYWORD_DEFINITIONS[id].description }));',
  ).body[0].declarations[0].init;
  const normalize = (node) =>
    JSON.stringify(node, (key, value) => (["span", "ctxt", "raw"].includes(key) ? undefined : value));
  let spread = false;
  for (const element of array.elements) {
    if (element.spread) {
      if (spread) throw new Error("Duplicate glossary keyword list");
      if (normalize(element.expression) !== normalize(keywordExpression))
        throw new Error("Unsupported glossary keyword list");
      spread = true;
      continue;
    }
    if (element.expression.type !== "ObjectExpression") throw new Error("Unsupported glossary entry");
    const fields = Object.fromEntries(
      element.expression.properties.map((item) => {
        if (item.type !== "KeyValueProperty") throw new Error("Unsupported glossary property");
        return [item.key.value, item.value];
      }),
    );
    const id = evaluate(fields.id, {}, ""),
      term = evaluate(fields.term, {}, "");
    let definition;
    if (fields.definition?.type === "MemberExpression") {
      const target = fields.definition.object;
      if (
        fields.definition.property?.value !== "description" ||
        target?.type !== "MemberExpression" ||
        target.object?.value !== "KEYWORD_DEFINITIONS" ||
        !keywords[target.property?.value]
      )
        throw new Error(`Unsupported glossary definition: ${id}`);
      definition = keywords[target.property.value].definition;
    } else definition = evaluate(fields.definition, {}, "");
    add(id, term, definition);
  }
  if (!spread) throw new Error("Missing glossary keyword list");
  for (const [id, entry] of Object.entries(keywords)) {
    if (["health", "block", "mana"].includes(id)) continue;
    add(`keyword.${id}`, entry.term, entry.definition);
  }
  return result;
}

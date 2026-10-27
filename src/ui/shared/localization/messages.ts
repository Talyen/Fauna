export type MessageValues = Readonly<Record<string, string | number>>;
export type PluralForms = Readonly<{ one: string; other: string }>;
type PluralCategory = Intl.LDMLPluralRule;
type MessageEntry = { source: string; text: string };
type PluralEntry = { source: PluralForms; forms: Partial<Record<PluralCategory, string>> };
export type MessageCatalog = Readonly<Record<string, MessageEntry | PluralEntry>>;

const variables = (text: string) => new Set([...text.matchAll(/\{\{([a-zA-Z][\w]*)\}\}/g)].map((m) => m[1]!));
function matchesVariables(source: string, translation: string) {
  const expected = variables(source);
  const actual = variables(translation);
  const valid = !/\{\{|\}\}/.test(translation.replace(/\{\{[a-zA-Z][\w]*\}\}/g, ""));
  return valid && expected.size === actual.size && [...expected].every((name) => actual.has(name));
}
function format(template: string, values: MessageValues, locale: string) {
  if (!template.includes("{{")) return template;
  const number = new Intl.NumberFormat(locale);
  return template.replace(/\{\{([a-zA-Z][\w]*)\}\}/g, (token, name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    return typeof value === "number" ? number.format(value) : (value ?? token);
  });
}

/** Source wording must still match: stale entries fall back instead of hiding a change. */
export function createMessageReader(locale: string, catalog: MessageCatalog) {
  const pluralRules = new Intl.PluralRules(locale);
  const englishPlural = new Intl.PluralRules("en");
  function message(id: string, source: string, values: MessageValues = {}) {
    const entry = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
    const translated =
      entry &&
      "text" in entry &&
      entry.source === source &&
      entry.text.trim() &&
      matchesVariables(source, entry.text)
        ? entry.text
        : null;
    return format(translated ?? source, values, translated === null ? "en" : locale);
  }
  return {
    locale,
    message,
    content: message,
    plural(id: string, source: PluralForms, count: number, values: MessageValues = {}) {
      const entry = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
      const category = pluralRules.select(count);
      const candidate = entry && "forms" in entry ? entry.forms[category] : undefined;
      const sourceForm = englishPlural.select(count) === "one" ? source.one : source.other;
      const translated =
        entry &&
        "forms" in entry &&
        entry.source.one === source.one &&
        entry.source.other === source.other &&
        candidate &&
        matchesVariables(sourceForm, candidate)
          ? candidate
          : null;
      return format(translated ?? sourceForm, { ...values, count }, translated === null ? "en" : locale);
    },
  };
}

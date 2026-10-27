export type MessageValues = Readonly<Record<string, string | number>>;
export type PluralForms = Readonly<{ one: string; other: string }>;
type PluralCategory = Intl.LDMLPluralRule;
type MessageEntry = { source: string; text: string };
type PluralEntry = { source: PluralForms; forms: Partial<Record<PluralCategory, string>> };
export type MessageCatalog = Readonly<Record<string, MessageEntry | PluralEntry>>;

function variables(text: string) {
  const names = new Set<string>();
  for (const match of text.matchAll(/\{\{([a-zA-Z][\w]*)\}\}/g)) names.add(match[1]!);
  return names;
}
function matchesVariables(source: string, translation: string) {
  if (!source.includes("{{") && !translation.includes("{{") && !translation.includes("}}")) return true;
  const expected = variables(source);
  const actual = variables(translation);
  const valid = !/\{\{|\}\}/.test(translation.replace(/\{\{[a-zA-Z][\w]*\}\}/g, ""));
  if (!valid || expected.size !== actual.size) return false;
  for (const name of expected) if (!actual.has(name)) return false;
  return true;
}
function format(template: string, values: MessageValues, number: () => Intl.NumberFormat) {
  if (!template.includes("{{")) return template;
  return template.replace(/\{\{([a-zA-Z][\w]*)\}\}/g, (token, name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    return typeof value === "number" ? number().format(value) : (value ?? token);
  });
}

/** Source wording must still match: stale entries fall back instead of hiding a change. */
export function createMessageReader(locale: string, catalog: MessageCatalog) {
  const pluralRules = new Intl.PluralRules(locale);
  const englishPlural = new Intl.PluralRules("en");
  let localNumber: Intl.NumberFormat | undefined;
  let englishNumber: Intl.NumberFormat | undefined;
  const localFormatter = () => (localNumber ??= new Intl.NumberFormat(locale));
  const englishFormatter = () => (englishNumber ??= new Intl.NumberFormat("en"));
  return {
    locale,
    message(id: string, source: string, values: MessageValues = {}) {
      const entry = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
      const translated =
        entry &&
        "text" in entry &&
        entry.source === source &&
        entry.text.trim() &&
        matchesVariables(source, entry.text)
          ? entry.text
          : null;
      return format(translated ?? source, values, translated === null ? englishFormatter : localFormatter);
    },
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
      const template = translated ?? sourceForm;
      if (!template.includes("{{")) return template;
      return format(template, { ...values, count }, translated === null ? englishFormatter : localFormatter);
    },
  };
}

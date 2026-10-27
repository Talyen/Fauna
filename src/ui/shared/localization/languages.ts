/** Targets are not offered until their catalogs and rendered flows are qualified. */
import languages from "./languages.json";
export const LANGUAGES = languages;
export type GameLocale = keyof typeof LANGUAGES;
export type LanguagePreference = "auto" | GameLocale;
export const LANGUAGE_PREFERENCE_KEY = "fauna.language.v1";
export const QUALIFIED_LANGUAGES: readonly GameLocale[] = (Object.keys(LANGUAGES) as GameLocale[]).filter(
  (locale) => LANGUAGES[locale].qualified,
);

const steamLanguages = new Map<string, GameLocale>();
for (const [locale, language] of Object.entries(LANGUAGES) as [GameLocale, { steam: string }][]) {
  if (!steamLanguages.has(language.steam)) steamLanguages.set(language.steam, locale);
}

function matchLanguage(value: string): GameLocale | undefined {
  const code = value.toLowerCase().replaceAll("_", "-");
  const steam = steamLanguages.get(code);
  if (steam) return steam;
  if (/^(en|de|ru|ja|fr)(-|$)/.test(code)) return code.split("-")[0] as GameLocale;
  if (/^(zh|zh-hans|zh-cn|zh-sg)$/.test(code) || /^zh-(hans|cn|sg)-/.test(code)) return "zh-Hans";
  if (code === "es" || /^es-es(-|$)/.test(code)) return "es";
  if (/^pt-br(-|$)/.test(code)) return "pt-BR";
  return undefined;
}

/** Manual choice wins; automatic uses a qualified Steam language, then system preferences. */
export function resolveLanguage(
  preference: LanguagePreference,
  steam: string | null,
  system: readonly string[],
  qualified: readonly GameLocale[] = QUALIFIED_LANGUAGES,
): GameLocale {
  if (preference !== "auto") return qualified.includes(preference) ? preference : "en";
  for (const candidate of [...(steam ? [steam] : []), ...system]) {
    const language = matchLanguage(candidate);
    if (language && qualified.includes(language)) return language;
  }
  return "en";
}

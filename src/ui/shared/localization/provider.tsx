import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readPreference, writePreference } from "../../../platform/preferences";
import {
  LANGUAGE_PREFERENCE_KEY,
  QUALIFIED_LANGUAGES,
  resolveLanguage,
  type GameLocale,
  type LanguagePreference,
} from "./languages";
import { RuleCatalogProvider, type RuleCatalog } from "./rule-catalog";
import { MessageProvider } from "./message-context";
import type { MessageCatalog } from "./messages";
import { bundledCatalogs } from "./bundled-catalogs";
const englishCatalog: MessageCatalog = Object.freeze({});
interface LanguageState {
  locale: GameLocale;
  preference: LanguagePreference;
  options: readonly GameLocale[];
  setPreference: (value: LanguagePreference) => void;
}
const fallback: LanguageState = {
  locale: "en",
  preference: "auto",
  options: ["en"],
  setPreference: () => {},
};
const LanguageContext = createContext<LanguageState>(fallback);

/** Unqualified or missing catalogs are never selectable, even if stored by an older build. */
export function LocalizationProvider({
  children,
  catalogs = bundledCatalogs,
  qualified = QUALIFIED_LANGUAGES,
  systemLanguages,
  steamLanguage,
  persist = true,
}: {
  children: ReactNode;
  catalogs?: Partial<Record<GameLocale, MessageCatalog>>;
  qualified?: readonly GameLocale[];
  systemLanguages?: readonly string[];
  steamLanguage?: () => Promise<string | null>;
  persist?: boolean;
}) {
  const options = useMemo(
    () => [
      "en" as const,
      ...qualified.filter((locale) => locale !== "en" && Object.hasOwn(catalogs, locale)),
    ],
    [catalogs, qualified],
  );
  const [preference, setPreferenceState] = useState<LanguagePreference>(() => {
    const saved = persist ? readPreference(LANGUAGE_PREFERENCE_KEY) : null;
    return saved === "auto" || options.some((locale) => locale === saved)
      ? (saved as LanguagePreference)
      : "auto";
  });
  const [steam, setSteam] = useState<string | null>(null);
  useEffect(() => {
    if (!steamLanguage || options.length < 2) return;
    let live = true;
    void Promise.resolve()
      .then(steamLanguage)
      .then((value) => {
        if (live) setSteam(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [steamLanguage, options.length]);
  const system = systemLanguages ?? (typeof navigator === "undefined" ? [] : navigator.languages);
  const locale = resolveLanguage(preference, steam, system, options);
  const catalog = catalogs[locale] ?? englishCatalog;
  const rules = useMemo<RuleCatalog>(
    () =>
      Object.fromEntries(
        Object.entries(catalog).flatMap(([id, entry]) =>
          id.endsWith(".rule") && "text" in entry ? [[id, { source: entry.source, text: entry.text }]] : [],
        ),
      ),
    [catalog],
  );
  const setPreference = useCallback(
    (value: LanguagePreference) => {
      if (value !== "auto" && !options.includes(value)) return;
      setPreferenceState(value);
      if (persist) writePreference(LANGUAGE_PREFERENCE_KEY, value);
    },
    [options, persist],
  );
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);
  return (
    <LanguageContext.Provider value={{ locale, preference, options, setPreference }}>
      <MessageProvider locale={locale} catalog={catalog}>
        <RuleCatalogProvider catalog={rules}>{children}</RuleCatalogProvider>
      </MessageProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

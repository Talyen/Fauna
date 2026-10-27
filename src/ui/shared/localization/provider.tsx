import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readPreference, writePreference } from "../../../platform/preferences";
import {
  LANGUAGES,
  QUALIFIED_LANGUAGES,
  resolveLanguage,
  type GameLocale,
  type LanguagePreference,
} from "./languages";
import { MessageProvider } from "./message-context";
import type { MessageCatalog } from "./messages";

const preferenceKey = "fauna.language.v1";
const bundled = import.meta.glob<MessageCatalog>("./locales/*.json", { eager: true, import: "default" });
const bundledCatalogs: Partial<Record<GameLocale, MessageCatalog>> = {};
for (const locale of Object.keys(LANGUAGES) as GameLocale[]) {
  const catalog = bundled[`./locales/${locale}.json`];
  if (catalog) bundledCatalogs[locale] = catalog;
}
const englishCatalog: MessageCatalog = Object.freeze({});
interface LanguageState {
  locale: GameLocale;
  preference: LanguagePreference;
  options: readonly GameLocale[];
  setPreference: (value: LanguagePreference) => void;
}
const LanguageContext = createContext<LanguageState | null>(null);

/** Unqualified or missing catalogs are never selectable, even if stored by an older build. */
export function LocalizationProvider({
  children,
  catalogs = bundledCatalogs,
  qualified = QUALIFIED_LANGUAGES,
  systemLanguages,
  steamLanguage,
}: {
  children: ReactNode;
  catalogs?: Partial<Record<GameLocale, MessageCatalog>>;
  qualified?: readonly GameLocale[];
  systemLanguages?: readonly string[];
  steamLanguage?: () => Promise<string | null>;
}) {
  const options = useMemo(
    () => [
      "en" as const,
      ...qualified.filter((locale) => locale !== "en" && Object.hasOwn(catalogs, locale)),
    ],
    [catalogs, qualified],
  );
  const [preference, setPreferenceState] = useState<LanguagePreference>(() => {
    const saved = readPreference(preferenceKey);
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
  const setPreference = useCallback(
    (value: LanguagePreference) => {
      if (value !== "auto" && !options.includes(value)) return;
      setPreferenceState(value);
      writePreference(preferenceKey, value);
    },
    [options],
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
      <MessageProvider locale={locale} catalog={catalogs[locale] ?? englishCatalog}>
        {children}
      </MessageProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("Language preference requires LocalizationProvider");
  return context;
}

import { readPreference } from "../../platform/preferences";
import {
  LANGUAGE_PREFERENCE_KEY,
  QUALIFIED_LANGUAGES,
  resolveLanguage,
  type GameLocale,
} from "../shared/localization/languages";
import { createMessageReader, type MessageCatalog } from "../shared/localization/messages";
import { bundledCatalogs } from "../shared/localization/bundled-catalogs";

const STARTUP_MINIMUM_MS = 5000;

/** The HTML element and its animation clock survive the React import and all renders. */
export function createStartupSplash({
  catalogs = bundledCatalogs,
  qualified = QUALIFIED_LANGUAGES,
  systemLanguages = navigator.languages,
}: {
  catalogs?: Partial<Record<GameLocale, MessageCatalog>>;
  qualified?: readonly GameLocale[];
  systemLanguages?: readonly string[];
} = {}) {
  const element = document.getElementById("startup-splash");
  const phrase = document.getElementById("startup-splash-phrase");
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let steam: string | null = null;
  const reader = () => {
    const saved = readPreference(LANGUAGE_PREFERENCE_KEY);
    const preference = saved && qualified.some((locale) => locale === saved) ? (saved as GameLocale) : "auto";
    const locale = resolveLanguage(preference, steam, systemLanguages, qualified);
    return createMessageReader(locale, catalogs[locale] ?? {});
  };
  let activeReader = reader();
  const phrases = () => {
    const i18n = activeReader;
    return [
      i18n.message("startup.adventure", "Adventure awaits…"),
      i18n.message("startup.decks", "Shuffling decks…"),
      i18n.message("startup.creatures", "Waking creatures…"),
      i18n.message("startup.habitats", "Exploring habitats…"),
      i18n.message("startup.expeditions", "Preparing expeditions…"),
      i18n.message("startup.starters", "Training starters…"),
      i18n.message("startup.boons", "Gathering Boons…"),
      i18n.message("startup.shops", "Restocking shops…"),
    ];
  };
  const updateLanguage = () => {
    const i18n = (activeReader = reader());
    document.documentElement.lang = i18n.locale;
    element?.setAttribute("aria-label", i18n.message("startup.loading", "Loading Fauna"));
    if (phrase) phrase.textContent = phrases()[index]!;
  };
  let index = 0;
  let words: ReturnType<typeof setInterval> | undefined;
  let removal: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  const stopWords = () => clearInterval(words);
  const updateMotion = () => {
    stopWords();
    if (motion?.matches || finished) return;
    words = setInterval(() => {
      index = (index + 1) % 8;
      if (phrase) {
        phrase.textContent = phrases()[index]!;
        phrase.style.animation = "none";
        void phrase.offsetHeight;
        phrase.style.animation = "";
      }
    }, 750);
  };
  updateLanguage();
  updateMotion();
  motion?.addEventListener("change", updateMotion);
  let finishMinimum = () => {};
  const minimum = new Promise<void>((resolve) => {
    finishMinimum = resolve;
  });
  const timer = setTimeout(finishMinimum, Math.max(0, STARTUP_MINIMUM_MS - performance.now()));
  const remove = () => {
    clearTimeout(removal);
    element?.removeEventListener("transitionend", onTransitionEnd);
    element?.remove();
  };
  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target === element && event.propertyName === "opacity") remove();
  };
  const finish = () => {
    finished = true;
    stopWords();
    clearTimeout(timer);
    finishMinimum();
    motion?.removeEventListener("change", updateMotion);
    element?.setAttribute("aria-busy", "false");
  };
  return {
    minimum,
    setSteamLanguage(language: string | null) {
      if (finished) return;
      steam = language;
      updateLanguage();
    },
    dismiss() {
      if (finished) return;
      finish();
      if (motion?.matches) remove();
      else {
        element?.classList.add("startup-dismissed");
        element?.addEventListener("transitionend", onTransitionEnd);
        removal = setTimeout(remove, 400);
      }
    },
    fail() {
      if (finished) return;
      element?.classList.add("startup-failed");
      element?.removeAttribute("aria-label");
      element?.setAttribute("aria-labelledby", "startup-splash-phrase");
      if (phrase) {
        const i18n = activeReader;
        phrase.removeAttribute("aria-hidden");
        phrase.textContent = i18n.message("startup.failed", "Fauna could not start");
      }
      finish();
    },
    dispose() {
      finish();
      remove();
    },
  };
}
export type StartupSplash = ReturnType<typeof createStartupSplash>;

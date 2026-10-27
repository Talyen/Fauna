import { LANGUAGES, type GameLocale } from "./languages";
import type { MessageCatalog } from "./messages";
import { shippedCatalogs } from "./shipped-catalogs";

// Development previews can temporarily qualify a catalog without changing production bundles.
const previewCatalogs = import.meta.env.DEV
  ? import.meta.glob<MessageCatalog>("./locales/*.json", { eager: true, import: "default" })
  : {};
export const bundledCatalogs: Partial<Record<GameLocale, MessageCatalog>> = import.meta.env.DEV
  ? Object.fromEntries(
      (Object.keys(LANGUAGES) as GameLocale[]).flatMap((locale) => {
        const catalog = previewCatalogs[`./locales/${locale}.json`];
        return catalog ? [[locale, catalog]] : [];
      }),
    )
  : shippedCatalogs;

import { expect, it } from "vitest";
import { runtimeCatalogModule } from "../../../scripts/localization/runtime-catalogs.mjs";

it("ships only qualified language catalogs and rejects unsafe import paths", () => {
  const languages = { en: { qualified: true }, fr: { qualified: false }, ja: { qualified: true } };
  const shipped = runtimeCatalogModule(languages);
  expect(shipped).toContain('import locale0 from "./locales/ja.json"');
  expect(shipped).not.toContain("locales/fr.json");
  const promoted = runtimeCatalogModule({ ...languages, fr: { qualified: true } });
  expect(promoted).toContain('from "./locales/fr.json"');
  expect(() => runtimeCatalogModule({ "../other": { qualified: true } })).toThrow("Invalid locale");
});

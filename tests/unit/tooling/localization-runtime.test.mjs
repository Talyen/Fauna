import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  runtimeCatalog,
  runtimeCatalogModule,
  runtimeCatalogPlugin,
} from "../../../scripts/localization/runtime-catalogs.mjs";

it("ships only qualified language catalogs and rejects unsafe import paths", () => {
  const languages = { en: { qualified: true }, fr: { qualified: false }, ja: { qualified: true } };
  const shipped = runtimeCatalogModule(languages);
  expect(shipped).toContain('import locale0 from "./locales/ja.json?fauna-runtime"');
  expect(shipped).not.toContain("locales/fr.json");
  const promoted = runtimeCatalogModule({ ...languages, fr: { qualified: true } });
  expect(promoted).toContain('from "./locales/fr.json?fauna-runtime"');
  expect(() => runtimeCatalogModule({ "../other": { qualified: true } })).toThrow("Invalid locale");
});

it("ships reviewed text without authoring metadata and keeps its source contract", () => {
  const input = {
    text: { reviewed: true, source: "Hello", sourceHash: "authoring hash", text: "Bonjour" },
    plural: {
      reviewed: true,
      source: { one: "{{count}} card", other: "{{count}} cards" },
      forms: { one: "{{count}} carte", other: "{{count}} cartes" },
      sourceHash: "authoring hash",
    },
  };
  const result = runtimeCatalog(input);
  expect(result).toEqual({
    text: { source: "Hello", text: "Bonjour" },
    plural: { source: input.plural.source, forms: input.plural.forms },
  });
  expect(() => runtimeCatalog({ text: { ...input.text, reviewed: false } })).toThrow(
    "Unreviewed runtime localization",
  );
  const root = mkdtempSync(path.join(tmpdir(), "fauna-locale-"));
  try {
    mkdirSync(path.join(root, "locales"));
    writeFileSync(path.join(root, "locales", "fr.json"), JSON.stringify(input));
    const plugin = runtimeCatalogPlugin();
    const id = plugin.resolveId("./locales/fr.json?fauna-runtime", path.join(root, "shipped-catalogs.ts"));
    const watched = [];
    expect(plugin.load.call({ addWatchFile: (file) => watched.push(file) }, id)).toBe(
      `export default ${JSON.stringify(result)};`,
    );
    expect(watched).toEqual([path.join(root, "locales", "fr.json")]);
    expect(() => plugin.resolveId("./locales/fr.json?fauna-runtime", path.join(root, "other.ts"))).toThrow(
      "generated catalog owner",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import { expect } from "@playwright/test";
import { LANGUAGES, type GameLocale } from "../../src/ui/shared/localization/languages";
import de from "../../src/ui/shared/localization/locales/de.json";
import fr from "../../src/ui/shared/localization/locales/fr.json";
import es from "../../src/ui/shared/localization/locales/es.json";
import ptBR from "../../src/ui/shared/localization/locales/pt-BR.json";
import ja from "../../src/ui/shared/localization/locales/ja.json";
import zhHans from "../../src/ui/shared/localization/locales/zh-Hans.json";
import ru from "../../src/ui/shared/localization/locales/ru.json";
import { run } from "../support/game";
import { key, seed, test } from "./support/session";

const catalogs = { de, fr, es, "pt-BR": ptBR, ja, "zh-Hans": zhHans, ru };
for (const locale of Object.keys(catalogs) as (keyof typeof catalogs & GameLocale)[]) {
  test(`switches to ${locale} and resumes the same saved battle`, async ({ page }) => {
    test.skip(!LANGUAGES[locale].qualified, "The language is not yet qualified");
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("fauna.test.language-seeded")) {
        localStorage.setItem("fauna.language.v1", "en");
        sessionStorage.setItem("fauna.test.language-seeded", "1");
      }
    });
    await seed(page, run());
    const before = await page.evaluate((saveKey) => localStorage.getItem(saveKey), key);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Language: English", exact: true }).click();
    await page.getByRole("radio", { name: LANGUAGES[locale].name, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect.poll(() => page.evaluate((saveKey) => localStorage.getItem(saveKey), key)).toBe(before);

    const catalog = catalogs[locale] as unknown as Record<string, { text: string }>;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.clock.fastForward(5500);
    await page.clock.resume();
    await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByRole("navigation", { name: catalog["menu.mainMenu"]!.text })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.getByRole("button", { name: catalog["menu.continue"]!.text, exact: true }).click();
    await expect(page.getByRole("main", { name: catalog["battle.battlefield"]!.text })).toBeVisible();
    await expect.poll(() => page.evaluate((saveKey) => localStorage.getItem(saveKey), key)).toBe(before);
  });
}

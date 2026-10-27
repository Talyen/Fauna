import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { LANGUAGES as Languages } from "../../src/ui/shared/localization/languages";
import { run } from "../support/game";
import { key, seed, test } from "./support/session";

const directory = "src/ui/shared/localization";
const languages = JSON.parse(readFileSync(`${directory}/languages.json`, "utf8")) as typeof Languages;
const locales = ["de", "fr", "es", "pt-BR", "ja", "zh-Hans", "ru"] as const;
for (const locale of locales) {
  test(`switches to ${locale} and resumes the same saved battle`, async ({ page }) => {
    test.skip(!languages[locale].qualified, "The language is not yet qualified");
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
    await page.getByRole("radio", { name: languages[locale].name, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect.poll(() => page.evaluate((saveKey) => localStorage.getItem(saveKey), key)).toBe(before);

    const catalog = JSON.parse(readFileSync(`${directory}/locales/${locale}.json`, "utf8")) as Record<
      string,
      { text: string }
    >;
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

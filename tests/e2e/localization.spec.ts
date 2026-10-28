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

for (const locale of locales) {
  test(`keeps the ${locale} menu and Merchant readable at enlarged text`, async ({ page }) => {
    test.skip(!languages[locale].qualified, "The language is not yet qualified");
    const { merchantDestination } = await import("../support/game");
    await page.setViewportSize({ width: 1280, height: 720 });
    await seed(page, merchantDestination());
    await page.evaluate((language) => {
      localStorage.setItem("fauna.language.v1", language);
      localStorage.setItem("fauna.text-scale", "1.25");
    }, locale);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.clock.fastForward(5500);
    await page.clock.resume();
    await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
    const catalog = JSON.parse(readFileSync(`${directory}/locales/${locale}.json`, "utf8")) as Record<
      string,
      { text: string }
    >;
    const collection = page.getByRole("button", { name: catalog["menu.collection"]!.text, exact: true });
    await expect(collection).toBeVisible();
    const lines = await collection.evaluate((button) => {
      const text = [...button.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (!text) return 0;
      const range = document.createRange();
      range.selectNodeContents(text);
      return range.getClientRects().length;
    });
    expect(lines).toBe(1);
    await page.getByRole("button", { name: catalog["menu.continue"]!.text, exact: true }).click();
    await page.getByRole("button", { name: catalog["merchant.visit"]!.text, exact: true }).click();
    const title = page.locator(".merchant-heading h1");
    const wallet = page.locator(".merchant-wallet");
    await expect(title).toBeVisible();
    await expect
      .poll(async () => {
        const [heading, balance] = await Promise.all([title.boundingBox(), wallet.boundingBox()]);
        if (!heading || !balance) return false;
        return heading.x + heading.width <= balance.x && Math.abs(heading.x + heading.width / 2 - 640) <= 1;
      })
      .toBe(true);
    await expect.poll(() => title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });
}

test("keeps French reward levels on one line with room for their keyword", async ({ page }) => {
  const { winBattle } = await import("../support/game");
  await page.setViewportSize({ width: 1280, height: 720 });
  await seed(page, winBattle());
  await page.evaluate(() => {
    localStorage.setItem("fauna.language.v1", "fr");
    localStorage.setItem("fauna.text-scale", "1.25");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.clock.fastForward(5500);
  await page.clock.resume();
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  const label = page.locator(".reward-keyword-label").first();
  await expect(label).toBeVisible();
  const layout = await label.evaluate((el) => {
    const keyword = el.children[0]!.getBoundingClientRect();
    const level = el.children[1]!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el.children[1]!);
    return { gap: level.left - keyword.right, lines: range.getClientRects().length };
  });
  expect(layout.gap).toBeGreaterThanOrEqual(7);
  expect(layout.lines).toBe(1);
});

test("keeps unavailable talent rules readable without allowing a purchase", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seed(page, run());
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  await page.locator(".talent-category button").first().click();
  const talent = page.locator('.talent-node[aria-disabled="true"]').first();
  await expect(talent).toBeVisible();
  const contrast = await talent.evaluate((node) => {
    const rgb = (value: string) =>
      value
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
    const background = rgb(getComputedStyle(node).backgroundColor);
    const opacity = Number(getComputedStyle(node).opacity);
    const luminance = (channels: number[]) => {
      const linear = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    return [".talent-effect", ".talent-status"].map((selector) => {
      const foreground = rgb(getComputedStyle(node.querySelector(selector)!).color);
      const visible = foreground.map(
        (channel, index) => channel * opacity + background[index]! * (1 - opacity),
      );
      return (luminance(visible) + 0.05) / (luminance(background) + 0.05);
    });
  });
  expect(contrast[0]).toBeGreaterThanOrEqual(4.5);
  expect(contrast[1]).toBeGreaterThanOrEqual(4.5);
  const before = await page.evaluate((saveKey) => localStorage.getItem(saveKey), key);
  await talent.click();
  expect(await page.evaluate((saveKey) => localStorage.getItem(saveKey), key)).toBe(before);
});

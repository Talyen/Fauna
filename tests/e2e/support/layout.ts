import { expect, type Page } from "@playwright/test";

export async function fits(page: Page) {
  expect(
    await page.evaluate(() => ({
      width: document.documentElement.scrollWidth <= innerWidth,
      height: document.documentElement.scrollHeight <= innerHeight,
    })),
  ).toEqual({ width: true, height: true });
}

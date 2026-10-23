import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { createGame } from "../../../src/game/engine";
import { decodeSave } from "../../../src/game/save";
import type { GameState } from "../../../src/game/types";

const fastContexts = new WeakSet<BrowserContext>();
const clockPages = new WeakSet<Page>();

export const test = base.extend<{ realStartup: boolean; allowedPageErrors: RegExp[] }>({
  realStartup: [false, { option: true }],
  allowedPageErrors: [[], { option: true }],
  context: async ({ context, realStartup, allowedPageErrors }, provide) => {
    if (!realStartup) fastContexts.add(context);
    const errors: string[] = [];
    const observe = (page: Page) => page.on("pageerror", (error) => errors.push(error.message));
    context.on("page", observe);
    context.pages().forEach(observe);
    await provide(context);
    expect(
      errors.filter((message) => !allowedPageErrors.some((pattern) => pattern.test(message))),
      "Unexpected uncaught browser errors",
    ).toEqual([]);
  },
  page: async ({ page }, provide) => {
    await prepareClock(page);
    await provide(page);
  },
});

async function prepareClock(page: Page) {
  if (fastContexts.has(page.context()) && !clockPages.has(page)) {
    await page.clock.install();
    clockPages.add(page);
  }
}

/** New tabs share storage, but need their own clock before navigation */
export async function openHome(page: Page) {
  await prepareClock(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForStartup(page);
}

export async function reloadHome(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForStartup(page);
}

export const key = "fauna.save.v1";
export async function waitForStartup(page: Page) {
  // Skip only the intentional splash delay; resources, fonts and the menu must still become ready
  if (clockPages.has(page) && (await page.locator("#startup-splash").count())) {
    await page.clock.fastForward(5500);
    await page.clock.resume();
  }
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
}
export async function seed(page: Page, game = createGame(7)) {
  const initial = page.url() === "about:blank";
  const data = JSON.stringify(game);
  decodeSave(data);
  if (initial) {
    // Init scripts survive reloads; the per-page marker prevents restoring an old
    // fixture over a save committed by the persistence tests.
    await page.addInitScript(
      ({ key, data }) => {
        if (sessionStorage.getItem("fauna.test.seeded")) return;
        localStorage.setItem(key, data);
        sessionStorage.setItem("fauna.test.seeded", "1");
      },
      { key, data },
    );
    await openHome(page);
  } else {
    await page.evaluate(
      ({ key, data }) => {
        for (const stored of Object.keys(localStorage))
          if (stored === key || stored.startsWith(`${key}.`)) localStorage.removeItem(stored);
        localStorage.setItem(key, data);
      },
      { key, data },
    );
    await reloadHome(page);
  }
}

export async function saved(page: Page) {
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
}

export async function state(page: Page): Promise<GameState> {
  await saved(page);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}

export async function resume(page: Page) {
  await waitForStartup(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

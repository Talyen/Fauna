import { expect, type Page } from "@playwright/test";
import { createGame } from "../../../src/game/engine";
import type { GameState } from "../../../src/game/types";

export const key = "fauna.save.v1";
export async function seed(page: Page, game = createGame(7)) {
  const initial = page.url() === "about:blank";
  const data = JSON.stringify(game);
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
    await page.goto("/");
  } else {
    await page.evaluate(
      ({ key, data }) => {
        localStorage.clear();
        localStorage.setItem(key, data);
      },
      { key, data },
    );
    await page.reload();
  }
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#startup-splash")).toHaveCount(0);
}

export async function saved(page: Page) {
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
}

export async function state(page: Page): Promise<GameState> {
  await saved(page);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}

export async function resume(page: Page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

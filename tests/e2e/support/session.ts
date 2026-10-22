import { expect, type Page } from "@playwright/test";
import { createGame } from "../../../src/game/engine";
import type { GameState } from "../../../src/game/types";

export const key = "fauna.save.v1";
export async function seed(page: Page, game = createGame(7)) {
  if (page.url() === "about:blank") await page.goto("/");
  await page.evaluate(
    ({ key, data }) => {
      localStorage.clear();
      localStorage.setItem(key, data);
    },
    { key, data: JSON.stringify(game) },
  );
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
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

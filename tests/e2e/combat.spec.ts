import { captureScreen } from "./rendered-evidence";
import { test, expect, type Page } from "@playwright/test";
import { produce } from "immer";
import { run } from "../unit/helpers";
import type { GameState } from "../../src/game/types";
async function seed(page: Page, game: GameState) {
  await page.addInitScript((game) => localStorage.setItem("fauna.save.v1", JSON.stringify(game)), game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
for (const width of [1280, 1920]) {
  test(`pile inspection preserves gameplay and nested focus at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const game = produce(run(), (s) => {
      s.battle!.discard.push(s.battle!.draw.pop()!);
    });
    await seed(page, game);
    const opener = page.getByRole("button", { name: /^Inspect Draw Pile/ });
    await opener.click();
    const pile = page.getByRole("dialog", { name: "Draw Pile", exact: true });
    await expect(pile.locator(".action-card")).toHaveCount(game.battle!.draw.length);
    const card = pile.locator(".action-card").first();
    await card.click();
    await expect(page.locator(".inspection.single-card")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();
    await page.getByRole("button", { name: "Close draw pile" }).click();
    await expect(opener).toBeFocused();
    await page.getByRole("button", { name: /^Inspect Discard Pile/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Discard Pile", exact: true }).locator(".action-card"),
    ).toHaveCount(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(game);
    await captureScreen(page, { path: `reports/combat-piles-${width}.png` });
  });
  test(`Campfire remains eligible while hurt and Health survives entry to the boss at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    const game = produce(run(), (s) => {
      s.phase = "teamSelection";
      s.battle = null;
      s.encounter = 3;
      s.expedition = { biome: 0, step: 3, offers: [{ location: "hollow-heart", pack: 0 }], chosen: null };
      s.team[0]!.health = 0;
      s.team[1]!.health = 7;
    });
    await seed(page, game);
    await page.getByRole("button", { name: "Visit Campfire", exact: true }).click();
    await expect(page.locator(".campfire-screen")).toBeVisible();
    await captureScreen(page, { path: `reports/combat-campfire-${width}.png` });
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    await expect(page.getByRole("button", { name: "Visit Campfire", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Inspect Hollow Heart", exact: true }).click();
    await page.getByRole("button", { name: "Begin battle", exact: true }).click();
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!) as GameState);
    expect(saved.team.map((creature) => creature.health)).toEqual([10, 14, 26]);
    expect(saved.expedition?.offers).toEqual(game.expedition!.offers);
  });
}

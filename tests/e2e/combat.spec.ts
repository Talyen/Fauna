import { captureScreen } from "./support/rendered-evidence";
import { test, expect, type Page } from "@playwright/test";
import { produce } from "immer";
import { run } from "../support/game";
import type { GameState } from "../../src/game/types";
async function seed(page: Page, game: GameState) {
  await page.addInitScript((game) => {
    if (sessionStorage.getItem("fauna.combat.seeded")) return;
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    sessionStorage.setItem("fauna.combat.seeded", "true");
  }, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
for (const width of [1280, 1920]) {
  test(`pile browsing preserves gameplay and hover rules at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const game = produce(run(), (s) => {
      s.battle!.discard.push(s.battle!.draw.pop()!);
    });
    await seed(page, game);
    const opener = page.getByRole("button", { name: /^Inspect Draw Pile/ });
    await opener.click();
    const pile = page.getByRole("dialog", { name: "Draw Pile", exact: true });
    await expect(pile.locator(".action-card")).toHaveCount(
      Math.min(width === 1280 ? 3 : 6, game.battle!.draw.length),
    );
    const card = pile.locator(".action-card").first();
    await card.click();
    await expect(page.locator(".inspection")).toHaveCount(0);
    await card.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await card.focus();
    await page.keyboard.press("i");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    if (width === 1280 && game.battle!.draw.length > 3) {
      await pile.getByRole("button", { name: "Next page" }).click();
      await expect(pile.locator(".action-card")).toHaveCount(game.battle!.draw.length - 3);
    }
    await page.getByRole("button", { name: "Close draw pile" }).click();
    await expect(opener).toBeFocused();
    await page.getByRole("button", { name: /^Inspect Discard Pile/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Discard Pile", exact: true }).locator(".action-card"),
    ).toHaveCount(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(game);
    await captureScreen(page, { path: `reports/combat-piles-${width}.png` });
  });
  test(`Campfire heals the roster once and Health survives entry to the boss at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    const game = produce(run(), (s) => {
      s.phase = "teamSelection";
      s.battle = null;
      s.encounter = 3;
      s.expedition = { pack: 0, recruit: null, lastRoom: null };
      s.team[0]!.health = 0;
      s.team[1]!.health = 7;
    });
    await seed(page, game);
    await page.getByRole("button", { name: "Visit Campfire", exact: true }).click();
    await expect(page.locator(".campfire-screen")).toBeVisible();
    await captureScreen(page, { path: `reports/combat-campfire-${width}.png` });
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    await expect(page.getByRole("button", { name: "Visit Campfire", exact: true })).toHaveCount(0);
    const rested = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!) as GameState);
    expect(rested.team.map((creature) => creature.health)).toEqual([10, 16, 30]);
    await page.reload();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Boss: / })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(rested);
    await page.getByRole("button", { name: /^Boss: / }).click();
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!) as GameState);
    expect(saved.team.map((creature) => creature.health)).toEqual([10, 16, 30]);
    expect(saved.expedition?.pack).toEqual(game.expedition!.pack);
  });
}

for (const width of [1280, 1920]) {
  test(`mouse targeting waits for a recipient and keeps the battlefield stable at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const game = produce(run(7), (state) => {
      const attack = state.cards.find((card) => card.definitionId === "prismram-attack")!;
      state.battle!.hand = [attack.id];
      state.battle!.draw = state.cards.filter((card) => card.id !== attack.id).map((card) => card.id);
    });
    await seed(page, game);
    const card = page.locator(".app:not([inert]) .hand .action-card");
    const row = page.getByRole("region", { name: "Player row" });
    const before = await row.evaluate((element) => ({
      top: (element as HTMLElement).offsetTop,
      height: element.clientHeight,
    }));
    await card.click();
    await expect(page.getByText("Prismram · Choose an enemy", { exact: true })).toBeVisible();
    await expect(page.locator(".target-preview")).toHaveCount(0);
    await expect(page.locator(".target-line")).toHaveCount(0);
    const target = page.locator('[data-actor-id="enemy-0"] .creature-card');
    await target.hover();
    await expect(page.locator('[data-actor-id="enemy-0"]')).toHaveAttribute("data-active-target", "true");
    const recipientPreview = page.locator('[data-actor-id="enemy-0"] .target-preview');
    await expect(recipientPreview).toBeVisible();
    const enemy = game.battle!.enemies[0]!;
    await expect(recipientPreview).toHaveAttribute(
      "aria-label",
      `Target preview for ${enemy.name}: Health ${enemy.health} to ${enemy.health - 6}, Block 0 to 0`,
    );
    await expect(recipientPreview).toContainText("−6");
    await expect(page.locator(".target-preview")).toHaveCount(1);
    expect(
      await row.evaluate((element) => ({
        top: (element as HTMLElement).offsetTop,
        height: element.clientHeight,
      })),
    ).toEqual(before);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(game);
    await captureScreen(page, { path: `reports/targeting-hover-${width}.png` });
    await card.hover();
    await expect(page.locator(".target-preview")).toHaveCount(0);
    await expect(page.locator(".target-line")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(card).toHaveAttribute("aria-pressed", "false");
  });
}

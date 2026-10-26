import { reloadHome, test, seed, resume } from "./support/session";
import { captureScreen, settleScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { produce } from "immer";
import { authoredPack, prepareDestination, run } from "../support/game";
import type { GameState } from "../../src/game/types";
for (const width of [1280, 1920]) {
  test(`Campfire ${width === 1280 ? "heals once, resumes and enters the boss" : "layout fits"} at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    const game = produce(run(), (s) => {
      prepareDestination(s);
      s.encounter = 3;
      s.journey!.victories = s.encounter;
      s.expedition = { pack: authoredPack(s.encounter), recruit: null, lastRoom: null };
      s.team[0]!.health = 0;
      s.team[1]!.health = 7;
    });
    await seed(page, game);
    await resume(page);
    await page.getByRole("button", { name: "Visit Campfire", exact: true }).click();
    await expect(page.locator(".campfire-screen")).toBeVisible();
    await captureScreen(page, { path: `reports/combat-campfire-${width}.png` });
    if (width !== 1280) return;
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    await expect(page.getByRole("button", { name: "Visit Campfire", exact: true })).toHaveCount(0);
    const rested = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!) as GameState);
    expect(rested.team.map((creature) => creature.health)).toEqual([10, 16, 30]);
    await reloadHome(page);
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

test("mouse targeting previews without committing and stays stable across live resize", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const game = produce(run(7), (state) => {
    const attack = state.cards.find((card) => card.definitionId === "prismram-attack")!;
    state.battle!.hand = [attack.id];
    state.battle!.draw = state.cards.filter((card) => card.id !== attack.id).map((card) => card.id);
  });
  await seed(page, game);
  await resume(page);
  for (const width of [1280, 1920]) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await settleScreen(page);
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
      `Possible outcomes for ${enemy.name}: 6 Physical or Critical 12 Physical or Dodge`,
    );
    await expect(recipientPreview).toHaveAttribute("data-conditional", "true");
    await expect(recipientPreview).toContainText("May be Dodged");
    await expect(recipientPreview).toContainText("Critical possible");
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
  }
});

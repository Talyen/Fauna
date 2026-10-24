import { expect } from "@playwright/test";
import { orifableBattle } from "../support/orifable";
import { test, seed, state, resume } from "./support/session";
import { settleScreen } from "./support/rendered-evidence";

test("Food uses shared targeting, consumes only after a play and resumes without Orifable ownership", async ({
  page,
}) => {
  const game = orifableBattle(true);
  await seed(page, game);
  await resume(page);
  const apple = page.locator('.app:not([inert]) .hand [aria-label^="Apple,"]');
  await expect(apple).toHaveAccessibleName(/Apple, Food, 1 mana, Restore 6 Health; Consume/);
  const before = await state(page);
  await apple.click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await state(page)).toEqual(before);
  await apple.click();
  await page.getByRole("button", { name: "Target Emberback", exact: true }).click();
  await settleScreen(page);
  const after = await state(page);
  expect(after.team[1]!.health).toBe(game.team[1]!.health + 6);
  expect(after.cards.some((card) => card.definitionId === "food-apple")).toBe(false);
  expect(after.cards.filter((card) => card.ownerId === null)).toHaveLength(2);
  await page.reload();
  await page.getByRole("navigation", { name: "Main menu" }).waitFor();
  await resume(page);
  await expect(page.locator('.app:not([inert]) .hand [aria-label^="Mana Berries,"]')).toBeVisible();
  await expect(page.locator('.app:not([inert]) .hand [aria-label^="Trail Bread,"]')).toBeVisible();
  await expect(page.locator('.app:not([inert]) .hand [aria-label^="Apple,"]')).toHaveCount(0);
});

test("Care Package visibly creates two random neutral consumables", async ({ page }) => {
  await seed(page, orifableBattle());
  await resume(page);
  const before = await state(page);
  await page.locator('.app:not([inert]) .hand [aria-label^="Care Package,"]').click();
  await expect
    .poll(async () => (await state(page)).cards.filter((card) => card.ownerId === null).length)
    .toBe(2);
  const after = await state(page);
  expect(after.battle!.mana).toBe(before.battle!.mana - 1);
  await expect(page.locator('.app:not([inert]) .hand [aria-label*=", Food,"]')).toHaveCount(2);
});

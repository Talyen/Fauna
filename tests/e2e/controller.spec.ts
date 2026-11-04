import { expect } from "@playwright/test";
import { run } from "../support/game";
import { test, seed, state, resume } from "./support/session";
import { gamepad } from "./support/gamepad";
test("Steam Input uses keyboard navigation without controller-family settings", async ({ page }) => {
  const press = await gamepad(page);
  await seed(page, run());
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await expect(page.getByRole("radio", { name: "PlayStation" })).toHaveCount(0);
  await press(1);
  await resume(page);
  await press(13);
  await expect(page.locator(".app")).toHaveAttribute("data-input", "keyboard");
  await expect(page.getByRole("button", { name: "End turn", exact: true })).toBeVisible();
});
test("held keyboard confirm cannot activate successive battle commands", async ({ page }) => {
  await seed(page, run());
  await resume(page);
  const before = await state(page);
  await page.getByRole("button", { name: "End turn", exact: true }).focus();
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect.poll(async () => (await state(page)).revision).toBe(before.revision + 1);
});
test("battle enemy inspection through Steam Input preserves progress and returns focus", async ({ page }) => {
  const press = await gamepad(page);
  await seed(page, run());
  await resume(page);
  const enemy = page.locator(".enemy-row .creature-card").first();
  await enemy.focus();
  const before = await state(page);
  await press(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await press(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await state(page)).toEqual(before);
});

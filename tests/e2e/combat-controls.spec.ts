import { controller } from "./support/gamepad";
import { reloadHome, test, seed, resume } from "./support/session";
import { captureScreen, settleScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { produce } from "immer";
import { run, victoryReady } from "../support/game";
import { decodeSave, encodeSave } from "../../src/game/save";
import { continueToRecruit } from "./support/journey";
test("combat preferences, autoplay pause and manual takeover", async ({ page }) => {
  const width = 1280;
  await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
  await page.emulateMedia({ reducedMotion: width === 1280 ? "reduce" : "no-preference" });
  await page.addInitScript(() => {
    localStorage.setItem("fauna.text-scale", "1.25");
    localStorage.setItem("fauna.audio.v1", JSON.stringify({ enabled: false }));
  });
  await seed(page, run());
  await resume(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Battle", exact: true }).click();
  const setting = page.getByRole("switch", { name: "Auto-end turn", exact: true });
  await expect(setting).toBeChecked();
  await setting.focus();
  await page.keyboard.press("Space");
  await expect(setting).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("fauna.auto-end-turn"))).toBe("false");
  await captureScreen(page, { path: `reports/controls-settings-${width}.png` });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const autoplay = page.getByRole("button", { name: "Auto-play", exact: true });
  await page.mouse.move(0, 0);
  await settleScreen(page);
  const menu = await page.getByRole("button", { name: "Open menu" }).boundingBox();
  const auto = await autoplay.boundingBox();
  expect(auto!.y).toBe(menu!.y);
  expect(auto!.x + auto!.width).toBeLessThan(menu!.x);
  const mana = await page.getByRole("button", { name: /^Mana / }).boundingBox();
  const endTurn = await page.getByRole("button", { name: /^End turn/ }).boundingBox();
  const draw = await page.locator('[data-pile="draw"]').boundingBox();
  const discard = await page.locator('[data-pile="discard"]').boundingBox();
  expect(draw!.y).toBeGreaterThanOrEqual(mana!.y + mana!.height);
  expect(discard!.y).toBeGreaterThanOrEqual(endTurn!.y + endTurn!.height);
  expect(draw!.x + draw!.width).toBeLessThan(width / 2);
  expect(discard!.x).toBeGreaterThan(width / 2);
  for (const pile of [draw!, discard!]) {
    expect(pile.width / pile.height).toBeCloseTo(3 / 4, 2);
    const expectedWidth = await page
      .locator(".hand-slot")
      .first()
      .evaluate((slot) => slot.clientWidth * 0.8);
    expect(Math.abs(pile.width - expectedWidth)).toBeLessThan(1);
  }
  await autoplay.click();
  await expect(autoplay).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
  const revision = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision)).toBe(
    revision,
  );
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision))
    .toBeGreaterThan(revision);
  await page.locator(".app:not([inert]) .hand .action-card:not([aria-disabled=true])").first().click();
  await expect(autoplay).toHaveAttribute("aria-pressed", "false");
  // Targeted cards need cancellation; immediate cards already return to ordinary battle input
  if ((await page.locator(".app:not([inert]) .battle-screen").getAttribute("data-selected-card")) !== "")
    await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toHaveCount(0);
  await captureScreen(page, { path: `reports/controls-battle-${width}.png` });
  await expect(page.getByRole("button", { name: "Skip combat", exact: true })).toHaveCount(0);
  // Browser controller simulation exercises the same semantic action as physical Y.
  const pad = await controller(page);
  await pad.frames();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
  const beforeController = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
  await pad.press(3);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision))
    .toBe(beforeController.revision + 1);
  const afterController = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
  expect(afterController.battle.turn).toBe(beforeController.battle.turn + 1);
});
test("development skip wins once through normal rewards", async ({ page }) => {
  test.skip(process.env.FAUNA_DEV_REVIEW !== "1", "Requires an explicitly owned development preview.");
  const initial = run();
  await seed(page, initial);
  await resume(page);
  const skip = page.getByRole("button", { name: "Skip combat", exact: true });
  await expect(skip).toBeVisible();
  const skipBounds = await skip.boundingBox();
  const autoBounds = await page.getByRole("button", { name: "Auto-play", exact: true }).boundingBox();
  expect(skipBounds!.y).toBe(autoBounds!.y);
  expect(skipBounds!.x + skipBounds!.width).toBeLessThan(autoBounds!.x);
  await skip.click();
  await continueToRecruit(page);
  await expect(page.getByRole("heading", { name: "Choose a Recruit" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).currency))
    .toBe(initial.currency + 20);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
  expect(saved.team.map((creature: { health: number }) => creature.health)).toEqual(
    initial.team.map((c) => c.health),
  );
  expect(Object.values(saved.keywordXP).every((xp) => xp === 0)).toBe(true);
  expect(saved.reward.xp).toEqual({});
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Skip combat", exact: true })).toHaveCount(0);
  await captureScreen(page, { path: "reports/dev-skip.png" });
});

test("manual zero-Mana turns resume without losing the battle", async ({ page }) => {
  const initial = produce(victoryReady(), (draft) => {
    draft.battle!.mana = 1;
    draft.battle!.enemies.forEach((enemy) => {
      enemy.health = enemy.maxHealth;
      enemy.combat.controlled = null;
      enemy.combat.controlTurns = 0;
    });
  });
  expect(decodeSave(encodeSave(initial))).toEqual(initial);
  await page.addInitScript(() => localStorage.setItem("fauna.auto-end-turn", "false"));
  await seed(page, initial);
  await resume(page);
  await page
    .getByRole("region", { name: "Action hand" })
    .locator(`[data-card-id=${JSON.stringify(initial.battle!.hand[0])}]`)
    .click();
  await page.locator('[data-actor-id="enemy-0"] .creature-card').click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).battle.mana))
    .toBe(0);
  await page.locator(".app:not([inert])[data-save-status=saved]").waitFor();
  const committed = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
  await reloadHome(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(committed);
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).battle.turn))
    .toBe(initial.battle!.turn + 1);
});

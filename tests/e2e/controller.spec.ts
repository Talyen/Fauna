import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { run } from "../support/game";
import { seed, state, resume } from "./support/session";
import { gamepad } from "./support/gamepad";

test("manual controller prompts persist and disconnection pauses without changing progress", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const press = await gamepad(page);
  await seed(page, run());
  await page.evaluate(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Battle", exact: true }).click();
  await page.getByRole("radio", { name: "PlayStation" }).click();
  await page.reload();
  await resume(page);
  await press(13);
  await expect(page.getByRole("button", { name: "End turn · Triangle", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("playstation-battle.png") });
  await page.getByRole("button", { name: "Auto-play", exact: true }).click();
  await press(13);
  const before = await state(page);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [] }),
  );
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await expect(page.locator(".app:not([inert]) .autoplay-control")).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(800);
  expect(await state(page)).toEqual(before);
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [(window as unknown as { testPad: Gamepad }).testPad],
    }),
  );
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await press(13);
  await expect(page.getByText(/Cross selects; Circle goes back; Triangle ends the turn/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("playstation-controls.png") });
});

test("controller edges, inspect and pause do not repeat a held confirm", async ({ page }) => {
  const press = await gamepad(page);
  await seed(page, run());
  await resume(page);
  const card = page.locator('.app:not([inert]) .hand .action-card[data-effect="attack"]').first();
  await card.focus();
  await press(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card).toBeFocused();
  expect((await state(page)).revision).toBe(run().revision);
  await press(1);
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await press(1);
  await expect(card).toBeFocused();
  await press(0);
  const revision = (await state(page)).revision;
  await page.evaluate(
    () =>
      ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[0]!.pressed =
        true),
  );
  await page.waitForTimeout(500);
  await page.evaluate(
    () =>
      ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[0]!.pressed =
        false),
  );
  expect((await state(page)).revision).toBe(revision + 1);
});

test("enlarged text and keyboard/controller row navigation keep hover details and menu controls reachable", async ({
  page,
}) => {
  await seed(page, run());
  await page.evaluate(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await page.reload();
  await resume(page);
  const card = page.locator(".app:not([inert]) .hand .action-card").first();
  await card.focus();
  await page.keyboard.press("w");
  await expect(page.locator(".app:not([inert]) .player-row .creature-card:focus")).toHaveCount(1);
  await page.keyboard.press("w");
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card:focus")).toHaveCount(1);
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  const close = page.getByRole("button", { name: "Open menu", exact: true });
  await expect(close).toBeVisible();
  await close.click();
  await expect(page.getByRole("button", { name: "Glossary", exact: true })).toBeFocused();
});

test("controller navigation preserves its device mode and can confirm a pointer-selected card", async ({
  page,
}) => {
  const press = await gamepad(page);
  const fixture = produce(run(7), (d) => {
    const attacks = d.cards.filter((c) =>
      ["emberback-attack", "prismram-attack", "prismram-spectrum-lance"].includes(c.definitionId),
    );
    d.battle!.hand = attacks.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !attacks.some((a) => a.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  await page.getByRole("button", { name: "Physical talents", exact: true }).focus();
  await press(15);
  await expect(page.getByRole("button", { name: "Burn talents", exact: true })).toBeFocused();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "controller");
  await press(1);
  await resume(page);
  await page.locator(".app:not([inert]) .hand .action-card").first().click();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  const selected = page.locator(".app:not([inert]) .hand .action-card.selected");
  await expect(selected).toHaveCSS("outline-style", "none");
  expect(await selected.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  const before = await state(page);
  await press(0);
  expect((await state(page)).revision).toBe(before.revision + 1);
  await expect(page.locator(".app:not([inert]) .hand .action-card").first()).toBeFocused();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "controller");
});

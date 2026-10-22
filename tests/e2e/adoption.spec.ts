import { LAYOUT_CASES, REVIEW_VIEWPORTS } from "./support/layout-contract";
import { captureScreen } from "./support/rendered-evidence";
import { test, expect } from "@playwright/test";
import { SPECIES } from "../../src/game/content";
test("switch thumbs stay within their tracks in both states", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  const sound = page.getByRole("switch", { name: "Sound", exact: true });
  for (const checked of [true, false, true]) {
    await sound.setChecked(checked);
    await expect
      .poll(() =>
        sound.evaluate((el) => {
          const root = el.getBoundingClientRect();
          const thumb = el.querySelector("span")!.getBoundingClientRect();
          return {
            hit: [root.width, root.height],
            thumb: [thumb.width, thumb.height],
            offset: Math.round(thumb.left - root.left),
          };
        }),
      )
      .toEqual({ hit: [44, 44], thumb: [16, 16], offset: checked ? 22 : 6 });
  }
});
test("Collection filtering, audio preferences, and settings remain menu-driven", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.getByRole("tab", { name: "Uncollected", exact: true }).click();
  const firstPage = await page.getByRole("img", { name: "Locked species" }).count();
  expect(firstPage).toBeGreaterThan(0);
  for (let offset = firstPage; offset < SPECIES.length; offset += firstPage) {
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByRole("img", { name: "Locked species" })).toHaveCount(
      Math.min(firstPage, SPECIES.length - offset),
    );
  }
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Collection", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await page.getByRole("slider", { name: "Master volume", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByLabel("Master volume value", { exact: true })).toHaveText("40%");
  await page.getByRole("switch", { name: "Mute in background", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Diagnostics", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy diagnostics", exact: true })).toHaveCount(0);
  await captureScreen(page, { path: "reports/adoption-settings.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await expect(page.getByLabel("Master volume value", { exact: true })).toHaveText("40%");
  await expect(page.getByRole("switch", { name: "Mute in background", exact: true })).not.toBeChecked();
});

test("settings categories remain reachable at minimum size with enlarged text", async ({ page }) => {
  const [width, height, textScale] = [1280, 720, "1.25"] as const;
  await page.setViewportSize({ width, height });
  await page.addInitScript((scale) => localStorage.setItem("fauna.text-scale", scale), textScale);
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const category of ["Display", "Sound", "Battle"]) {
    await page.getByRole("tab", { name: category, exact: true }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toBeVisible();
    const control =
      category === "Display"
        ? panel.getByRole("radio", { name: "125%", exact: true })
        : category === "Sound"
          ? panel.getByRole("switch", { name: "Mute in background", exact: true })
          : panel.getByRole("switch", { name: "Auto-end turn", exact: true });
    await expect(control).toBeInViewport();
    if (category === "Sound") {
      for (const slider of await panel.locator(".ui-slider").all()) {
        const bounds = (await slider.boundingBox())!;
        expect(bounds.width).toBeGreaterThanOrEqual(88);
        await slider.click({ position: { x: bounds.width * 0.75, y: bounds.height / 2 } });
        await expect
          .poll(async () => Number(await slider.getByRole("slider").getAttribute("aria-valuenow")))
          .toBeGreaterThan(50);
      }
    }
    await captureScreen(page, { path: `reports/settings-${category.toLowerCase()}-${width}.png` });
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
});

for (const [width, height] of REVIEW_VIEWPORTS)
  test(`illustrated Boons and independent tooltip sizing at ${width}×${height}`, async ({ page }) => {
    const { run } = await import("../support/game");
    const fixture = structuredClone(run(7));
    const { BOONS } = await import("../../src/game/content");
    fixture.boons = BOONS.map((boon) => boon.id);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate((data) => localStorage.setItem("fauna.save.v1", data), JSON.stringify(fixture));
    await page.reload();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("radio", { name: "125%", exact: true }).click();
    await page.getByRole("radio", { name: "Tooltip 125%", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    const art = page.getByRole("button", { name: "Inspect Mossguard", exact: true });
    await art.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    expect(await page.getByRole("tooltip").evaluate((node) => getComputedStyle(node).fontSize)).toBe("20px");
    expect(await art.evaluate((node) => node.getBoundingClientRect().width)).toBeCloseTo(
      height <= 760 ? 213.333 : height <= 900 ? 240 : 266.667,
      0,
    );
    await captureScreen(page, { path: `reports/tooltip-independent-${width}-${height}.png` });
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const opener = page.getByRole("button", { name: "Boons", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Boons", exact: true });
    await expect(dialog.getByRole("heading", { name: "Tattered Pages", exact: true })).toBeVisible();
    await expect(dialog).toContainText("Restore 3 Health when you defeat an enemy");
    await dialog
      .locator("img")
      .evaluateAll((images) => Promise.all(images.map((img) => (img as HTMLImageElement).decode())));
    expect(
      await dialog
        .locator(".action-card")
        .first()
        .evaluate((node) => node.getBoundingClientRect().width),
    ).toBeCloseTo(height <= 760 ? 160 : height <= 900 ? 180 : 200, 0);
    await captureScreen(page, { path: `reports/owned-boons-${width}-${height}.png` });
    for (let index = 2; index < BOONS.length; index += 2) {
      await dialog.getByRole("button", { name: "Next page" }).click();
      for (const boon of BOONS.slice(index, index + 2)) {
        await expect(dialog.getByRole("heading", { name: boon.name, exact: true })).toBeInViewport();
        await expect(dialog).toContainText(boon.text);
      }
      await captureScreen(page, { path: `reports/owned-boons-page-${index / 2}-${width}-${height}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(fixture);
    await page.reload();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Tooltip 125%", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  });

for (const [width, height, scale] of LAYOUT_CASES)
  test(`Boon Merchant shelf and purchase resume at ${width}×${height}, text ${scale}`, async ({ page }) => {
    const { accept, winBattle, recruitChoice } = await import("../support/game");
    const { createGame } = await import("../../src/game/engine");
    let fixture = accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
      type: "start",
    });
    fixture = winBattle(accept(fixture, { type: "beginBattle" }));
    fixture = accept(fixture, recruitChoice(fixture));
    const visit = fixture.support!.id;
    const slot = fixture.support!.stock[0]!;
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ save, scale }) => {
        if (!localStorage.getItem("fauna.save.v1")) localStorage.setItem("fauna.save.v1", save);
        localStorage.setItem("fauna.text-scale", String(scale));
      },
      { save: JSON.stringify(fixture), scale },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Visit Boon Merchant", exact: true }).click();
    const entered = accept(fixture, { type: "enterSupport", visit });
    await expect(page.getByRole("heading", { name: "Boon Merchant", exact: true })).toBeVisible();
    await expect(page.getByText("Limit 1 per customer", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy .+ for 20 Gold$/ })).toHaveCount(3);
    await captureScreen(page, { path: `reports/boon-merchant-shelf-${width}.png`, fullPage: true });
    await page
      .getByRole("button", { name: /^Buy .+ for 20 Gold$/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Boon received", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
    const purchased = accept(entered, { type: "buyBoon", visit, slot: slot.slot });
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(purchased);
    await captureScreen(page, { path: `reports/merchant-${width}.png`, fullPage: true });
    await page.reload();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Boon received", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Purchased Boon" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(purchased);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("button", { name: "Visit Boon Merchant", exact: true })).toHaveCount(0);
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
    expect(saved).toEqual(accept(purchased, { type: "leaveSupport", visit }));
    expect(saved.currency).toBe(0);
    expect(saved.journey.currency).toBe(20);
    expect(saved.expedition.lastRoom).toBe("merchant");
    expect(saved.rng).not.toBe(purchased.rng);
    expect(saved.support).toBeNull();
  });

test("Settings panel switches preserve screen, tab and icon geometry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  const dialog = page.getByRole("main", { name: "Settings", exact: true });
  const tabs = ["Display", "Sound", "Battle"].map((name) => dialog.getByRole("tab", { name, exact: true }));
  const geometry = async () =>
    Promise.all([
      dialog.boundingBox(),
      ...tabs.map((tab) => tab.boundingBox()),
      ...tabs.map((tab) => tab.locator("svg").boundingBox()),
    ]);
  for (const scale of ["100%", "125%", "75%"] as const) {
    await tabs[0]!.click();
    await dialog.getByRole("radio", { name: scale, exact: true }).click();
    const before = await geometry();
    for (const tab of [...tabs.slice(1), tabs[0]!]) {
      await tab.click();
      expect(await geometry()).toEqual(before);
      await expect(dialog.getByRole("tabpanel")).toBeVisible();
      await expect(dialog.getByRole("tabpanel")).toHaveCSS("animation-name", "none");
      for (const panel of await dialog.locator('.settings-panel[data-state="inactive"]').all()) {
        await expect(panel).toBeHidden();
        await expect(panel).toHaveAttribute("inert", "");
        await expect(panel).toHaveAttribute("aria-hidden", "true");
      }
    }
  }
});

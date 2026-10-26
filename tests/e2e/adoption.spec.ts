import { expectControlColors } from "./support/control-colors";
import { LAYOUT_CASES, REVIEW_VIEWPORTS } from "./support/layout-contract";
import { captureScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { openHome, reloadHome, test, seed, state } from "./support/session";
for (const [width, height] of REVIEW_VIEWPORTS)
  test(`illustrated Boons and independent tooltip sizing at ${width}×${height}`, async ({ page }) => {
    const { run } = await import("../support/game");
    const fixture = structuredClone(run(7));
    const { BOONS } = await import("../../src/game/content");
    fixture.boons = BOONS.map((boon) => boon.id);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, fixture);
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
      height <= 760 ? 234.667 : height <= 900 ? 264 : 293.333,
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
    const exhaustive = width === 1280 && height === 720;
    for (let index = 2; index < BOONS.length; index += 2) {
      await dialog.getByRole("button", { name: "Next page" }).click();
      // Every page is reachable; exhaustive content/geometry belongs to minimum size.
      if (!exhaustive && index + 2 < BOONS.length) continue;
      for (const boon of BOONS.slice(index, index + 2)) {
        await expect(dialog.getByRole("heading", { name: boon.name, exact: true })).toBeInViewport();
        await expect(dialog).toContainText(boon.text);
      }
      await captureScreen(page, { path: `reports/owned-boons-page-${index / 2}-${width}-${height}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(fixture);
    if (exhaustive) {
      await reloadHome(page);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await expect(page.getByRole("radio", { name: "Tooltip 125%", exact: true })).toBeChecked();
      await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
    }
  });

for (const [width, height, scale] of LAYOUT_CASES)
  test(`Boon Merchant shelf and purchase resume at ${width}×${height}, text ${scale}`, async ({ page }) => {
    const { accept, merchantDestination } = await import("../support/game");
    const fixture = merchantDestination();
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
    await openHome(page);
    await expectControlColors(
      page.getByRole("button", { name: "Continue", exact: true }),
      "--primary-foreground",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Visit Boon Merchant", exact: true }).click();
    const entered = accept(fixture, { type: "enterSupport", visit });
    await expect(page.getByRole("heading", { name: "Boon Merchant", exact: true })).toBeVisible();
    await expect(page.getByText("Limit 1 per customer - No Refunds!", { exact: true })).toBeVisible();
    await expect(page.locator(".merchant-policy em")).toHaveText("Limit 1 per customer - No Refunds!");
    await expect(page.locator(".merchant-policy em")).toHaveCSS("font-style", "italic");
    const row = await page.locator(".merchant-heading .screen-heading").boundingBox();
    const wallet = await page.locator(".merchant-wallet").boundingBox();
    expect(wallet!.y).toBeGreaterThanOrEqual(row!.y);
    expect(wallet!.y + wallet!.height).toBeLessThanOrEqual(row!.y + row!.height);
    await expect(page.getByRole("button", { name: /^Buy .+ for \d+ Gold$/ })).toHaveCount(3);
    await expect(page.locator(".merchant-offer h2, .merchant-offer > p:not(.merchant-status)")).toHaveCount(
      0,
    );
    for (const control of await page.getByRole("button", { name: /^Buy / }).all()) {
      await expectControlColors(control, "--foreground");
    }
    await captureScreen(page, { path: `reports/boon-merchant-shelf-${width}.png`, fullPage: true });
    await page
      .getByRole("button", { name: /^Buy .+ for \d+ Gold$/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Boon received", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
    const purchased = accept(entered, { type: "buyBoon", visit, slot: slot.slot });
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(purchased);
    await captureScreen(page, { path: `reports/merchant-${width}.png`, fullPage: true });
    if (width === 1280 && height === 720 && scale === 1.25) {
      // Save/resume is viewport independent; keep it once alongside all shelf/receipt layouts.
      await reloadHome(page);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Boon received", exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: "Purchased Boon" })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
      expect(await state(page)).toEqual(purchased);
    }
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("button", { name: "Visit Boon Merchant", exact: true })).toHaveCount(0);
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
    expect(saved).toEqual(accept(purchased, { type: "leaveSupport", visit }));
    expect(saved.currency).toBe(fixture.currency - slot.price);
    expect(saved.journey.currency).toBe(20);
    expect(saved.expedition.lastRoom).toBe("merchant");
    expect(saved.rng).not.toBe(purchased.rng);
    expect(saved.support).toBeNull();
  });

test("Settings panel switches preserve screen, tab and icon geometry", async ({ page }) => {
  await openHome(page);
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

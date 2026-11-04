import { expectControlColors } from "./support/control-colors";
import { expectScrollFree, LAYOUT_CASES, REVIEW_VIEWPORTS } from "./support/layout-contract";
import { captureFrame, settleScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { reloadHome, test, seed, state } from "./support/session";
import { merchantDestination, run } from "../support/game";
import { BOONS } from "../../src/game/content";

test("unaffordable Merchant details leave the price and exit visible", async ({ page }) => {
  const fixture = structuredClone(merchantDestination());
  fixture.currency = Math.min(...fixture.support!.stock.map((entry) => entry.price));
  const unavailable = fixture.support!.stock.findIndex((entry) => entry.price > fixture.currency);
  expect(unavailable).toBeGreaterThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, fixture);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Visit Boon Merchant", exact: true }).click();
  const offer = page.getByRole("button", { name: /^Buy / }).nth(unavailable);
  await offer.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Not enough Gold");
  const tooltipBox = await tooltip.boundingBox();
  const priceBox = await page
    .locator(".merchant-offer")
    .nth(unavailable)
    .locator(".merchant-price")
    .boundingBox();
  const leaveBox = await page.getByRole("button", { name: "Leave", exact: true }).boundingBox();
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThan(priceBox!.y);
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThan(leaveBox!.y);
  const before = await state(page);
  await offer.focus();
  await page.keyboard.press("Enter");
  expect(await state(page)).toEqual(before);
});

for (const [width, height] of REVIEW_VIEWPORTS)
  test(`illustrated Boons remain readable and return focus at ${width}×${height}`, async ({ page }) => {
    const fixture = structuredClone(run(7));
    fixture.boons = BOONS.map((boon) => boon.id);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
    await seed(page, fixture);
    const opener = page.getByRole("button", { name: "Boons", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Boons", exact: true });
    const exhaustive = width === 1280 && height === 720;
    for (let index = 0; index < BOONS.length; index += 2) {
      if (index > 0) await dialog.getByRole("button", { name: "Next page" }).click();
      // Every page is reachable; exhaustive content/geometry belongs to minimum size.
      if (!exhaustive && index > 0 && index + 2 < BOONS.length) continue;
      for (const boon of BOONS.slice(index, index + 2)) {
        await expect(dialog.getByRole("heading", { name: boon.name, exact: true })).toBeInViewport();
        await expect(dialog).toContainText(boon.text);
      }
      await settleScreen(page);
      await dialog
        .locator("img")
        .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
      await expectScrollFree(page);
      if (index === 0 || index + 2 >= BOONS.length)
        await captureFrame(page, {
          path: `reports/owned-boons${index === 0 ? "" : "-last"}-${width}-${height}.png`,
        });
    }
    await expect(dialog.getByRole("button", { name: "Next page" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    expect(await state(page)).toEqual(fixture);
  });

// Split the layouts into two journeys so CI can distribute them without repeating every purchase.
for (const [group, layouts] of [
  ["compact", LAYOUT_CASES.slice(0, 3)],
  ["wide", LAYOUT_CASES.slice(3)],
] as const)
  test(`Boon Merchant shelf and purchase across ${group} layouts`, async ({ page }) => {
    const fixture = merchantDestination();
    const slot = fixture.support!.stock[0]!;
    const boon = BOONS.find((entry) => entry.id === slot.boon)!;
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, fixture);
    await expectControlColors(
      page.getByRole("button", { name: "Continue", exact: true }),
      "--primary-foreground",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Visit Boon Merchant", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Boon Merchant", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy .+ for \d+ Gold$/ })).toHaveCount(3);
    await expect(page.locator(".merchant-offer h2, .merchant-offer > p:not(.merchant-status)")).toHaveCount(
      0,
    );
    const inspectLayouts = async (name: string, check?: () => Promise<void>) => {
      for (const [width, height, scale] of layouts) {
        await page.setViewportSize({ width, height });
        await page
          .locator("html")
          .evaluate((el, value) => el.style.setProperty("--text-scale", String(value)), scale);
        await settleScreen(page);
        await check?.();
        await expectScrollFree(page);
        await captureFrame(page, {
          path: `reports/${name}-${width}-${height}-${scale}.png`,
          fullPage: true,
        });
      }
    };
    await inspectLayouts("boon-merchant-shelf", async () => {
      const row = await page.locator(".merchant-heading .screen-heading").boundingBox();
      const wallet = await page.locator(".merchant-wallet").boundingBox();
      expect(wallet!.y).toBeGreaterThanOrEqual(row!.y);
      expect(wallet!.y + wallet!.height).toBeLessThanOrEqual(row!.y + row!.height);
    });
    await page.getByRole("button", { name: `Buy ${boon.name} for ${slot.price} Gold`, exact: true }).click();
    await expect(page.locator(".merchant-purchase-feedback")).toContainText(boon.name);
    await expect(page.locator(".merchant-purchase-feedback")).toContainText(`${slot.price} Gold`);
    await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
    const purchased = await state(page);
    expect(purchased.currency).toBe(fixture.currency - slot.price);
    expect(purchased.boons).toEqual([...fixture.boons, slot.boon]);
    expect(purchased.support).toBeNull();
    expect(purchased.phase).toBe("teamSelection");
    await inspectLayouts("merchant-returned");
    expect(await state(page)).toEqual(purchased);
    if (group === "compact") {
      // Save/resume is viewport independent; retain it once across all layouts.
      await reloadHome(page);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
      expect(await state(page)).toEqual(purchased);
    }
    await expect(page.getByRole("button", { name: "Visit Boon Merchant", exact: true })).toHaveCount(0);
    const saved = await state(page);
    expect(saved.boons).toEqual(purchased.boons);
    expect(saved.phase).toBe("teamSelection");
    expect(saved.currency).toBe(fixture.currency - slot.price);
    expect(saved.journey!.currency).toBe(20);
    expect(saved.expedition!.lastRoom).toBe("merchant");
    expect(saved.rng).not.toBe(fixture.rng);
    expect(saved.support).toBeNull();
  });

test("Settings panel switches preserve screen, tab and icon geometry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, run());
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
  await page.getByRole("radio", { name: "125%", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const art = page.getByRole("button", { name: "Inspect Mossguard", exact: true });
  await settleScreen(page);
  const before = await art.boundingBox();
  await art.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const fontSize = await tooltip.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Tooltip 125%", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await settleScreen(page);
  expect(await art.boundingBox()).toEqual(before);
  await art.hover();
  await expect(tooltip).toBeVisible();
  expect(await tooltip.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(
    fontSize * 1.25,
  );
  await reloadHome(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Tooltip 125%", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
});

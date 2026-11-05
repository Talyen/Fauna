import { changePage } from "./support/pagination";
import { expect } from "@playwright/test";
import { BOONS } from "../../src/game/content";
import { assetUrl } from "../../src/ui/shared/assets";
import { createGame } from "../../src/game/engine";
import { test, openHome, seed } from "./support/session";

test("cold artwork and a delayed decode retain the whole previous page and respect cancellation", async ({
  page,
}) => {
  const path = assetUrl(`boon.${BOONS[0]!.id}`).slice(1);
  await page.addInitScript((path) => {
    const decode = HTMLImageElement.prototype.decode;
    const state = window as unknown as {
      releaseArtwork: () => void;
      artworkDecodeStarted: boolean;
      incompleteFrames: string[];
    };
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.releaseArtwork = release;
    state.incompleteFrames = [];
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.src.endsWith(path)) {
        state.artworkDecodeStarted = true;
        await held;
      }
    };
    const inspect = () => {
      for (const image of document.querySelectorAll("#root img")) {
        if (
          image instanceof HTMLImageElement &&
          image.checkVisibility() &&
          (!image.complete || !image.naturalWidth)
        )
          state.incompleteFrames.push(image.src);
      }
      requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  }, path);
  await openHome(page);
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Fauna", exact: true })).toHaveAttribute("data-state", "active");
  await page.getByRole("tab", { name: "Boons", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { artworkDecodeStarted: boolean }).artworkDecodeStarted),
    )
    .toBe(true);
  await expect(page.getByRole("tab", { name: "Fauna", exact: true })).toHaveAttribute("data-state", "active");
  await expect(page.locator(".collection-grid[data-view='fauna']")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  await page.evaluate(() => (window as unknown as { releaseArtwork: () => void }).releaseArtwork());
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.getByRole("tab", { name: "Boons", exact: true }).click();
  await expect(page.locator(".collection-grid[data-view='boons']")).toBeVisible();
  await changePage(page.locator(".collection-screen"));
  await expect(page.getByRole("button", { name: "Previous page", exact: true })).toBeEnabled();
  expect(
    await page.evaluate(() => (window as unknown as { incompleteFrames: string[] }).incompleteFrames),
  ).toEqual([]);
});

test("Play retains the menu until the newly rolled starter artwork is ready", async ({ page }) => {
  const initial = createGame(7);
  const nextSeed = 104729;
  const next = createGame(nextSeed);
  const unseen = next.starterOffers.find((kind) => !initial.starterOffers.includes(kind));
  if (!unseen) throw new Error("The fixture must roll a new starter");
  const path = assetUrl(`creature.${unseen}`).slice(1);
  await page.clock.setFixedTime(new Date(nextSeed));
  await page.addInitScript((path) => {
    const decode = HTMLImageElement.prototype.decode;
    const state = window as unknown as { releaseStarter: () => void; starterHeld: boolean };
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.releaseStarter = release;
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.src.endsWith(path)) {
        state.starterHeld = true;
        await held;
      }
    };
  }, path);
  await seed(page, initial);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { starterHeld: boolean }).starterHeld))
    .toBe(true);
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Recruit / })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { releaseStarter: () => void }).releaseStarter());
  await expect(page.locator(".app:not([inert]) .play-surface")).toBeVisible();
  expect(
    await page
      .locator(".app:not([inert]) .draft-grid .creature-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("data-species"))),
  ).toEqual(next.starterOffers);
});

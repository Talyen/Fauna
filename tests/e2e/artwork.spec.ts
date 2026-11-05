import { expect } from "@playwright/test";
import { BOONS } from "../../src/game/content";
import { assetUrl } from "../../src/ui/shared/assets";
import { test, openHome } from "./support/session";

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
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByRole("button", { name: "Previous page", exact: true })).toBeEnabled();
  expect(
    await page.evaluate(() => (window as unknown as { incompleteFrames: string[] }).incompleteFrames),
  ).toEqual([]);
});

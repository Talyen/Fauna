import { expectScrollFree } from "./layout-contract";
import { expect, test, type Page } from "@playwright/test";

/** Wait for navigation copies and finite visual transitions to settle before measuring. */
export async function settleScreen(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator("body > .app[inert], .card-transfer")).toHaveCount(0);
  // Sample in the renderer each frame instead of making a driver round trip per sample.
  // Rediscovery retains replacement/cancelled transitions; infinite decoration never blocks capture.
  const settled = await page.waitForFunction(
    () =>
      !document
        .getAnimations()
        .some(
          (animation) =>
            (animation.playState === "running" || animation.pending) &&
            animation.effect?.getComputedTiming().iterations !== Infinity,
        ),
    undefined,
    { polling: "raf", timeout: 5000 },
  );
  await settled.dispose();
}

/** Capture the settled screen, not an outgoing decorative navigation snapshot. */
export async function captureScreen(page: Page, options: Parameters<Page["screenshot"]>[0]) {
  await settleScreen(page);
  await expectScrollFree(page);
  return captureFrame(page, options);
}

/** Attach frames to their owning test so shard reports keep distinct evidence paths. */
export async function captureFrame(page: Page, options: Parameters<Page["screenshot"]>[0]) {
  const name = String(options?.path ?? "screen.png").replace(/[^a-zA-Z0-9_.-]/g, "_");
  const file = test.info().outputPath(`${test.info().attachments.length}-${name}`);
  // Screenshots wait for fonts, but loading or broken artwork can otherwise pass unnoticed.
  await page
    .locator("img:visible")
    .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
  const result = await page.screenshot({ ...options, path: file });
  await test.info().attach(name, { path: file, contentType: "image/png" });
  return result;
}

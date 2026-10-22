import { expectScrollFree } from "./layout-contract";
import { expect, test, type Page } from "@playwright/test";

/** Wait for navigation copies and finite visual transitions to settle before measuring. */
export async function settleScreen(page: Page) {
  await expect(page.locator("body > .app[inert], .card-transfer")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === "running" &&
                animation.effect?.getComputedTiming().iterations !== Infinity,
            ).length,
      ),
    )
    .toBe(0);
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
  const result = await page.screenshot({ ...options, path: file });
  await test.info().attach(name, { path: file, contentType: "image/png" });
  return result;
}

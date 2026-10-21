import { expectScrollFree } from "./layout-contract";
import { expect, type Page } from "@playwright/test";

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
  return page.screenshot(options);
}

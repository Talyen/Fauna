import { test, expect, type Page } from "@playwright/test";
import { feedbackBattle } from "../unit/helpers";
import { encodeSave } from "../../src/game/save";

async function freezeFeedback(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      if (target instanceof Element && target.closest(".combat-feedback")) {
        animation.pause();
        animation.currentTime = 180;
      }
    }
  });
  await page.clock.runFor(32);
}
async function expectReadable(page: Page) {
  const bounds = await page
    .locator('.combat-burst:not([data-evicted="true"]) .combat-number')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => getComputedStyle(node).visibility === "visible")
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            width: innerWidth,
            height: innerHeight,
          };
        }),
    );
  expect(bounds.length).toBeGreaterThan(0);
  for (const box of bounds) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.width);
    expect(box.bottom).toBeLessThanOrEqual(box.height);
  }
  for (const [index, box] of bounds.entries())
    for (const other of bounds.slice(index + 1))
      expect(
        box.x >= other.right || box.right <= other.x || box.y >= other.bottom || box.bottom <= other.y,
        "Floating values should not overlap",
      ).toBe(true);
}
for (const [width, scale, reduced] of [
  [1280, "1", false],
  [1280, "1.25", true],
  [1920, "1.25", false],
  [1920, "1", true],
] as const) {
  test(`floating combat feedback at ${width}, text ${scale}, reduced ${reduced}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    const game = feedbackBattle();
    const save = encodeSave(game);
    await page.addInitScript(
      ({ save, scale }) => {
        localStorage.setItem("fauna.save.v1", save);
        localStorage.setItem("fauna.text-scale", scale);
        localStorage.setItem("fauna.auto-end-turn", "false");
        localStorage.setItem("fauna.audio.v1", JSON.stringify({ enabled: false }));
      },
      { save, scale },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator(".enemy-row .creature-card")).toHaveCount(3);
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.locator(".hand .action-card").click();
    await page.locator('[data-actor-id="enemy-0"] .creature-card').click();
    await page.clock.runFor(200);
    await expect(page.locator('.combat-number[data-critical="true"]')).toHaveCount(1);
    await expect(page.locator('.combat-numbers[data-columns="2"]')).toHaveCount(1);
    await freezeFeedback(page);
    await expectReadable(page);
    // These screenshots intentionally capture active feedback rather than a settled screen.
    await page.screenshot({ path: `reports/combat-feedback-${width}-${scale}-${reduced}.png` });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.runFor(32);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.runFor(32);
    expect(
      await page
        .locator(".combat-numbers")
        .evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).animationName === "none")),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.clock.runFor(1200);
    await expect(page.locator(".combat-burst")).toHaveCount(0);
    await page.getByRole("button", { name: "End turn", exact: true }).click();
    await page.clock.runFor(650);
    await freezeFeedback(page);
    await expectReadable(page);
    await page.screenshot({ path: `reports/combat-feedback-turn-${width}-${scale}-${reduced}.png` });
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator(".combat-feedback")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.clock.runFor(1500);
    await expect(page.locator(".combat-feedback")).toHaveCount(0);
  });
}

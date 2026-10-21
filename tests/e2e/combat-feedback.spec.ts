import { expectScrollFree, REVIEW_VIEWPORTS } from "./layout-contract";
import { test, expect, type Page } from "@playwright/test";
import { feedbackBattle } from "../unit/helpers";
import { encodeSave } from "../../src/game/save";

async function freezeFeedback(page: Page, time = 180) {
  await page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      if (target instanceof Element && target.closest(".combat-feedback")) {
        animation.pause();
        animation.currentTime = time;
      }
    }
  }, time);
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
for (const [width, height] of REVIEW_VIEWPORTS)
  for (const [scale, reduced] of [
    ["1", false],
    ["1", true],
    ["1.25", false],
    ["1.25", true],
  ] as const) {
    test(`floating combat feedback at ${width}×${height}, text ${scale}, reduced ${reduced}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
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
      const composition = await page.locator(".battle-screen").evaluate((board) => {
        const rows = [...board.querySelectorAll(".enemy-row, .player-row")].map((row) => {
          const cards = [...row.querySelectorAll(".creature-card")].map((card) =>
            card.getBoundingClientRect(),
          );
          return (cards[0]!.left + cards.at(-1)!.right) / 2;
        });
        const frames = [...board.querySelectorAll(".creature-wrap")].map((wrap) => {
          const card = wrap.querySelector(".creature-card")!.getBoundingClientRect();
          const health = wrap.querySelector(".health-forecast")!.getBoundingClientRect();
          const icons = [...wrap.querySelectorAll(".status-icon")].map((icon) =>
            icon.getBoundingClientRect(),
          );
          return {
            healthInside: health.left >= card.left && health.right <= card.right,
            healthBottom: card.bottom - health.bottom,
            healthHeight: health.height,
            iconsBelow: icons.every((icon) => icon.top >= card.bottom),
          };
        });
        return { rows, frames, center: innerWidth / 2 };
      });
      for (const center of composition.rows)
        expect(Math.abs(center - composition.center)).toBeLessThanOrEqual(1);
      for (const frame of composition.frames) {
        expect(frame.healthInside).toBe(true);
        expect(frame.healthBottom).toBeCloseTo(1, 0);
        expect(frame.healthHeight).toBe(4);
        expect(frame.iconsBelow).toBe(true);
      }
      const origin = Date.UTC(2026, 0, 1);
      await page.clock.install({ time: origin });
      await page.clock.pauseAt(origin + 60_000);
      await page.locator(".hand .action-card").click();
      await page.locator('[data-actor-id="enemy-0"] .creature-card').click();
      await page.clock.runFor(200);
      await expect(page.locator('.combat-number[data-critical="true"]')).toHaveCount(1);
      await expect(page.locator('.combat-numbers[data-columns="2"]')).toHaveCount(1);
      await freezeFeedback(page);
      await expectReadable(page);
      // These screenshots intentionally capture active feedback rather than a settled screen.
      await expectScrollFree(page);
      await page.screenshot({ path: `reports/combat-feedback-${width}-${height}-${scale}-${reduced}.png` });
      if (!reduced) {
        await freezeFeedback(page, 900);
        await expectReadable(page);
        await expectScrollFree(page);
        await page.screenshot({ path: `reports/combat-feedback-rise-${width}-${height}-${scale}.png` });
      }
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
      expect(await page.locator(".battle-screen").evaluate((node) => node.scrollTop)).toBe(0);
      await page.clock.runFor(650);
      await freezeFeedback(page);
      await expectReadable(page);
      await expectScrollFree(page);
      await page.screenshot({
        path: `reports/combat-feedback-turn-${width}-${height}-${scale}-${reduced}.png`,
      });
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.locator(".combat-feedback")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.clock.runFor(1500);
      await expect(page.locator(".combat-feedback")).toHaveCount(0);
    });
  }

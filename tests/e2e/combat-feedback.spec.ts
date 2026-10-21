import { test, expect, type Page } from "@playwright/test";
import { produce } from "immer";
import { accept, teamRun } from "../unit/helpers";
import { combat } from "../../src/game/combat";
import { decodeSave, encodeSave } from "../../src/game/save";

function feedbackBattle() {
  const battle = accept(
    produce(teamRun(42, ["mossback", "briartooth", "stormfin"]), (game) => {
      game.phase = "teamSelection";
      game.encounter = 6;
      game.battle = null;
      game.expedition = null;
    }),
    { type: "beginBattle" },
  );
  return produce(battle, (game) => {
    game.rng = 1;
    const attack = game.cards.find((card) => card.definitionId === "briartooth-attack")!;
    game.battle!.hand = [attack.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => card.id !== attack.id).map((card) => card.id);
    const actor = game.team.find((creature) => creature.id === attack.ownerId)!;
    actor.health -= 5;
    combat(actor).riposte = true;
    combat(actor).partingCut = true;
    const target = game.battle!.enemies[0]!;
    target.block = 4;
    target.combat.armor = 0;
    target.combat.thorns = 1;
  });
}
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
    expect(decodeSave(save)).toEqual(game);
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

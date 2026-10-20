import { test, expect, type Page } from "@playwright/test";
import { produce } from "immer";
import { accept, run, victoryReady } from "../unit/helpers";
import { encodeSave } from "../../src/game/save";
async function seed(page: Page, initial: string, scale: string) {
  await page.addInitScript(
    ({ initial, scale }) => {
      localStorage.setItem("fauna.save.v1", initial);
      localStorage.setItem("fauna.text-scale", scale);
      localStorage.setItem("fauna.audio.v1", JSON.stringify({ enabled: false }));
    },
    { initial, scale },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
for (const width of [1280, 1920]) {
  test(`combat preferences, autoplay pause and manual takeover at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: width === 1280 ? "reduce" : "no-preference" });
    await seed(page, encodeSave(run()), width === 1280 ? "1.5" : "1");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Battle", exact: true }).click();
    const setting = page.getByRole("switch", { name: "Auto-end turn", exact: true });
    await expect(setting).toBeChecked();
    await setting.focus();
    await page.keyboard.press("Space");
    await expect(setting).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("fauna.auto-end-turn"))).toBe("false");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `reports/controls-settings-${width}.png` });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    const autoplay = page.getByRole("switch", { name: "Auto-play", exact: true });
    await autoplay.click();
    await page.getByRole("button", { name: "Open menu" }).click();
    const revision = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision)).toBe(
      revision,
    );
    await page.keyboard.press("Escape");
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision))
      .toBeGreaterThan(revision);
    await page.locator(".hand .action-card:not([aria-disabled=true])").first().click();
    await expect(autoplay).not.toBeChecked();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `reports/controls-battle-${width}.png` });
    await expect(page.getByRole("button", { name: "Skip combat", exact: true })).toHaveCount(0);
    // Browser controller simulation exercises the same semantic action as physical Y.
    await page.evaluate(() => {
      const pad = {
        mapping: "standard",
        connected: true,
        index: 0,
        axes: [0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
      };
      Object.defineProperty(navigator, "getGamepads", { value: () => [pad], configurable: true });
      (window as unknown as { controlPad: typeof pad }).controlPad = pad;
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      (
        window as unknown as { controlPad: { buttons: { pressed: boolean }[] } }
      ).controlPad.buttons[3]!.pressed = true;
    });
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision))
      .toBeGreaterThan(revision + 1);
  });
  test(`live unlock reveal is inspectable and does not repeat at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const final = victoryReady(
      accept(
        produce(run(), (d) => {
          d.encounter = 7;
          d.phase = "teamSelection";
          d.battle = null;
          d.journey = { outcome: null, victories: 7, currency: 0, xp: {}, unlocks: [], lastBattle: null };
          d.expedition = { biome: 1, step: 3, offers: [{ location: "moonwell", pack: 0 }], chosen: null };
        }),
        { type: "beginBattle" },
      ),
    );
    await seed(page, encodeSave(final), width === 1280 ? "1.5" : "1");
    await page.locator(`[data-card-id=${JSON.stringify(final.battle!.hand[0])}]`).click();
    await page.locator('[data-actor-id="enemy-0"] .creature-card').click();
    await page.getByRole("heading", { name: "Journey complete" }).waitFor();
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Creature unlocked" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Moonhart", exact: true })).toBeVisible();
    await page.screenshot({ path: `reports/unlock-${width}.png` });
    await page.getByRole("button", { name: "Inspect Moonhart", exact: true }).click();
    await expect(page.locator(".inspection-thumbnails .action-card")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Journey results", exact: true }).click();
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Creature unlocked" })).toHaveCount(0);
  });
}

test("development skip wins once through normal rewards", async ({ page }) => {
  test.skip(process.env.FAUNA_DEV_REVIEW !== "1", "Requires an explicitly owned development preview.");
  const initial = run();
  await seed(page, encodeSave(initial), "1");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Skip combat", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose a Recruit" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).currency))
    .toBe(initial.currency + 20);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
  expect(saved.team.map((creature: { health: number }) => creature.health)).toEqual(
    initial.team.map((c) => c.health),
  );
  expect(Object.values(saved.keywordXP).every((xp) => xp === 0)).toBe(true);
  expect(saved.reward.xp).toEqual({});
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Skip combat", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "reports/dev-skip.png" });
});

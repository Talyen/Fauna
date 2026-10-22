import { captureScreen } from "./support/rendered-evidence";
import { freshCombat } from "../../src/game/combat/index";
import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { accept, policy, winBattle, run, bossReward } from "../support/game";
import { seed, resume } from "./support/session";
import { fits } from "./support/layout";

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  test(`rendered gameplay, rewards and menus fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const fixture = produce(run(7), (d) => {
      d.roster.push("pollenmoth", "emberback");
      d.reserves = ["pollenmoth", "emberback"].map((kind) => ({
        id: `recruit-${kind}`,
        species: kind as "pollenmoth" | "emberback",
        health: 20,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
      d.keywordXP.burn = 420;
    });
    await seed(page, fixture);
    await resume(page);
    await page.mouse.move(0, 0);
    await page
      .locator(".creature-card img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await fits(page);
    for (const creature of await page
      .locator(".app:not([inert]) :is(.player-row, .enemy-row) .creature-card")
      .all()) {
      const size = await creature.evaluate((el: HTMLElement) => ({
        width: el.offsetWidth,
        height: el.offsetHeight,
      }));
      expect(Math.abs(size.width / size.height - 4 / 3)).toBeLessThan(0.015);
      expect(size.width).toBeGreaterThan(44);
    }
    for (const card of await page.locator(".app:not([inert]) .hand .action-card").all()) {
      expect(
        await card.evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
      ).toEqual(
        height <= 760
          ? { width: 160, height: 213 }
          : height <= 900
            ? { width: 180, height: 240 }
            : { width: 200, height: 267 },
      );
      await expect(card.locator("img")).toHaveAttribute("width", "600");
    }
    await captureScreen(page, { path: `reports/implementation/battle-${width}.png` });
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Talents", exact: true }).click();
    await fits(page);
    await page.getByRole("button", { name: "Burn talents", exact: true }).click();
    await captureScreen(page, { path: `reports/implementation/talents-${width}.png` });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await fits(page);
    await page
      .locator(".collection-grid img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await captureScreen(page, { path: `reports/implementation/collection-${width}.png` });
    const reward = winBattle();
    await seed(page, reward);
    await resume(page);
    await fits(page);
    await captureScreen(page, { path: `reports/implementation/rewards-${width}.png` });
    await seed(page, bossReward());
    await resume(page);
    await fits(page);
    await captureScreen(page, { path: `reports/implementation/boon-${width}.png` });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await fits(page);
    await captureScreen(page, { path: `reports/implementation/team-${width}.png` });
  });

test("five-card hand with hidden overflow, three enemies and a full bench preserve fit and original artwork ratios", async ({
  page,
}) => {
  let s = winBattle();
  while (s.phase !== "teamSelection") s = accept(s, policy(s));
  s = produce(s, (d) => {
    d.boons = ["tattered-pages"];
    d.wins = 1;
    d.roster = ["mossguard", "emberback", "prismram", "pollenmoth", "emberback"];
    d.reserves = ["pollenmoth", "emberback"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind as "pollenmoth" | "emberback",
      health: 20,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
  });
  await seed(page, s);
  await resume(page);
  await fits(page);
  await page.locator(".app:not([inert]) [data-encounter]").click();
  await expect(page.locator(".app:not([inert]) .hand .action-card")).toHaveCount(5);
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card")).toHaveCount(3);
  await fits(page);
  for (const card of await page.locator(".app:not([inert]) .hand .action-card").all()) {
    await card.focus();
    const size = await card.evaluate((el: HTMLElement) => ({
      width: el.offsetWidth,
      height: el.offsetHeight,
    }));
    expect(Math.abs(size.width / size.height - 3 / 4)).toBeLessThan(0.01);
    await expect(card.locator("img")).toHaveCSS("object-fit", "contain");
  }
});

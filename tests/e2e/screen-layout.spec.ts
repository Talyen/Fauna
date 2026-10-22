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
    expect(
      await page
        .locator(".app:not([inert]) .player-row .creature-card")
        .first()
        .evaluate((el: HTMLElement) => ({
          width: el.offsetWidth,
          height: el.offsetHeight,
        })),
    ).toEqual(
      height <= 760
        ? { width: 235, height: 176 }
        : height <= 900
          ? { width: 264, height: 198 }
          : { width: 293, height: 220 },
    );
    for (const card of await page.locator(".app:not([inert]) .hand .action-card").all()) {
      expect(
        await card.evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
      ).toEqual(
        height <= 760
          ? { width: 144, height: 192 }
          : height <= 900
            ? { width: 162, height: 216 }
            : { width: 180, height: 240 },
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
  const area = await page
    .locator(".app:not([inert]) .player-row .creature-card")
    .first()
    .evaluate((el: HTMLElement) => el.offsetWidth * el.offsetHeight);
  for (const card of await page.locator(".app:not([inert]) .hand .action-card").all()) {
    await card.focus();
    expect(
      Math.abs(
        (await card.evaluate((el: HTMLElement) => el.offsetWidth * el.offsetHeight)) / area -
          (0.9 / 1.1) ** 2,
      ),
    ).toBeLessThan(0.025);
  }
});

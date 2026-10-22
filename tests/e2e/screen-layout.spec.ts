import { captureScreen } from "./support/rendered-evidence";
import { freshCombat } from "../../src/game/combat/index";
import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { species } from "../../src/game/content";
import { accept, policy, winBattle, run, bossReward } from "../support/game";
import { seed, state, resume } from "./support/session";
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

for (const [width, height] of [
  [1280, 720],
  [1280, 800],
  [1920, 1080],
  [2560, 1080],
  [3440, 1440],
] as const)
  test(`bounded battle remains scroll-free at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = produce(run(), (d) => {
      d.battle!.hand = d.cards.slice(0, 7).map((card) => card.id);
      d.battle!.buffer = d.cards.slice(7).map((card) => card.id);
      d.battle!.draw = [];
      d.battle!.discard = [];
    });
    await seed(page, fixture);
    await resume(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const area = (element: HTMLElement) => element.offsetWidth * element.offsetHeight;
    expect(
      await page
        .locator(".app:not([inert]) .player-row .creature-card")
        .first()
        .evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
    ).toEqual(
      height <= 760
        ? { width: 235, height: 176 }
        : height <= 900
          ? { width: 264, height: 198 }
          : { width: 293, height: 220 },
    );
    expect(
      await page
        .locator(".app:not([inert]) .hand .action-card")
        .first()
        .evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
    ).toEqual(
      height <= 760
        ? { width: 144, height: 192 }
        : height <= 900
          ? { width: 162, height: 216 }
          : { width: 180, height: 240 },
    );
    expect(
      await page
        .locator(".mana-gem")
        .first()
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBe(18);
    const mana = (await page.getByRole("button", { name: /^Mana / }).boundingBox())!;
    const end = (await page.getByRole("button", { name: /^End turn/ }).boundingBox())!;
    const swap = (await page.getByRole("button", { name: "Swap", exact: true }).boundingBox())!;
    expect(swap.y + swap.height).toBeLessThan(end.y);
    expect(Math.abs(swap.x - end.x)).toBeLessThan(1);
    const draw = (await page.locator('[data-pile="draw"]').boundingBox())!;
    const discard = (await page.locator('[data-pile="discard"]').boundingBox())!;
    expect(mana.y + mana.height).toBeLessThan(draw.y);
    expect(end.y + end.height).toBeLessThan(discard.y);
    expect(Math.abs(mana.x + mana.width / 2 - draw.x - draw.width / 2)).toBeLessThan(1);
    expect(Math.abs(end.x + end.width / 2 - discard.x - discard.width / 2)).toBeLessThan(1);
    for (const pile of [draw, discard]) expect(Math.abs(pile.y + pile.height - height + 24)).toBeLessThan(1);
    await page.mouse.move(0, 0);
    const fan = await page
      .locator(".app:not([inert]) .hand-slot")
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().toJSON()));
    expect(Math.abs(fan[0]!.top - fan[6]!.top)).toBeLessThan(1);
    expect(Math.abs(fan[1]!.top - fan[5]!.top)).toBeLessThan(1);
    expect(fan[0]!.top).toBeGreaterThan(fan[1]!.top);
    expect(fan[1]!.top).toBeGreaterThan(fan[2]!.top);
    {
      expect(fan[0]!.bottom).toBeGreaterThan(height);
      expect(fan[0]!.bottom).toBeLessThan(height + 64);
      expect(Math.abs(fan[3]!.bottom - height)).toBeLessThan(1);
    }
    const creatureArea = await page
      .locator(".app:not([inert]) .player-row .creature-card")
      .first()
      .evaluate(area);
    for (const card of await page.locator(".app:not([inert]) .hand .action-card").all())
      expect(Math.abs((await card.evaluate(area)) / creatureArea - (0.9 / 1.1) ** 2)).toBeLessThan(0.025);
    for (const control of await page
      .locator(".app:not([inert]) .hand-toolbar .battle-dock button:enabled")
      .all()) {
      const bounds = (await control.boundingBox())!;
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      expect(
        await control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
    }
    const dock = await page.locator(".app:not([inert]) .hand-toolbar").evaluate((element) => {
      const [left, hand, right] = [...element.children].map((child) =>
        child.getBoundingClientRect().toJSON(),
      );
      return { left: left!, hand: hand!, right: right! };
    });
    expect(Math.abs((dock.left.left + dock.right.right) / 2 - width / 2)).toBeLessThan(1);
    expect(Math.abs(dock.left.width - dock.right.width)).toBeLessThan(1);
    expect(dock.left.right).toBeLessThan(dock.hand.left);
    expect(dock.hand.right).toBeLessThan(dock.right.left);
    const handWidth = await page
      .locator(".app:not([inert]) .hand .action-card")
      .first()
      .evaluate((element: HTMLElement) => element.offsetWidth);
    for (const pile of await page.locator(".app:not([inert]) [data-pile]").all()) {
      const pileWidth = await pile.evaluate((element: HTMLElement) => element.offsetWidth);
      expect(Math.abs(pileWidth / handWidth - 0.8)).toBeLessThan(0.01);
    }
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    const opener = page.getByRole("button", {
      name: `Inspect ${species(fixture.team[0]!.species).name}`,
      exact: true,
    });
    await opener.click();
    const details = page.locator(".collection-creature-screen");
    await expect(details).toBeVisible();
    const inspectedArea = await details.locator(".collection-creature-trait .creature-card").evaluate(area);
    for (const card of await details.locator(".action-card").all())
      expect(Math.abs((await card.evaluate(area)) / inspectedArea - 1)).toBeLessThan(0.025);
    await page.keyboard.press("Escape");
    await expect(details).toHaveCount(0);
    await expect(opener).toBeFocused();
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    expect(await state(page)).toEqual(fixture);
  });

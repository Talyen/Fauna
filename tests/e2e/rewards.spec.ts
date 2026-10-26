import { captureFrame, settleScreen } from "./support/rendered-evidence";
import { expect, type Page } from "@playwright/test";
import { BOONS } from "../../src/game/content";
import { winBattle, bossReward } from "../support/game";
import { test, seed, state, resume } from "./support/session";
import { expectScrollFree } from "./support/layout-contract";

async function layouts(page: Page, name: string, check?: () => Promise<void>) {
  for (const [width, height, scale] of [
    [1280, 720, "1.25"],
    [1920, 1080, "1"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.locator("html").evaluate((el, scale) => el.style.setProperty("--text-scale", scale), scale);
    await settleScreen(page);
    await check?.();
    await expectScrollFree(page);
    await captureFrame(page, { path: `reports/rewards/${name}-${width}.png` });
  }
}

for (const [name, create] of [
  ["recruit", winBattle],
  ["boon", bossReward],
] as const)
  test(`${name} choices fit both layouts and commit only the activated choice`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = create();
    await seed(page, fixture);
    await resume(page);
    if (fixture.phase === "recruit") {
      await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
      await expect(page.locator(".recruit-options")).toHaveCount(0);
      await layouts(page, "earnings", async () => {
        expect(
          await page.getByLabel("Last battle earnings").evaluate((receipt) => {
            const gold = receipt.querySelector(".battle-earnings")!.getBoundingClientRect();
            const xp = receipt.querySelector(".keyword-progress-grid")!.getBoundingClientRect();
            const identities = [...receipt.querySelectorAll(".reward-keyword-identity")];
            return {
              earningsBelowXP: gold.top > xp.bottom,
              matchingColors:
                identities.length > 0 &&
                identities.every(
                  (identity) =>
                    getComputedStyle(identity.querySelector("svg")!).color ===
                    getComputedStyle(identity.querySelector("span[data-keyword]")!).color,
                ),
            };
          }),
        ).toEqual({ earningsBelowXP: true, matchingColors: true });
      });
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByLabel("Last battle earnings")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
    }
    const cards = page.locator(".reward-option");
    await expect(cards).toHaveCount(3);
    if (fixture.phase === "boon") {
      for (const id of fixture.reward.boons) {
        const name = BOONS.find((boon) => boon.id === id)!.name;
        await expect(page.getByRole("button", { name: `Choose ${name}`, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
      }
    }
    await layouts(page, fixture.phase, async () => {
      expect(
        await cards.evaluateAll((cards) => {
          const first = cards[0]!.getBoundingClientRect();
          const last = cards.at(-1)!.getBoundingClientRect();
          return Math.abs(first.left + last.right - innerWidth);
        }),
      ).toBeLessThan(1);
    });
    expect(await state(page)).toEqual(fixture);
    const command =
      fixture.phase === "recruit"
        ? ({ type: "recruit", species: "emberback" } as const)
        : ({ type: "skipBoon" } as const);
    await page
      .getByRole("button", { name: command.type === "recruit" ? "Recruit Emberback" : "Skip", exact: true })
      .click();
    const committed = await state(page);
    expect(committed.phase).toBe("teamSelection");
    expect(committed.journey!.currency).toBe(fixture.journey!.currency);
    expect(committed.boons).toEqual(fixture.boons);
    if (command.type === "recruit") {
      expect(committed.discovery.recruited.emberback).toBe((fixture.discovery.recruited.emberback ?? 0) + 1);
      expect(committed.team.map((creature) => creature.id)).toEqual(
        fixture.team.map((creature) => creature.id),
      );
    }
    await layouts(page, `team-after-${fixture.phase}`);
    expect(await state(page)).toEqual(committed);
  });

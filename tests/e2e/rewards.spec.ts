import { captureScreen } from "./support/rendered-evidence";
import { test, expect } from "@playwright/test";
import { winBattle, bossReward } from "../support/game";
import { seed, state, resume } from "./support/session";

for (const [width, height, enlarged] of [
  [1280, 720, true],
  [1920, 1080, false],
] as const)
  test(`separate earnings and recruit choices at ${width}, enlarged ${enlarged}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const fixture of [winBattle(), bossReward()]) {
      await seed(page, fixture);
      await resume(page);
      if (enlarged) await page.locator("html").evaluate((el) => el.style.setProperty("--text-scale", "1.25"));
      if (fixture.phase === "recruit") {
        await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
        await expect(page.locator(".recruit-options")).toHaveCount(0);
        const receipt = page.getByLabel("Last battle earnings");
        const gold = receipt.locator(".battle-earnings");
        const xp = receipt.locator(".keyword-progress-grid");
        expect((await gold.boundingBox())!.y).toBeGreaterThan(
          (await xp.boundingBox())!.y + (await xp.boundingBox())!.height,
        );
        for (const identity of await receipt.locator(".reward-keyword-identity").all()) {
          const iconColor = await identity.locator("svg").evaluate((el) => getComputedStyle(el).color);
          const labelColor = await identity
            .locator("span[data-keyword]")
            .evaluate((el) => getComputedStyle(el).color);
          expect(iconColor).toBe(labelColor);
        }
        await captureScreen(page, { path: `reports/rewards/earnings-${width}.png` });
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        expect(await state(page)).toEqual(fixture);
        await expect(page.getByLabel("Last battle earnings")).toHaveCount(0);
      }
      await page
        .locator(".reward-screen img")
        .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
      const cards = page.locator(".reward-option");
      await expect(cards).toHaveCount(3);
      await expect(page.locator(".reward-heading h2")).toHaveCount(0);
      await expect(page.locator(".reward-choice-content > h2")).toHaveCount(0);
      const first = (await cards.first().boundingBox())!,
        last = (await cards.last().boundingBox())!;
      expect(Math.abs(first.x + last.x + last.width - width)).toBeLessThan(1);
      await captureScreen(page, { path: `reports/rewards/${fixture.phase}-${width}.png` });
      if (fixture.phase === "recruit") {
        await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
        expect(
          [...(await state(page)).team, ...(await state(page)).reserves]
            .map((unit) => unit.species)
            .filter((kind) => kind === "emberback"),
        ).toHaveLength(2);
      } else await page.getByRole("button", { name: "Skip", exact: true }).click();
    }
  });

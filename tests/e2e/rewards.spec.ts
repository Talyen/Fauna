import { captureScreen } from "./support/rendered-evidence";
import { test, expect } from "@playwright/test";
import { winBattle, bossReward } from "../support/game";
import { seed, state, resume } from "./support/session";

for (const [width, height, enlarged] of [
  [1280, 720, true],
  [1920, 1080, false],
] as const)
  test(`shared Reward anchors and three recruit choices at ${width}, enlarged ${enlarged}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const anchors: { heading: number }[] = [];
    for (const fixture of [winBattle(), bossReward()]) {
      await seed(page, fixture);
      await resume(page);
      if (enlarged) await page.locator("html").evaluate((el) => el.style.setProperty("--text-scale", "1.25"));
      await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
      await page
        .locator(".reward-screen img")
        .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
      const cards = page.locator(".reward-option");
      await expect(cards).toHaveCount(3);
      await expect(page.locator(".reward-heading h2")).toHaveCount(0);
      await expect(page.locator(".reward-choice-content > h2")).toHaveCount(1);
      const first = (await cards.first().boundingBox())!,
        last = (await cards.last().boundingBox())!;
      expect(Math.abs(first.x + last.x + last.width - width)).toBeLessThan(1);
      await captureScreen(page, { path: `reports/rewards/${fixture.phase}-${width}.png` });
      anchors.push({
        heading: (await page.locator(".reward-heading").boundingBox())!.y,
      });
      if (fixture.phase === "recruit") {
        await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
        expect((await state(page)).roster.filter((kind) => kind === "emberback")).toHaveLength(2);
      } else await page.getByRole("button", { name: "Skip", exact: true }).click();
    }
    expect(Math.abs(anchors[0]!.heading - anchors[1]!.heading)).toBeLessThan(1);
  });

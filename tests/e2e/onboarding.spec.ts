import { captureScreen } from "./support/rendered-evidence";
import { test, expect } from "@playwright/test";
import { CARDS, species } from "../../src/game/content";
import { seed, state, resume } from "./support/session";
import { fits } from "./support/layout";

for (const [width, enlarged] of [
  [1280, true],
  [1920, false],
] as const)
  test(`onboarding starter inspection, commitment and focus return at ${width}${enlarged ? " with enlarged text" : ""}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    if (enlarged) {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("radio", { name: "125%", exact: true }).click();
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Begin journey", exact: true })).toHaveCount(0);
    const initial = await state(page);
    const chosen = initial.starterOffers[0]!;
    const name = species(chosen).name;
    const mossguard = page.getByRole("button", { name: `Inspect ${name}`, exact: true });
    const recruit = page.getByRole("button", { name: `Recruit ${name}`, exact: true });
    expect((await recruit.boundingBox())!.width).toBeLessThan((await mossguard.boundingBox())!.width);
    await fits(page);
    await captureScreen(page, { path: `reports/starter/selection-${width}-${enlarged}.png` });
    await mossguard.hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator("strong").first()).toHaveText(name);
    await expect(tooltip).toContainText(species(chosen).passiveTiers[0].description);
    for (const action of CARDS.filter((entry) => entry.species === chosen))
      await expect(tooltip).toContainText(action.name);
    await captureScreen(page, { path: `reports/starter/tooltip-${width}-${enlarged}.png` });
    await mossguard.click();
    await page.locator(".inspection-thumbnails .action-card").first().click();
    await expect(page.getByRole("button", { name: /^Choose |^Recruit / })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "0 of 5 stars", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).focus();
    await page.keyboard.press("s");
    await expect(page.locator(".inspection-creature .creature-card")).toBeFocused();
    await page.keyboard.press("s");
    await expect(page.locator(".inspection-thumbnails .action-card").nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".inspection.single-card")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".inspection-thumbnails .action-card").nth(1)).toBeFocused();
    await captureScreen(page, { path: `reports/starter/inspection-${width}-${enlarged}.png` });
    await fits(page);
    const hero = (await page.locator(".inspection-creature .creature-card").boundingBox())!;
    const abilities = page.locator(".inspection-thumbnails .action-card");
    const first = (await abilities.first().boundingBox())!;
    const last = (await abilities.last().boundingBox())!;
    expect(Math.abs(hero.x + hero.width / 2 - (first.x + last.x + last.width) / 2)).toBeLessThan(1);
    expect(first.width).toBeGreaterThan(hero.width / 3);
    expect(Math.abs(hero.width / hero.height - 4 / 3)).toBeLessThan(0.01);
    for (const ability of await abilities.all()) {
      const box = (await ability.boundingBox())!;
      expect(Math.abs(box.width / box.height - 3 / 4)).toBeLessThan(0.01);
    }
    await page.keyboard.press("Escape");
    await expect(mossguard).toBeFocused();
    expect((await state(page)).revision).toBe(initial.revision);
    await recruit.click();
    await expect(page.getByRole("button", { name: "Begin journey", exact: true })).toHaveCount(0);
    expect((await state(page)).phase).toBe("teamSelection");
    await page.reload();
    await resume(page);
    const started = await state(page);
    expect([...started.team, ...started.reserves].map((unit) => unit.species)).toEqual([chosen]);
    expect(started.cards).toHaveLength(3);
  });

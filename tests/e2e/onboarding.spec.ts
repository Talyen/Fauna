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
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    if (enlarged) {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("radio", { name: "125%", exact: true }).click();
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const begin = page.getByRole("button", { name: "Begin journey", exact: true });
    await expect(begin).toBeDisabled();
    const initial = await state(page);
    const chosen = initial.starterOffers[0]!;
    const name = species(chosen).name;
    const mossguard = page.getByRole("button", { name: `Inspect ${name}`, exact: true });
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
    await expect(page.getByRole("button", { name: `Choose ${name}`, exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: `Choose ${name}`, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mossguard).toBeFocused();
    expect((await state(page)).revision).toBe(initial.revision);
    await mossguard.press("Enter");
    await captureScreen(page, { path: `reports/starter/inspection-${width}-${enlarged}.png` });
    const ranks = page.getByRole("button", { name: "Rank progression", exact: true });
    await ranks.click();
    await expect(page.getByRole("button", { name: `Choose ${name}`, exact: true })).toHaveCount(0);
    await captureScreen(page, { path: `reports/starter/ranks-${width}-${enlarged}.png` });
    await page.keyboard.press("Escape");
    await expect(ranks).toBeFocused();
    expect((await state(page)).revision).toBe(initial.revision);
    await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
    await expect(mossguard).toBeFocused();
    await expect(mossguard).toHaveAttribute("aria-pressed", "true");
    await expect(begin).toBeEnabled();
    expect((await state(page)).selected).toEqual([chosen]);
    await mossguard.click();
    await expect(page.getByRole("button", { name: /^Choose / })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.reload();
    await resume(page);
    await expect(mossguard).toHaveAttribute("aria-pressed", "true");
    if (!enlarged) await fits(page);
    for (const artwork of await page.locator(".draft-grid .creature-card").all()) {
      const bounds = (await artwork.boundingBox())!;
      expect(Math.abs(bounds.width - (width === 1280 ? 240 : 800 / 3))).toBeLessThan(1);
      expect(Math.abs(bounds.height - (width === 1280 ? 180 : 200))).toBeLessThan(1);
    }
    await captureScreen(page, {
      path: `reports/starter/selection-${width}-${enlarged}.png`,
      fullPage: true,
    });
    await begin.click();
    const started = await state(page);
    expect(started.roster).toEqual([chosen]);
    expect(started.cards).toHaveLength(3);
  });

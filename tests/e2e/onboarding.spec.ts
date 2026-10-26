import { captureScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { CARDS, definition, species } from "../../src/game/content";
import { reloadHome, test, seed, state, resume } from "./support/session";

const layouts = [
  [1280, 720, "1.25"],
  [1920, 1080, "1"],
] as const;

test("onboarding inspection and commitment across both layouts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Begin journey", exact: true })).toHaveCount(0);
  const initial = await state(page);
  const chosen = initial.starterOffers[0]!;
  const name = species(chosen).name;
  const mossguard = page.getByRole("button", { name: `Inspect ${name}`, exact: true });
  const recruit = page.getByRole("button", { name: `Recruit ${name}`, exact: true });
  const tooltip = page.getByRole("tooltip");
  for (const [width, height, scale] of layouts) {
    await page.setViewportSize({ width, height });
    await page.locator("html").evaluate((el, value) => el.style.setProperty("--text-scale", value), scale);
    expect((await recruit.boundingBox())!.width).toBeLessThan((await mossguard.boundingBox())!.width);
    await captureScreen(page, { path: `reports/starter/selection-${width}.png` });
    await mossguard.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator("strong").first()).toHaveText(name);
    await expect(tooltip).toContainText(species(chosen).passiveTiers[0].description);
    await captureScreen(page, { path: `reports/starter/tooltip-${width}.png` });
    for (const action of CARDS.filter((entry) => entry.species === chosen))
      await expect(tooltip).not.toContainText(action.name);
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();
  }
  await mossguard.click();
  await page.locator(".inspection-thumbnails .action-card").first().click();
  await expect(page.getByRole("button", { name: /^Choose |^Recruit / })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "0 of 5 stars", exact: true })).toBeVisible();
  await page.locator(".inspection-thumbnails .action-card").first().focus();
  await page.keyboard.press("d");
  await expect(page.locator(".inspection-thumbnails .action-card").nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".inspection.single-card")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".inspection-thumbnails .action-card").nth(1)).toBeFocused();
  await expect(page.locator(".creature-inspection .creature-card")).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  const abilities = page.locator(".inspection-thumbnails .action-card");
  for (const [width, height, scale] of layouts) {
    await page.setViewportSize({ width, height });
    await page.locator("html").evaluate((el, value) => el.style.setProperty("--text-scale", value), scale);
    await captureScreen(page, { path: `reports/starter/inspection-${width}.png` });
    const first = (await abilities.first().boundingBox())!;
    const last = (await abilities.last().boundingBox())!;
    expect(Math.abs((first.x + last.x + last.width) / 2 - width / 2)).toBeLessThan(1);
    for (const ability of await abilities.all()) {
      const box = (await ability.boundingBox())!;
      expect(Math.abs(box.width / box.height - 3 / 4)).toBeLessThan(0.01);
    }
  }
  await page.keyboard.press("Escape");
  await expect(mossguard).toBeFocused();
  expect(await state(page)).toEqual(initial);
  await recruit.click();
  await expect(page.getByRole("button", { name: "Begin journey", exact: true })).toHaveCount(0);
  expect((await state(page)).phase).toBe("teamSelection");
  await reloadHome(page);
  await resume(page);
  const started = await state(page);
  expect([...started.team, ...started.reserves].map((unit) => unit.species)).toEqual([chosen]);
  expect(started.cards).toHaveLength(3);
  const opener = page.getByRole("button", { name: "Deck", exact: true });
  await opener.click();
  const deck = page.getByRole("dialog", { name: "Deck", exact: true });
  await expect(deck.locator(".action-card")).toHaveCount(3);
  const card = deck.locator(".action-card").first();
  const id = await card.getAttribute("data-card-id");
  await card.click({ button: "right" });
  await expect(page.locator(".inspection.single-card")).toBeVisible();
  await page.locator(".inspection.single-card .action-card").hover();
  await expect(page.getByRole("tooltip")).toContainText(
    definition(started.cards.find((entry) => entry.id === id)!.definitionId).name,
  );
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  expect(await state(page)).toEqual(started);
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
});

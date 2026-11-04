import { captureScreen, settleScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { produce } from "immer";
import { expectScrollFree } from "./support/layout-contract";
import { CARDS, SPECIES } from "../../src/game/content";
import { run } from "../support/game";
import { test, seed, state, resume } from "./support/session";

test("Collection inspection returns through nested details to the unchanged battle", async ({ page }) => {
  const fixture = run(7);
  await seed(page, fixture);
  await resume(page);
  await page.locator(".player-row .creature-card").first().hover();
  await expect(page.getByRole("tooltip")).toContainText("Retain 10% more Block between turns");
  await expect(page.getByRole("tooltip")).not.toContainText("Rooted Stomp");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Collection pages" })).toHaveCount(1);
  await settleScreen(page);
  await expect(page.locator(".collection-grid .creature-card")).toHaveCount(6);
  // Grid cells own row layout; the artwork inside may be scaled under a stationary pointer.
  const rows = await page.locator(".collection-grid > *").evaluateAll((cards) => {
    const counts = new Map<number, number>();
    for (const card of cards) {
      const top = Math.round(card.getBoundingClientRect().top);
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts.values()];
  });
  expect(rows).toEqual([3, 3]);
  const locked = page.getByRole("img", { name: "Locked species" }).first();
  await expect(locked).toBeVisible();
  const artwork = locked.locator("img");
  await expect(artwork).toHaveCSS("filter", "grayscale(1)");
  await locked.hover();
  await expect(page.getByRole("tooltip")).not.toHaveCount(0);
  await expect(artwork).toHaveCSS("filter", "none");
  await expect(locked.locator(".effect-shine-border")).toHaveCSS("opacity", "1");
  await expect(locked.locator(".creature-card")).toHaveCSS("scale", "1.035");
  await locked.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("heading", { name: "Collection", exact: true }).hover();
  await expect(artwork).toHaveCSS("filter", "grayscale(1)");
  await expect(locked.locator(".creature-card")).toHaveCSS("scale", "none");
  await page.keyboard.press("Tab");
  await locked.focus();
  await expect(artwork).toHaveCSS("filter", "none");
  await expect(locked.locator(".effect-shine-border")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Inspect Emberback", exact: true }).click();
  const details = page.locator(".creature-inspection");
  await expect(details.getByRole("region", { name: "Trait", exact: true })).toContainText("Molten Shell");
  for (const card of CARDS.filter((c) => c.species === "emberback"))
    await expect(details.getByRole("button", { name: new RegExp(`^${card.name},`) })).toHaveAttribute(
      "aria-label",
      new RegExp(`${card.cost} mana`),
    );
  const charge = details.getByRole("button", { name: /^Ember Charge,/ });
  await expect(charge).toHaveAttribute("aria-label", /Deal 4 Physical damage/);
  await charge.click();
  await expect(page.getByRole("dialog", { name: "Ember Charge details", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(charge).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await details.getByRole("button", { name: "Close inspection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect Emberback", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Collection", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("main", { name: "Battlefield", exact: true })).toBeVisible();
  expect(await state(page)).toEqual(fixture);
});

test("Collection keeps a later-page creature and focus through live resize and tab changes", async ({
  page,
}) => {
  const fixture = produce(run(7), (game) => {
    game.discovery.encountered = SPECIES.map((entry) => entry.id);
    game.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, fixture);
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const next = page.getByRole("button", { name: "Next page", exact: true });
  for (let count = 0; count < SPECIES.length && (await next.isEnabled()); count++) await next.click();
  await expect(next).toBeDisabled();
  const creature = SPECIES.at(-1)!;
  const opener = page.getByRole("button", { name: `Inspect ${creature.name}`, exact: true });
  await opener.click();
  // Resize behind the inspector while preserving the gallery page and return focus.
  await page.setViewportSize({ width: 1280, height: 720 });
  await captureScreen(page, { path: "reports/collection/resized-details.png" });
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(next).toBeDisabled();
  await expectScrollFree(page);
  const layoutPositions = async () =>
    page.locator(".collection-heading, .collection-tabs [role=tablist], .collection-pagination").evaluateAll(
      (elements) => elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
  const faunaPositions = await layoutPositions();
  await page.getByRole("tab", { name: "Boons", exact: true }).click();
  await expect(page.locator(".collection-boon")).toHaveCount(8);
  expect(await layoutPositions()).toEqual(faunaPositions);
  const boonRows = await page.locator(".collection-boon").evaluateAll((cards) => {
    const counts = new Map<number, number>();
    for (const card of cards) {
      const top = Math.round(card.getBoundingClientRect().top);
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts.values()];
  });
  expect(boonRows).toEqual([4, 4]);
  await page.getByRole("tab", { name: "Fauna", exact: true }).click();
  await expect(opener).toBeVisible();
  await expect(next).toBeDisabled();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await settleScreen(page);
  await expectScrollFree(page);
  await opener.click();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  expect(await state(page)).toEqual(fixture);
});

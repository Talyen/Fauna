import { captureScreen } from "./support/rendered-evidence";
import { test, expect, type Locator } from "@playwright/test";
import { CARDS } from "../../src/game/content";
import { run } from "../support/game";
import { seed, state, resume } from "./support/session";
import { gamepad } from "./support/gamepad";
import { fits } from "./support/layout";

test("Collection hides uncollected tooltips and opens readable creature pages", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Collection pages" })).toHaveCount(1);
  const rows = await page.locator(".collection-grid .creature-card").evaluateAll((cards) => {
    const counts = new Map<number, number>();
    for (const card of cards) {
      const top = Math.round(card.getBoundingClientRect().top);
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts.values()];
  });
  expect(rows).toEqual([4, 4]);
  const locked = page.getByRole("img", { name: "Locked species" }).first();
  await expect(locked).toBeVisible();
  const artwork = locked.locator("img");
  await expect(artwork).toHaveCSS("filter", "grayscale(1)");
  await locked.hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(artwork).toHaveCSS("filter", "none");
  const hoverScale = await locked.evaluate((e) =>
    getComputedStyle(e).getPropertyValue("--hover-scale").trim(),
  );
  const highlight = await locked.evaluate((e) => {
    const sample = document.createElement("span");
    sample.style.color = "var(--primary)";
    e.append(sample);
    const color = getComputedStyle(sample).color;
    sample.remove();
    return color;
  });
  await expect(locked).toHaveCSS("scale", hoverScale);
  await expect(locked).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
  await expect.poll(() => locked.evaluate((e) => getComputedStyle(e, "::after").borderColor)).toBe(highlight);
  await page.getByRole("heading", { name: "Collection", exact: true }).hover();
  await expect(artwork).toHaveCSS("filter", "grayscale(1)");
  await expect(locked).toHaveCSS("scale", "none");
  await page.getByRole("button", { name: "Inspect Mossguard", exact: true }).click();
  await expect(page.locator(".collection-creature-screen")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Inspect Mossguard", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
});

for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`Collection from battle shows a complete kit and returns without changing combat with ${input}`, async ({
    page,
  }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    const fixture = run(7);
    await seed(page, fixture);
    await resume(page);
    const activate = async (el: Locator) => {
      if (input === "mouse") await el.click();
      else {
        await el.focus();
        if (press) await press(0);
        else await page.keyboard.press("Enter");
      }
    };
    const enemy = page.locator(".app:not([inert]) .enemy-row .creature-card").first();
    await enemy.focus();
    if (press) await press(2);
    else await page.keyboard.press("i");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await activate(page.getByRole("button", { name: "Open menu", exact: true }));
    await activate(page.getByRole("button", { name: "Collection", exact: true }));
    await activate(page.getByRole("button", { name: "Inspect Emberback", exact: true }));
    const details = page.locator(".collection-creature-screen");
    await expect(details.getByRole("region", { name: "Trait", exact: true })).toContainText("Molten Shell");
    for (const card of CARDS.filter((c) => c.species === "emberback"))
      await expect(details.getByRole("region", { name: card.name, exact: true })).toContainText(
        `${card.cost} Mana`,
      );
    await expect(details.getByRole("region", { name: "Ember Charge", exact: true })).toContainText(
      "Deal 4 Physical damage",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (input === "mouse") await details.getByRole("button", { name: "Back", exact: true }).click();
    else if (press) await press(1);
    else await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Inspect Emberback", exact: true })).toBeFocused();
    if (press) await press(1);
    else await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Collection", exact: true })).toBeFocused();
    await activate(page.getByRole("button", { name: "Continue", exact: true }));
    await expect(page.getByRole("main", { name: "Battlefield", exact: true })).toBeVisible();
    expect(await state(page)).toEqual(fixture);
  });

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  test(`Collection kit preserves artwork ratios and visible rules at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await seed(page, run(7));
    await resume(page);
    await page.locator(".app:not([inert]) .player-row .creature-card").first().hover();
    await expect(page.getByRole("tooltip")).toContainText("Retain 10% more Block between turns");
    await expect(page.getByRole("tooltip")).not.toContainText("Rooted Stomp");
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await page.getByRole("button", { name: "Inspect Mossguard", exact: true }).click();
    const details = page.locator(".collection-creature-screen");
    await details
      .locator("img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await page.mouse.move(0, 0);
    await fits(page);
    const creature = (await details.locator(".creature-card").boundingBox())!;
    expect(Math.abs(creature.width / creature.height - 4 / 3)).toBeLessThan(0.01);
    for (const artwork of await details.locator(".action-card").all()) {
      const bounds = (await artwork.boundingBox())!;
      expect(Math.abs(bounds.width / bounds.height - 3 / 4)).toBeLessThan(0.01);
      expect(await artwork.textContent()).toBe("");
    }
    for (const card of CARDS.filter((c) => c.species === "mossguard")) {
      const region = details.getByRole("region", { name: card.name, exact: true });
      await expect(region).toBeVisible();
      await expect(region.locator(".action-effect")).not.toBeEmpty();
    }
    await captureScreen(page, { path: `reports/collection/kit-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Inspect Mossguard", exact: true })).toBeFocused();
  });

import { expect } from "@playwright/test";
import { run } from "../support/game";
import { reloadHome, test, seed } from "./support/session";

for (const scale of [1, 1.25]) {
  test(`language dropdown keeps every choice reachable at ${scale * 100}% text`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript((scale) => localStorage.setItem("fauna.test.text-scale", String(scale)), scale);
    await seed(page, run());
    await page.getByRole("button", { name: "Options", exact: true }).click();
    const language = page.getByRole("combobox", { name: "Language", exact: true });
    await language.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("listbox");
    await expect(menu).toBeVisible();
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-focus", "visible");
    const bounds = (await menu.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(720);
    const heights = await page
      .getByRole("option")
      .evaluateAll((options) => options.map((option) => option.getBoundingClientRect().height));
    expect(heights.every((height) => height >= 44)).toBe(true);
    await page.keyboard.press("End");
    const last = page.getByRole("option", { name: "Français", exact: true });
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport({ ratio: 0.999 });
    await page.keyboard.press("Home");
    const first = page.getByRole("option", { name: "Automatic", exact: true });
    await expect(first).toBeFocused();
    await expect(first).toBeInViewport({ ratio: 0.999 });
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { name: "English", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveCount(0);
    await expect(language).toHaveText("English");
    await expect(language).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.press("Escape");
    await expect(language).toHaveText("English");
    await expect(language).toBeFocused();
    await expect(page.getByRole("heading", { name: "Options", exact: true })).toBeVisible();
  });
}

test("slider fill and thumb follow pointer drags across the track", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "Options", exact: true }).click();

  for (const [tab, name] of [
    ["Display", "Background Glow"],
    ["Sound", "Master volume"],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    const thumb = page.getByRole("slider", { name, exact: true });
    const slider = thumb.locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ui-slider ')]",
    );
    const bounds = (await slider.boundingBox())!;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.click(bounds.x + bounds.width / 2, y);
    // Drag from outside the visible circle, inside its larger hit target.
    await page.mouse.move(bounds.x + bounds.width / 2, y + 15);
    await page.mouse.down();
    for (const percent of [20, 80, 0, 100]) {
      const x = bounds.x + (bounds.width * percent) / 100;
      await page.mouse.move(x, y + 15, { steps: 5 });
      await expect(thumb).toHaveAttribute("aria-valuenow", String(percent));
      await expect
        .poll(() => slider.evaluate((element) => element.getBoundingClientRect().width))
        .toBeCloseTo(bounds.width, 1);
      await expect
        .poll(async () =>
          slider.evaluate((element) => {
            const track = element.querySelector(".ui-slider-track")!.getBoundingClientRect();
            const range = element.querySelector(".ui-slider-range")!.getBoundingClientRect();
            const thumb = element.querySelector('[role="slider"]')!.getBoundingClientRect();
            const center = thumb.left + thumb.width / 2;
            return Math.abs(center - (range.width ? range.right : track.left));
          }),
        )
        .toBeLessThan(1);
      await expect
        .poll(() =>
          thumb.evaluate((element, x) => {
            const rect = element.getBoundingClientRect();
            return Math.abs(rect.left + rect.width / 2 - x);
          }, x),
        )
        .toBeLessThan(1);
    }
    await page.mouse.up();
  }
});

test("shadcn tabs and settings retain native keyboard behavior and game navigation", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const all = page.getByRole("tab", { name: "Fauna", exact: true });
  await all.focus();
  await page.keyboard.press("ArrowRight");
  const known = page.getByRole("tab", { name: "Boons", exact: true });
  await expect(known).toBeFocused();
  await expect(known).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    (await known.getAttribute("id")) as string,
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Fauna", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  const master = page.getByRole("slider", { name: "Master volume", exact: true });
  await master.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(master).toHaveAttribute("aria-valuetext", "49%");
  const mute = page.getByRole("switch", { name: "Mute in background", exact: true });
  await mute.click();
  await expect(mute).not.toBeChecked();
  await page.getByRole("tab", { name: "Display", exact: true }).click();
  const size = page.getByRole("slider", { name: "Game Size", exact: true });
  await size.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(size).toHaveAttribute("aria-valuenow", "85");
  await page.keyboard.press("Escape");
  await reloadHome(page);
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await expect(size).toHaveAttribute("aria-valuenow", "85");
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await expect(master).toHaveAttribute("aria-valuetext", "49%");
  await expect(mute).not.toBeChecked();
});

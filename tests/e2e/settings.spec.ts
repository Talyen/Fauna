import { expect } from "@playwright/test";
import { run } from "../support/game";
import { reloadHome, test, seed } from "./support/session";

test("slider fill and thumb follow pointer drags across the track", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "Settings", exact: true }).click();

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
      const geometry = await slider.evaluate((element) => {
        const track = element.querySelector(".ui-slider-track")!.getBoundingClientRect();
        const range = element.querySelector(".ui-slider-range")!.getBoundingClientRect();
        const thumb = element.querySelector('[role="slider"]')!.getBoundingClientRect();
        return { trackLeft: track.left, rangeRight: range.right, thumbCenter: thumb.left + thumb.width / 2 };
      });
      expect(Math.abs(geometry.thumbCenter - x)).toBeLessThan(1);
      expect(
        Math.abs(geometry.thumbCenter - (percent ? geometry.rangeRight : geometry.trackLeft)),
      ).toBeLessThan(1);
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
  await page.keyboard.press("a");
  await expect(page.getByRole("tab", { name: "Fauna", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  const sound = page.getByRole("switch", { name: "Sound", exact: true });
  const master = page.getByRole("slider", { name: "Master volume", exact: true });
  await master.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(master).toHaveAttribute("aria-valuetext", "40%");
  const backgroundMute = page.getByRole("switch", { name: "Mute in background", exact: true });
  await backgroundMute.click();
  await expect(backgroundMute).not.toBeChecked();
  await expect(page.getByRole("tab", { name: "Diagnostics", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy diagnostics", exact: true })).toHaveCount(0);
  await sound.focus();
  // Native keyboard activation owns the switch's reversible state and rendered thumb geometry
  for (const checked of [false, true, false]) {
    await page.keyboard.press("Space");
    await expect(sound).toBeChecked({ checked });
    await expect
      .poll(() =>
        sound.evaluate((el) => {
          const root = el.getBoundingClientRect();
          const thumb = el.querySelector("span")!.getBoundingClientRect();
          return {
            hit: [root.width, root.height],
            thumb: [thumb.width, thumb.height],
            offset: Math.round(thumb.left - root.left),
          };
        }),
      )
      .toEqual({ hit: [44, 44], thumb: [16, 16], offset: checked ? 22 : 6 });
  }
  await page.getByRole("tab", { name: "Display", exact: true }).click();
  const small = page.getByRole("radio", { name: "100%", exact: true });
  await small.focus();
  await page.keyboard.down("ArrowRight");
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  await page.keyboard.up("ArrowRight");
  // WASD follows the same wrapping behavior as Radix's native arrow navigation.
  await page.keyboard.press("d");
  await expect(page.getByRole("radio", { name: "75%", exact: true })).toBeFocused();
  await expect(page.getByRole("radio", { name: "75%", exact: true })).toBeChecked();
  await page.keyboard.press("a");
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeFocused();
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await reloadHome(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await expect(sound).not.toBeChecked();
  await expect(master).toHaveAttribute("aria-valuetext", "40%");
  await expect(backgroundMute).not.toBeChecked();
});

import { expect } from "@playwright/test";
import { run } from "../support/game";
import { reloadHome, test, seed, state, resume } from "./support/session";

test("settings and glossary return to the pause menu; End journey immediately shows results", async ({
  page,
}) => {
  await seed(page, run());
  await expect(page.getByRole("button", { name: "End journey", exact: true })).toHaveCount(0);
  await resume(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await page.getByRole("switch", { name: "Sound", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  await expect(page.getByRole("main", { name: "Glossary & controls" })).toBeVisible();
  await page.keyboard.press("Escape");
  const end = page
    .getByRole("dialog", { name: "Pause menu" })
    .getByRole("button", { name: "End journey", exact: true });
  const red = await page
    .locator(":root")
    .evaluate((element) => getComputedStyle(element).getPropertyValue("--destructive-text").trim());
  const resolvedRed = await end.evaluate((element, color) => {
    const probe = document.createElement("span");
    probe.style.color = color;
    element.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, red);
  await expect(end).toHaveCSS("color", resolvedRed);
  await expect(end.locator("svg.lucide-log-out")).toHaveCSS("stroke", resolvedRed);
  await end.hover();
  await expect(end).toHaveCSS("color", resolvedRed);
  await expect(end.locator("svg")).toHaveCSS("stroke", resolvedRed);
  expect((await state(page)).phase).toBe("battle");
  await end.click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Main menu", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  expect((await state(page)).phase).toBe("defeat");
});

test("shadcn tabs and settings retain native keyboard behavior and game navigation", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const all = page.getByRole("tab", { name: "All", exact: true });
  await all.focus();
  await page.keyboard.press("ArrowRight");
  const known = page.getByRole("tab", { name: "Collected", exact: true });
  await expect(known).toBeFocused();
  await expect(known).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    (await known.getAttribute("id")) as string,
  );
  await page.keyboard.press("d");
  await expect(page.getByRole("tab", { name: "Uncollected", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  const sound = page.getByRole("switch", { name: "Sound", exact: true });
  await sound.focus();
  await page.keyboard.press("Space");
  await expect(sound).not.toBeChecked();
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
});

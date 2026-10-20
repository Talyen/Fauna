import { test, expect } from "@playwright/test";
test("Collection filtering, audio preferences, and diagnostics remain menu-driven", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.getByRole("tab", { name: "Unknown", exact: true }).click();
  await expect(page.getByRole("img", { name: "Locked species" })).toHaveCount(1);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Collection", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await page.getByRole("slider", { name: "Master volume", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByLabel("Master volume value", { exact: true })).toHaveText("40%");
  await page.getByRole("switch", { name: "Mute in background", exact: true }).click();
  await page.getByRole("tab", { name: "Diagnostics", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy diagnostics", exact: true })).toBeVisible();
  await page.screenshot({ path: "reports/adoption-settings.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await expect(page.getByLabel("Master volume value", { exact: true })).toHaveText("40%");
  await expect(page.getByRole("switch", { name: "Mute in background", exact: true })).not.toBeChecked();
});

for (const [width, height, textScale] of [
  [1280, 800, "1"],
  [1920, 1080, "1"],
  [960, 540, "1.5"],
] as const) {
  test(`settings categories remain reachable at ${width}x${height} with ${Number(textScale) * 100}% text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript((scale) => localStorage.setItem("fauna.text-scale", scale), textScale);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    for (const category of ["Display", "Sound", "Diagnostics"]) {
      await page.getByRole("tab", { name: category, exact: true }).click();
      const panel = page.getByRole("tabpanel");
      await expect(panel).toBeVisible();
      const control =
        category === "Display"
          ? panel.getByRole("radio", { name: "150%", exact: true })
          : category === "Sound"
            ? panel.getByRole("switch", { name: "Mute in background", exact: true })
            : panel.getByRole("button", { name: "Copy diagnostics", exact: true });
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport();
      await page.screenshot({ path: `reports/settings-${category.toLowerCase()}-${width}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  });
}

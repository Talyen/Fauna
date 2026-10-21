import { test, expect } from "@playwright/test";
test("Collection filtering, audio preferences, and settings remain menu-driven", async ({ page }) => {
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
  await expect(page.getByRole("tab", { name: "Diagnostics", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy diagnostics", exact: true })).toHaveCount(0);
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
  [960, 540, "1.25"],
] as const) {
  test(`settings categories remain reachable at ${width}x${height} with ${Number(textScale) * 100}% text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript((scale) => localStorage.setItem("fauna.text-scale", scale), textScale);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    for (const category of ["Display", "Sound", "Battle"]) {
      await page.getByRole("tab", { name: category, exact: true }).click();
      const panel = page.getByRole("tabpanel");
      await expect(panel).toBeVisible();
      const control =
        category === "Display"
          ? panel.getByRole("radio", { name: "125%", exact: true })
          : category === "Sound"
            ? panel.getByRole("switch", { name: "Mute in background", exact: true })
            : panel.getByRole("switch", { name: "Auto-end turn", exact: true });
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport();
      await page.screenshot({ path: `reports/settings-${category.toLowerCase()}-${width}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  });
}

for (const width of [1280, 1920])
  test(`illustrated Boons and independent tooltip sizing at ${width}`, async ({ page }) => {
    const { run } = await import("../unit/helpers");
    const fixture = structuredClone(run(7));
    fixture.boons = ["tattered-pages", "bone-charm", "ironwood-buckler", "icy-heart"];
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate((data) => localStorage.setItem("fauna.save.v1", data), JSON.stringify(fixture));
    await page.reload();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("radio", { name: "125%", exact: true }).click();
    await page.getByRole("radio", { name: "Tooltip 125%", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    const art = page.getByRole("button", { name: "Inspect Mossback", exact: true });
    await art.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    expect(await page.getByRole("tooltip").evaluate((node) => getComputedStyle(node).fontSize)).toBe("20px");
    expect(await art.evaluate((node) => node.getBoundingClientRect().width)).toBeCloseTo(266.667, 0);
    await page.screenshot({ path: `reports/tooltip-independent-${width}.png` });
    await page.getByRole("button", { name: "Back", exact: true }).click();
    const opener = page.getByRole("button", { name: "Boons", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Boons", exact: true });
    await expect(dialog.getByRole("heading", { name: "Tattered Pages", exact: true })).toBeVisible();
    await expect(dialog).toContainText("Restore 3 Health when you defeat an enemy.");
    await dialog
      .locator("img")
      .evaluateAll((images) => Promise.all(images.map((img) => (img as HTMLImageElement).decode())));
    expect(
      await dialog
        .locator(".action-card")
        .first()
        .evaluate((node) => node.getBoundingClientRect().width),
    ).toBeCloseTo(200, 0);
    await page.screenshot({ path: `reports/owned-boons-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!))).toEqual(fixture);
    await page.reload();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Tooltip 125%", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  });

for (const width of [1280, 1920])
  test(`Merchant purchase resumes without duplicate spending at ${width}`, async ({ page }) => {
    const { accept, winBattle } = await import("../unit/helpers");
    const { createGame } = await import("../../src/game/engine");
    let fixture = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
    fixture = winBattle(accept(fixture, { type: "beginBattle" }));
    fixture = accept(fixture, { type: "skipRecruit" });
    const offers = fixture.expedition!.offers;
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((save) => {
      if (!localStorage.getItem("fauna.save.v1")) localStorage.setItem("fauna.save.v1", save);
      localStorage.setItem("fauna.text-scale", "1.25");
    }, JSON.stringify(fixture));
    await page.goto("/");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Inspect Merchant", exact: true }).click();
    await page.keyboard.press("Escape");
    expect(
      JSON.parse((await page.evaluate(() => localStorage.getItem("fauna.save.v1"))) ?? "{}").revision,
    ).toBe(fixture.revision);
    await page.getByRole("button", { name: "Inspect Merchant", exact: true }).click();
    await page.getByRole("button", { name: "Enter", exact: true }).click();
    await page.getByRole("button", { name: "Buy · 20 Gold", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Owned", exact: true })).toBeDisabled();
    await page.screenshot({ path: `reports/merchant-${width}.png`, fullPage: true });
    await page.reload();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Merchant", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Owned", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Leave", exact: true }).click();
    await expect(page.getByRole("button", { name: "Inspect Merchant", exact: true })).toHaveCount(0);
    const saved = JSON.parse((await page.evaluate(() => localStorage.getItem("fauna.save.v1"))) ?? "{}");
    expect(saved.currency).toBe(0);
    expect(saved.journey.currency).toBe(20);
    expect(saved.expedition.offers).toEqual(offers);
  });

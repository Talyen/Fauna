import { expect } from "@playwright/test";
import { GLOSSARY } from "../../src/game/glossary";
import { run } from "../support/game";
import { test, seed, state, resume, reloadHome } from "./support/session";
import { gamepad } from "./support/gamepad";
import { captureScreen } from "./support/rendered-evidence";
import { layoutViolations } from "./support/layout-contract";

test("Glossary scrolling reaches the final rule across sizes and returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const press = await gamepad(page);
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, run());
  const before = await state(page);
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  const region = page.getByRole("region", { name: "Glossary entries" });
  for (const [width, height, scale] of [
    [1280, 720, 1.25],
    [1920, 1080, 1],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page
      .locator("html")
      .evaluate((el, scale) => el.style.setProperty("--text-scale", String(scale)), scale);
    await region.focus();
    await page.keyboard.press("Home");
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(region.locator("dt")).toHaveCount(GLOSSARY.length);
    await captureScreen(page, { path: `reports/secondary/glossary-${width}-top.png` });
    if (width === 1280) {
      await region.hover();
      await page.mouse.wheel(0, 300);
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await region.focus();
      await page.keyboard.press("Home");
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(0);
      await page.keyboard.press("PageDown");
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await page.keyboard.press("Home");
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(0);
      await press(13);
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(region).toBeFocused();
    }
    await page.keyboard.press("End");
    await expect
      .poll(() => region.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
      .toBeLessThan(2);
    const last = region.locator("dl").last();
    await expect(last).toBeInViewport();
    await captureScreen(page, { path: `reports/secondary/glossary-${width}-bottom.png` });
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Glossary", exact: true })).toBeFocused();
  expect(await state(page)).toEqual(before);
});

test("persistent saving failure fits both sizes and clears after automatic recovery", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  const fixture = run();
  await seed(page, fixture);
  await page.evaluate(() => {
    const target = window as unknown as { testSaveFails: boolean };
    target.testSaveFails = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (target.testSaveFails && key.startsWith("fauna.save.v1"))
        throw new DOMException("full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await resume(page);
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "error");
  await expect(page.locator(".save-notice")).toHaveCount(0);
  // Exercise the real retry and UI subscription without waiting five wall-clock seconds per retry.
  await page.clock.fastForward(5000);
  await expect(page.locator(".save-notice")).toBeVisible();
  await captureScreen(page, { path: "reports/secondary/save-unavailable-1280.png" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await captureScreen(page, { path: "reports/secondary/save-unavailable-1920.png" });
  await page.evaluate(() => {
    (window as unknown as { testSaveFails: boolean }).testSaveFails = false;
  });
  await page.clock.fastForward(5000);
  await expect(page.locator(".save-notice")).toHaveCount(0);
  const recovered = await state(page);
  expect(recovered.phase).toBe("battle");
  expect(recovered.battle!.turn).toBe(fixture.battle!.turn + 1);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(recovered);
});

test("layout checks permit only named, focusable secondary scroll regions and still catch clipping", async ({
  page,
}) => {
  await page.setContent(
    '<main class="app glossary-screen"><div data-scroll-region role="region" aria-label="Rules" tabindex="0" style="height:80px;overflow-y:auto;overflow-x:hidden"><p style="height:200px">First</p><button style="height:44px">Last</button></div></main>',
  );
  expect(await page.evaluate(layoutViolations)).toEqual([]);
  await page.locator("[data-scroll-region]").evaluate((el) => {
    el.removeAttribute("aria-label");
  });
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("scroll area"))).toBe(true);
  await page.locator("[data-scroll-region]").evaluate((el) => {
    el.setAttribute("aria-label", "Rules");
  });
  await page.locator("main").evaluate((el) => {
    el.setAttribute("class", "app battle-screen");
  });
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("scroll area"))).toBe(true);
  await page.locator("main").evaluate((el) => {
    el.setAttribute("class", "app glossary-screen");
  });
  await page.locator("[data-scroll-region]").evaluate((el) => {
    el.style.overflowY = "hidden";
  });
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("clipped content"))).toBe(
    true,
  );
});

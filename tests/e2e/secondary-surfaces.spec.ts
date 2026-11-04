import { expect } from "@playwright/test";
import { run } from "../support/game";
import { test, seed, state, resume, reloadHome } from "./support/session";
import { captureScreen } from "./support/rendered-evidence";
import { layoutViolations } from "./support/layout-contract";

test("persistent saving failure fits both sizes and clears after automatic recovery", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.test.text-scale", "1.25"));
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

test("layout checks reject scrolling and hidden clipping", async ({ page }) => {
  await page.setContent(
    '<main class="app settings-screen"><div data-scroll-region role="region" aria-label="Rules" tabindex="0" style="height:80px;overflow-y:auto;overflow-x:hidden"><p style="height:200px">First</p><button style="height:44px">Last</button></div></main>',
  );
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("scroll area"))).toBe(true);
  await page.locator("[data-scroll-region]").evaluate((element) => {
    element.style.overflowY = "hidden";
  });
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("clipped content"))).toBe(
    true,
  );
});

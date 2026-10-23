import { expect, type Page } from "@playwright/test";
import { test, seed, resume } from "../e2e/support/session";
import { run } from "../support/game";

// Sample real frame time without trace instrumentation
test.use({ realStartup: true, trace: "off" });

async function slider(page: Page, name: string, value: number) {
  const control = page.getByRole("slider", { name, exact: true });
  await control.focus();
  await page.keyboard.press(value === 0 ? "Home" : "End");
  await expect(control).toHaveAttribute("aria-valuenow", String(value));
}

test("records battle and menu frame pacing with background effects at zero and full intensity", async ({
  page,
}, info) => {
  await seed(page, run());
  await page.bringToFront();
  const observations = [];
  for (const intensity of [0, 100]) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await slider(page, "Background Glow", intensity);
    await slider(page, "Background Particles", intensity);
    await page.keyboard.press("Escape");
    for (const scene of ["menu", "battle"]) {
      if (scene === "battle") await resume(page);
      if (scene === "menu") await page.getByRole("button", { name: "Continue", exact: true }).hover();
      else await page.locator(".hand .action-card").first().hover();
      await page.waitForTimeout(900);
      const sample = await page.evaluate(async () => {
        const frames: number[] = [];
        let previous = performance.now();
        await new Promise<void>((resolve) => {
          const frame = (now: number) => {
            frames.push(now - previous);
            previous = now;
            if (frames.length < 120) requestAnimationFrame(frame);
            else resolve();
          };
          requestAnimationFrame(frame);
        });
        frames.sort((a, b) => a - b);
        return {
          frames: frames.length,
          p50: frames[Math.floor(frames.length * 0.5)],
          p95: frames[Math.floor(frames.length * 0.95)],
          over33: frames.filter((value) => value > 33.3).length,
          backgroundCanvases: document.querySelectorAll(".effect-backdrop canvas").length,
        };
      });
      observations.push({ scene, intensity, ...sample });
      if (scene === "battle") {
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        await page.getByRole("button", { name: "Main menu", exact: true }).click();
      }
    }
  }
  await info.attach("effect-performance.json", {
    body: JSON.stringify(
      { runtime: "Chromium", viewport: page.viewportSize(), motion: "normal", observations },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

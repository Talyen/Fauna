import { test, expect, type Page } from "@playwright/test";
import { produce } from "immer";
import { run, winBattle } from "../support/game";
import { decodeSave } from "../../src/game/save";
import { combat } from "../../src/game/combat/index";
import { seed, resume, state } from "./support/session";
import { captureScreen } from "./support/rendered-evidence";

test.use({ reducedMotion: "no-preference", video: { mode: "on", size: { width: 1280, height: 800 } } });

async function slider(page: Page, name: string, value: number) {
  const control = page.getByRole("slider", { name, exact: true });
  await control.focus();
  await page.keyboard.press(value === 0 ? "Home" : "End");
  await expect(control).toHaveAttribute("aria-valuenow", String(value));
}

test("keyword effects follow battle hover, Death's Door, inspection, settings and live reduced motion", async ({
  page,
}) => {
  const game = produce(run(), (draft) => {
    combat(draft.team[0]!).grace = 2;
    combat(draft.team[0]!).deathDoorUsed = true;
    draft.team[0]!.health = 1;
  });
  decodeSave(JSON.stringify(game));
  await seed(page, game);
  await page.bringToFront();
  await resume(page);
  await expect(page.locator('[data-testid="background-particles"]')).toHaveCount(1);
  await expect(page.locator('.creature-card[data-effect-urgent="true"]')).toHaveCount(1);
  const before = await state(page);
  const card = page.locator(".hand .action-card").first();
  await card.hover();
  const keywords = await card.getAttribute("data-effect-keywords");
  await expect(page.locator(".effect-plasma")).toHaveAttribute("data-plasma-primary", "#7dd3fc");
  await expect(page.locator(".effect-plasma")).toHaveAttribute("data-plasma-secondary", "#c4b5fd");
  expect(
    await page
      .locator(":root")
      .evaluate((element) => getComputedStyle(element).getPropertyValue("--keyword-consume").trim()),
  ).toBe("#a78bfa");
  await expect(page.locator(".effect-backdrop")).toHaveAttribute("data-active-palette", keywords!);
  await expect(page.locator(".mana-full").first()).toHaveCSS("background-image", /prepared\/objects/);
  await captureScreen(page, { path: "effects-battle.png" });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await slider(page, "Background Glow", 0);
  await slider(page, "Background Particles", 0);
  await expect(page.locator('canvas[data-testid="global-plasma-background"]')).toHaveCount(0);
  await expect(page.locator('canvas[data-testid="background-particles"]')).toHaveCount(0);
  await slider(page, "Background Glow", 100);
  await slider(page, "Background Particles", 100);
  await expect(page.locator('canvas[data-testid="background-particles"]')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".effect-backdrop canvas")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator('canvas[data-testid="background-particles"]')).toHaveCount(1);
  expect(await state(page)).toEqual(before);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.getByRole("button", { name: "Inspect Mossguard", exact: true }).click();
  await expect(page.locator(".effect-backdrop")).toHaveAttribute("data-active-palette", "block stun health");
  await captureScreen(page, { path: "effects-collection.png" });
  expect(await state(page)).toEqual(before);
});

test("inspection owns the opaque backdrop and restores the underlying recruit palette", async ({ page }) => {
  await seed(page(winBattle()));
  await page.bringToFront();
  await resume(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const before = await state(page);
  await page.locator(".recruit-options .creature-card").first().click();
  await expect(page.locator(".inspection-overlay .effect-backdrop")).toHaveCount(1);
  await expect(page.locator(".effect-root .effect-backdrop")).toHaveCount(0);
  await captureScreen(page, { path: "effects-inspection.png" });
  await page.locator(".inspection-thumbnails .action-card").first().click();
  await page.keyboard.press("ArrowRight");
  await captureScreen(page, { path: "effects-inspection-card.png" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(".effect-root .effect-backdrop")).toHaveCount(1);
  expect(await state(page)).toEqual(before);
});

test("plasma uses static fallback on unavailable/lost WebGL and restores without duplicate renderers", async ({
  page,
}) => {
  await seed(page, run());
  await page.bringToFront();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const canvas = page.getByTestId("global-plasma-background");
  await canvas.evaluate((element) =>
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(page.getByTestId("static-plasma-background")).toHaveCount(1);
  await captureScreen(page, { path: "effects-fallback.png" });
  await canvas.evaluate((element) => element.dispatchEvent(new Event("webglcontextrestored")));
  await expect(page.getByTestId("static-plasma-background")).toHaveCount(0);
  await expect(canvas).toHaveCount(1);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      return kind === "webgl" ? null : Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("static-plasma-background")).toHaveCount(1);
  await slider(page, "Background Glow", 0);
  await expect(page.getByTestId("static-plasma-background")).toHaveCount(0);
});

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

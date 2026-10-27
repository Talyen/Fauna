import { expect, type Page } from "@playwright/test";
import { produce } from "immer";
import { run, winBattle } from "../support/game";
import { ensureCombat } from "../../src/game/combat/index";
import { reloadHome, test, seed, resume, state } from "./support/session";
import { captureScreen } from "./support/rendered-evidence";

test.use({
  reducedMotion: "no-preference",
  video: process.env.FAUNA_EFFECT_VIDEO === "1" ? { mode: "on", size: { width: 1280, height: 800 } } : "off",
});

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
    ensureCombat(draft.team[0]!).grace = 2;
    ensureCombat(draft.team[0]!).deathDoorUsed = true;
    draft.team[0]!.health = 1;
  });
  await seed(page, game);
  await page.bringToFront();
  await resume(page);
  await expect(page.locator('[data-testid="background-particles"]')).toHaveCount(1);
  await expect(page.locator('.creature-card[data-effect-urgent="true"]')).toHaveCount(1);
  const before = await state(page);
  const card = page.locator(".hand .action-card").first();
  const shine = card.locator(":scope > .effect-shine-border");
  const urgentShine = page.locator('.creature-card[data-effect-urgent="true"] > .effect-shine-border');
  await page.mouse.move(0, 0);
  await expect(shine).toHaveCSS("opacity", "0");
  await expect(urgentShine).toHaveCSS("opacity", "0");
  await expect(page.locator(".combatant-details .effect-shine-border")).toHaveCount(0);
  await card.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(":root")).toHaveAttribute("data-focus", "visible");
  await card.focus();
  await expect(shine).toHaveCSS("opacity", "1");
  await expect(card).toHaveCSS("outline-style", "none");
  await card.hover();
  await expect(shine).toHaveCSS("opacity", "1");
  expect(await card.evaluate((element) => getComputedStyle(element, "::after").borderTopColor)).toBe(
    "rgba(0, 0, 0, 0)",
  );
  const targeted = page.locator('.hand .action-card[data-card-id="ally-2:prismram-attack"]');
  await targeted.click();
  await page.mouse.move(0, 0);
  await expect(targeted).toHaveAttribute("aria-pressed", "true");
  await expect(targeted.locator(":scope > .effect-shine-border")).toHaveCSS("opacity", "0");
  await expect(page.locator(".creature-wrap[data-acting] .effect-shine-border")).toHaveCSS("opacity", "0");
  await expect(urgentShine).toHaveCSS("opacity", "0");
  await page.keyboard.press("Escape");
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
  await page
    .locator(".mana-full")
    .first()
    .evaluate(async (element) => {
      const image = new Image();
      image.src = getComputedStyle(element).backgroundImage.slice(5, -2);
      await image.decode();
    });
  await captureScreen(page, { path: "effects-battle.png" });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.locator('[data-menu-action="talents"] .effect-shine-border')).toHaveCount(0);
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

test("inspection owns a dimmed backdrop and restores the underlying recruit palette", async ({ page }) => {
  await seed(page, winBattle());
  await page.bringToFront();
  await resume(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const before = await state(page);
  await page.locator(".recruit-options .creature-card").first().click({ button: "right" });
  await expect(page.locator(".inspection-overlay .effect-backdrop")).toHaveCount(1);
  await expect(page.locator(".effect-root .effect-backdrop")).toHaveCount(0);
  await expect(page.locator(".inspection")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".inspection-overlay")).toHaveCSS("background-color", "rgba(0, 0, 0, 0.8)");
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
  await reloadHome(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("static-plasma-background")).toHaveCount(1);
  await slider(page, "Background Glow", 0);
  await expect(page.getByTestId("static-plasma-background")).toHaveCount(0);
});

import { expect, type Locator, type Page } from "@playwright/test";
import { assetUrl } from "../../src/ui/shared/assets";
import { run } from "../support/game";
import { test, resume } from "./support/session";
import { captureFrame } from "./support/rendered-evidence";
import { fits } from "./support/layout";

test.use({ realStartup: true });

async function holdStartupResource(page: Page, url: string | RegExp, abort = false) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    await held;
    await (abort ? route.abort() : route.continue());
  });
  return release;
}

async function splashSnapshot(splash: Locator) {
  return splash.evaluate((element) => {
    const { x, y, width, height } = element.querySelector(".startup-title")!.getBoundingClientRect();
    return {
      id: (element as HTMLElement).dataset.testIdentity,
      bounds: [x, y, width, height],
      time: element.querySelector(".startup-logo-fill")!.getAnimations()[0]!.currentTime as number,
    };
  });
}

const startupLayouts = [
  [1280, 720, 1.25],
  [1920, 1080, 1],
] as const;

test("one splash survives delayed React and reveals a ready menu at both sizes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  const errors: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  const allowReact = await holdStartupResource(page, /\/(?:src\/main\.tsx|assets\/main-[^/]+\.js)(?:\?.*)?$/);
  const allowArt = await holdStartupResource(page, `**/${assetUrl("logo.main-menu").slice(2)}`);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.getByRole("status", { name: "Loading Fauna" });
  await expect(splash).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await splash.evaluate((element) => ((element as HTMLElement).dataset.testIdentity = "original"));
  const before = await splashSnapshot(splash);
  await expect(page.locator("#root")).toBeEmpty();
  await expect(page.locator(".startup-leaf")).toHaveCount(5);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim(),
    ),
  ).toBe("1.25");
  await captureFrame(page, { path: "pre-react-1280.png" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator("html").evaluate((el) => el.style.setProperty("--text-scale", "1"));
  const wideBefore = await splashSnapshot(splash);
  await captureFrame(page, { path: "pre-react-1920.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator("html").evaluate((el) => el.style.setProperty("--text-scale", "1.25"));
  await expect(page.locator("#startup-splash-phrase")).not.toHaveText("Adventure awaits…");
  allowReact();
  // Main CSS has arrived; the same title must keep its geometry and animation clock.
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.styleSheets].some(
          (sheet) =>
            sheet.href?.includes("main-") || sheet.ownerNode?.textContent?.includes(".app > .screen-stage"),
        ),
      ),
    )
    .toBe(true);
  const after = await splashSnapshot(splash);
  expect(after.id).toBe("original");
  expect(after.time).toBeGreaterThan(before.time);
  expect(after.bounds).toEqual(before.bounds);
  await captureFrame(page, { path: "react-loading-1280.png" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator("html").evaluate((el) => el.style.setProperty("--text-scale", "1"));
  expect((await splashSnapshot(splash)).bounds).toEqual(wideBefore.bounds);
  await captureFrame(page, { path: "react-loading-1920.png" });
  allowArt();
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
  expect(await page.evaluate(() => performance.now())).toBeGreaterThanOrEqual(5000);
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  await page.locator(".menu-logo img").evaluate((image: HTMLImageElement) => image.decode());
  for (const [width, height, scale] of startupLayouts) {
    await page.setViewportSize({ width, height });
    await page
      .locator("html")
      .evaluate((el, value) => el.style.setProperty("--text-scale", String(value)), scale);
    await fits(page);
    await captureFrame(page, { path: `menu-${width}.png` });
  }
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BUTTON");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your starter", exact: true })).toBeVisible();
  await page
    .locator(".draft-grid img")
    .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
  expect(errors).toEqual([]);
  // Warm-cache timing is viewport independent.
  await page.reload();
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
  expect(await page.evaluate(() => performance.now())).toBeGreaterThanOrEqual(5000);
});

test("slow essential art holds the splash, and an image error still permits play", async ({ page }) => {
  const release = await holdStartupResource(page, `**/${assetUrl("logo.main-menu").slice(2)}`, true);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status", { name: "Loading Fauna" })).toBeVisible();
  await page.waitForFunction(() => performance.now() >= 5100);
  await expect(page.locator("#root")).toBeEmpty();
  release();
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
});

test("reduced motion stays static, dismisses without a fade and resumes a saved battle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const game = run(7);
  await page.addInitScript((game) => localStorage.setItem("fauna.save.v1", JSON.stringify(game)), game);
  // Keep the splash available for inspection even if the driver is delayed past its minimum
  const release = await holdStartupResource(page, `**/${assetUrl("logo.main-menu").slice(2)}`);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  try {
    await expect(page.getByRole("status", { name: "Loading Fauna" })).toBeVisible();
    await expect(page.locator(".startup-leaves")).toBeHidden();
    await expect(page.locator(".startup-logo-fill")).toHaveCSS("animation-name", "none");
    await expect(page.locator("#startup-splash-phrase")).toHaveText("Adventure awaits…");
    await captureFrame(page, { path: "reduced-motion.png" });
  } finally {
    release();
  }
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
  expect(await page.evaluate(() => performance.now())).toBeGreaterThanOrEqual(5000);
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  await fits(page);
});

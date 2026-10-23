import { test, expect } from "@playwright/test";
import { assetUrl } from "../../src/ui/shared/assets";
import { run } from "../support/game";
import { seed, resume } from "./support/session";
import { fits } from "./support/layout";

for (const [width, height, scale] of [
  [1280, 720, 1.25],
  [1920, 1080, 1],
] as const) {
  test(`one splash survives delayed React, then reveals a ready menu at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript((scale) => localStorage.setItem("fauna.text-scale", String(scale)), scale);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    let allowReact = () => {};
    const blocked = new Promise<void>((resolve) => {
      allowReact = resolve;
    });
    await page.route(/\/(?:src\/main\.tsx|assets\/main-[^/]+\.js)(?:\?.*)?$/, async (route) => {
      await blocked;
      await route.continue();
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const splash = page.getByRole("status", { name: "Loading Fauna" });
    await expect(splash).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await splash.evaluate((element) => {
      (element as HTMLElement).dataset.testIdentity = "original";
      const title = element.querySelector(".startup-title")!;
      const bounds = title.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        time: element.querySelector(".startup-logo-fill")!.getAnimations()[0]!.currentTime as number,
      };
    });
    await expect(page.locator("#root")).toBeEmpty();
    await expect(page.locator(".startup-leaf")).toHaveCount(5);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim(),
      ),
    ).toBe(String(scale));
    await page.screenshot({ path: info.outputPath("pre-react.png") });
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
    const after = await splash.evaluate((element) => {
      const bounds = element.querySelector(".startup-title")!.getBoundingClientRect();
      return {
        id: (element as HTMLElement).dataset.testIdentity,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        time: element.querySelector(".startup-logo-fill")!.getAnimations()[0]!.currentTime as number,
      };
    });
    expect(after.id).toBe("original");
    expect(after.time).toBeGreaterThan(before.time);
    expect([after.x, after.y, after.width, after.height]).toEqual([
      before.x,
      before.y,
      before.width,
      before.height,
    ]);
    await page.screenshot({ path: info.outputPath("react-loading.png") });
    await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
    expect(await page.evaluate(() => performance.now())).toBeGreaterThanOrEqual(5000);
    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
    await page.locator(".menu-logo img").evaluate((image: HTMLImageElement) => image.decode());
    await fits(page);
    await page.screenshot({ path: info.outputPath("menu.png") });
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BUTTON");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose your starter", exact: true })).toBeVisible();
    await page
      .locator(".draft-grid img")
      .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
    expect(errors).toEqual([]);
    // A warm-cache navigation still gets the intentional minimum, without a production skip flag.
    await page.reload();
    await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
    expect(await page.evaluate(() => performance.now())).toBeGreaterThanOrEqual(5000);
  });
}

test("slow essential art holds the splash, and an image error still permits play", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/${assetUrl("logo.main-menu").slice(2)}`, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status", { name: "Loading Fauna" })).toBeVisible();
  await page.waitForFunction(() => performance.now() >= 5100);
  await expect(page.locator("#root")).toBeEmpty();
  release();
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
});

test("reduced motion stays static, dismisses without a fade and resumes a saved battle", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const game = run(7);
  await page.addInitScript((game) => localStorage.setItem("fauna.save.v1", JSON.stringify(game)), game);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status", { name: "Loading Fauna" })).toBeVisible();
  await expect(page.locator(".startup-leaves")).toBeHidden();
  await expect(page.locator(".startup-logo-fill")).toHaveCSS("animation-name", "none");
  await expect(page.locator("#startup-splash-phrase")).toHaveText("Adventure awaits…");
  await page.screenshot({ path: info.outputPath("reduced-motion.png") });
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
  expect(await page.evaluate(() => performance.now())).toBeGreaterThanOrEqual(5000);
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  await fits(page);
  await seed(page, game);
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
});

import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run against this task's owned quiet preview, never an existing player's profile.
const root = fileURLToPath(new URL("../../", import.meta.url));
const [origin, label = "candidate"] = process.argv.slice(2);
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(origin) || !/^[a-z0-9-]+$/.test(label))
  throw new Error("Usage: node design/visual-quality/capture.mjs http://127.0.0.1:PORT label");
const identity = await fetch(new URL("/__fauna_preview", origin));
if (!identity.ok || !/^[a-f0-9-]{36}$/.test(await identity.text()))
  throw new Error("Use an owned npm run preview:task session.");
const output = path.join(root, "reports/visual-quality", label);
await mkdir(output, { recursive: true });
const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom" });
let fixture, battle, unavailable, layoutViolations;
try {
  const { createGame } = await server.ssrLoadModule("/src/game/engine.ts");
  const { accept, winBattle, recruitChoice, run } = await server.ssrLoadModule("/tests/support/game.ts");
  ({ layoutViolations } = await server.ssrLoadModule("/tests/e2e/support/layout-contract.ts"));
  fixture = accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0] }), {
    type: "start",
  });
  fixture = winBattle(accept(fixture, { type: "beginBattle" }));
  fixture = accept(fixture, recruitChoice(fixture));
  battle = run(42);
  unavailable = { ...accept(fixture, { type: "enterSupport", visit: fixture.support.id }), currency: 0 };
} finally {
  await server.close();
}
const browser = await chromium.launch({ headless: true });
const evidence = [];
try {
  for (const [width, height, scale] of [
    [1920, 1080, 1],
    [1280, 720, 1],
    [1280, 720, 1.25],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(
        ({ save, scale }) => {
          if (!localStorage.getItem("fauna.save.v1")) localStorage.setItem("fauna.save.v1", save);
          localStorage.setItem("fauna.text-scale", String(scale));
        },
        { save: JSON.stringify(fixture), scale },
      );
      await page.goto(origin);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: "Visit Boon Merchant", exact: true }).click();
      async function capture(name, resting = true) {
        await page.evaluate(() => document.fonts.ready);
        await page
          .locator("main img")
          .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
        if (resting) await page.mouse.move(0, 0);
        const failures = await page.evaluate(layoutViolations);
        expect(failures).toEqual([]);
        const file = `${name}-${width}-${scale}.png`;
        await page.screenshot({ path: path.join(output, file) });
        evidence.push({ file, width, height, scale, errors: [...errors], layoutFailures: failures });
        expect(errors).toEqual([]);
      }
      await capture("merchant");
      const before = JSON.parse(await page.evaluate(() => localStorage.getItem("fauna.save.v1")));
      const inspect = page.getByRole("button", { name: /^Inspect / }).first();
      await inspect.hover();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await capture("inspection", false);
      await page.keyboard.press("Escape");
      // The top-level Escape opens Pause; closing it must return to this visit.
      const menu = page.getByRole("button", { name: "Continue", exact: true });
      if (await menu.isVisible()) await menu.click();
      const buy = page.getByRole("button", { name: /^Buy / }).first();
      await buy.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("region", { name: "Purchased Boon" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeFocused();
      await capture("purchased");
      await expect
        .poll(
          async () => JSON.parse(await page.evaluate(() => localStorage.getItem("fauna.save.v1"))).currency,
        )
        .toBe(before.currency - before.support.stock[0].price);
      const purchased = JSON.parse(await page.evaluate(() => localStorage.getItem("fauna.save.v1")));
      await page.reload();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("region", { name: "Purchased Boon" })).toBeVisible();
      expect(JSON.parse(await page.evaluate(() => localStorage.getItem("fauna.save.v1")))).toEqual(purchased);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("button", { name: "Visit Boon Merchant", exact: true })).toHaveCount(0);
      if (width === 1920) {
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        await page.getByRole("button", { name: "Settings", exact: true }).click();
        await capture("settings-benchmark");
        // A fresh context below captures a fixed dense combat fixture.
      }
    } finally {
      await context.close();
    }
  }
  const unavailableContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
  });
  try {
    const page = await unavailableContext.newPage();
    await page.addInitScript((save) => {
      localStorage.setItem("fauna.save.v1", save);
      localStorage.setItem("fauna.text-scale", "1.25");
    }, JSON.stringify(unavailable));
    await page.goto(origin);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const buy = page.getByRole("button", { name: /^Buy / });
    await expect(buy).toHaveCount(3);
    await expect(buy.first()).toHaveAttribute("aria-disabled", "true");
    await buy.first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Boon Merchant stock" })).toBeVisible();
    await expect(page.getByText("Not enough Gold", { exact: true })).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator("main img")
      .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    const failures = await page.evaluate(layoutViolations);
    expect(failures).toEqual([]);
    await page.screenshot({ path: path.join(output, "unavailable-1280-1.25.png") });
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem("fauna.save.v1")))).toEqual(unavailable);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("region", { name: "Boon Merchant stock" })).toHaveCount(0);
    evidence.push({
      file: "unavailable-1280-1.25.png",
      width: 1280,
      height: 720,
      scale: 1.25,
      layoutFailures: failures,
    });
  } finally {
    await unavailableContext.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript((save) => localStorage.setItem("fauna.save.v1", save), JSON.stringify(battle));
    await page.goto(origin);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator("main img")
      .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(output, "battle-benchmark-1920-1.png") });
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(
    path.join(output, "evidence.json"),
    JSON.stringify(
      {
        commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
        dirty: execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim(),
        seed: 7,
        motion: "reduce",
        evidence,
      },
      null,
      2,
    ),
  );
}
console.log(`Focused Merchant evidence: ${output}`);

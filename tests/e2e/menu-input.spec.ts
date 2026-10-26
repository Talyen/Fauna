import { controller } from "./support/gamepad";
import { openHome, reloadHome, test } from "./support/session";
import { captureScreen, settleScreen } from "./support/rendered-evidence";
import { expect, type Locator } from "@playwright/test";
import { accept, run } from "../support/game";
import { createGame } from "../../src/game/engine";
import { produce } from "immer";
import { BOONS } from "../../src/game/content";

async function expectCenteredMenu(choices: Locator) {
  const buttons = await choices.locator("button").evaluateAll((elements) =>
    elements.map((element) => {
      const icon = element.querySelector("svg")!;
      const label = Array.from(element.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )!;
      const range = document.createRange();
      range.selectNodeContents(label);
      const textBounds = range.getBoundingClientRect();
      const buttonBounds = element.getBoundingClientRect();
      const iconBounds = icon.getBoundingClientRect();
      const buttonCenter = buttonBounds.left + buttonBounds.width / 2;
      return {
        iconLabelGap: textBounds.left - iconBounds.right,
        groupCenterOffset: (iconBounds.left + textBounds.right) / 2 - buttonCenter,
        labelLines: range.getClientRects().length,
      };
    }),
  );
  for (const button of buttons) {
    expect(button.labelLines).toBe(1);
    expect(Math.abs(button.iconLabelGap - 8)).toBeLessThan(1);
    expect(Math.abs(button.groupCenterOffset)).toBeLessThan(1);
  }
}

test("pointer menu transitions never display focus indicators", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.keyboard.down("Escape");
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await page.keyboard.down("Escape");
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await page.keyboard.up("Escape");
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  await expect(settings).toBeFocused();
  await expect(settings).toHaveCSS("outline-style", "none");
  await expect(settings).toHaveCSS("box-shadow", "none");
  await page.keyboard.press("s");
  const end = page.getByRole("button", { name: "End journey", exact: true });
  await expect(end).toBeFocused();
  await expect(end).toHaveCSS("outline-style", "solid");
  await page.mouse.move(20, 20);
  await expect(end).toHaveCSS("outline-style", "none");
  await captureScreen(page, { path: "reports/menu-pointer.png" });
  const menu = page.getByRole("dialog", { name: "Pause menu" });
  await expect(menu.getByRole("button", { name: "Close menu" })).toHaveCount(0);
  await page.mouse.click(20, 20);
  await expect(menu).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await menu.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(menu).toHaveCount(0);
});

test("minimum-size enlarged menus fit every action without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  // Include both optional entries so the tallest browser menu must fit.
  const game = produce(
    accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
      type: "start",
    }),
    (draft) => {
      draft.boons = [BOONS[0]!.id];
    },
  );
  await page.addInitScript((value) => {
    localStorage.setItem("fauna.text-scale", "1.25");
    localStorage.setItem("fauna.save.v1", value);
  }, JSON.stringify(game));
  await openHome(page);
  const homeChoices = page.getByRole("navigation", { name: "Main menu" });
  await expectCenteredMenu(homeChoices);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Pause menu" });
  await expect(dialog.getByRole("heading", { name: "Fauna", exact: true })).toHaveCount(0);
  const choices = dialog.getByRole("navigation", { name: "Pause menu" });
  const opener = page.locator('.play-surface button[aria-label="Open menu"]');
  const anchor = (await opener.boundingBox())!;
  const panel = (await dialog.boundingBox())!;
  expect(panel.x + panel.width).toBeCloseTo(anchor.x + anchor.width);
  expect(panel.y).toBeGreaterThanOrEqual(16);
  expect(panel.y + panel.height).toBeLessThanOrEqual(704);
  expect(await page.locator(".dialog-overlay").count()).toBe(0);
  const iconOffsets = await choices.locator("button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const element = button as HTMLButtonElement;
      const bounds = element.getBoundingClientRect();
      const icon = button.querySelector("svg")!.getBoundingClientRect();
      // Compare layout columns independently of the intentional hover/focus scale.
      const scale = bounds.width / element.offsetWidth;
      return element.offsetLeft + (icon.left - bounds.left) / scale;
    }),
  );
  for (const offset of iconOffsets) expect(offset).toBeCloseTo(iconOffsets[0]!);
  const heights = await dialog
    .locator("button:not(.dialog-close)")
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  expect(heights.every((height) => height >= 44)).toBe(true);
  for (const name of ["Talents", "Collection", "Boons", "Glossary", "Settings", "End journey", "Main menu"]) {
    await page.keyboard.press("s");
    const choice = page.getByRole("button", { name, exact: true });
    await expect(choice).toBeFocused();
    await expect(choice).toBeInViewport();
  }
  await captureScreen(page, { path: "reports/menu-short.png" });
});

test("controller menu journey at minimum size with enlarged text", async ({ page }) => {
  const [width, height, enlarged] = [1280, 720, true] as const;
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pad = await controller(page);
  const collection = {
    ...createGame(7),
    discovery: { encountered: ["mossguard"], recruited: { mossguard: 1 } },
    starterOffers: ["mossguard"],
  };
  await page.addInitScript((save) => localStorage.setItem("fauna.save.v1", save), JSON.stringify(collection));
  if (enlarged) await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await openHome(page);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
  await pad.frames();
  await pad.press(13);
  await expect(page.getByRole("button", { name: "Talents", exact: true })).toBeFocused();
  await pad.press(15);
  await expect(page.getByRole("button", { name: "Collection", exact: true })).toBeFocused();
  await captureScreen(page, { path: `reports/menu-home-${width}.png` });
  await pad.press(0);
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeFocused();
  await settleScreen(page);
  const card = page.locator(".collection-grid button:focus");
  for (let row = 0; row < 3 && !(await card.count()); row++) await pad.press(13);
  await expect(card).toHaveCount(1);
  const opener = await card.getAttribute("aria-label");
  await captureScreen(page, { path: `reports/menu-collection-${width}.png` });
  await pad.press(2);
  await expect(page.locator(".creature-inspection")).toBeVisible();
  await expect(page.locator(".inspection-thumbnails .action-card").first()).toBeFocused();
  await expect(page.locator(".inspection-thumbnails .action-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Rooted Stomp,/ })).toHaveAttribute(
    "aria-label",
    /Deal 2 Stun damage to all enemies/,
  );
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await captureScreen(page, { path: `reports/menu-collection-kit-${width}.png` });
  await pad.press(0);
  await expect(page.getByRole("dialog", { name: "Rooted Stomp details", exact: true })).toBeVisible();
  await pad.press(15);
  await expect(page.getByRole("dialog", { name: "Moss Renewal details", exact: true })).toBeVisible();
  await pad.press(1);
  await expect(page.getByRole("button", { name: /^Moss Renewal,/ })).toBeFocused();
  await pad.press(1);
  await expect(page.getByRole("button", { name: opener!, exact: true })).toBeFocused();
  await pad.press(1);
  await expect(page.getByRole("button", { name: "Collection", exact: true })).toBeFocused();
  await pad.press(13);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await pad.press(14);
  await expect(page.getByRole("button", { name: "Glossary", exact: true })).toBeFocused();
  await pad.press(0);
  const glossary = page.getByRole("main", { name: "Glossary & controls" });
  await pad.press(13);
  const entries = glossary.getByRole("region", { name: "Glossary entries" });
  await expect(entries).toBeFocused();
  await pad.press(13);
  await expect.poll(() => entries.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await glossary.evaluate((el) => el.scrollTop)).toBe(0);
  await pad.press(1);
  await expect(page.getByRole("button", { name: "Glossary", exact: true })).toBeFocused();
  await pad.press(15);
  await pad.press(0);
  await expect(page.getByRole("tab", { name: "Display", exact: true })).toBeFocused();
  await pad.press(15);
  await expect(page.getByRole("tab", { name: "Sound", exact: true })).toBeFocused();
  const sound = page.getByRole("switch", { name: "Sound", exact: true });
  await pad.press(13);
  await expect(sound).toBeFocused();
  await pad.press(0);
  await expect(sound).not.toBeChecked();
  await pad.press(13);
  const master = page.getByRole("slider", { name: "Master volume", exact: true });
  await expect(master).toBeFocused();
  await pad.press(14);
  await expect(master).toHaveAttribute("aria-valuenow", "40");
  await pad.press(12);
  await pad.press(12);
  await pad.press(14);
  await expect(page.getByRole("tab", { name: "Display", exact: true })).toBeFocused();
  await pad.press(13);
  await expect(page.getByRole("radio", { name: enlarged ? "125%" : "100%", exact: true })).toBeFocused();
  await pad.press(15);
  await expect(page.getByRole("radio", { name: enlarged ? "75%" : "125%", exact: true })).toBeChecked();
  await captureScreen(page, { path: `reports/menu-settings-${width}.png` });
  await pad.press(1);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.mouse.move(20, 20);
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-focus", "hidden");
  const outlined = await page
    .locator(":focus")
    .evaluateAll((els) =>
      els.some(
        (el) => getComputedStyle(el).outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none",
      ),
    );
  expect(outlined).toBe(false);
});

test("controller reconnection and background input cannot activate journey commands", async ({ page }) => {
  const pad = await controller(page);
  await page.addInitScript((value) => localStorage.setItem("fauna.save.v1", value), JSON.stringify(run()));
  await openHome(page);
  await pad.frames();
  await pad.press(0);
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-phase", "battle");
  const revision = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision as number);
  const before = await revision();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.testPad.buttons[3]!.pressed = true;
  });
  await pad.frames();
  expect(await revision()).toBe(before);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await pad.frames();
  expect(await revision()).toBe(before);
  await page.evaluate(() => {
    window.testPad.buttons[3]!.pressed = false;
    window.testPad.connected = false;
  });
  await pad.frames();
  const pause = page.getByRole("dialog", { name: "Pause menu" });
  await expect(pause).toBeVisible();
  await page.evaluate(() => {
    window.testPad.buttons[3]!.pressed = true;
    window.testPad.connected = true;
  });
  await pad.frames();
  expect(await revision()).toBe(before);
  await page.evaluate(() => {
    window.testPad.buttons[3]!.pressed = false;
  });
  await pad.frames();
  await pad.press(3);
  await expect(pause).toBeVisible();
  expect(await revision()).toBe(before);
  await pad.press(1);
  await expect(pause).toHaveCount(0);
  await pad.press(3);
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
  await expect.poll(revision).toBe(before + 1);
});

test("mouse use cancels held-stick navigation until release", async ({ page }) => {
  const pad = await controller(page);
  await openHome(page);
  const fresh = createGame(7);
  const collected = fresh.starterOffers[0]!;
  const started = accept(accept(fresh, { type: "draft", species: collected }), { type: "start" });
  const later = accept(accept(started, { type: "abandon" }), { type: "newRun", seed: 7 });
  await page.evaluate((data) => localStorage.setItem("fauna.save.v1", data), JSON.stringify(later));
  await reloadHome(page);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
  await pad.frames();
  await page.evaluate(() => {
    window.testPad.axes = [0, 1];
  });
  await pad.frames();
  // A held direction may already have repeated by the time the driver reads focus
  await expect(page.getByRole("button", { name: "Play", exact: true })).not.toBeFocused();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "controller");
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.clock.fastForward(1000);
  await pad.frames();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeFocused();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-focus", "hidden");
  await page.evaluate(() => {
    window.testPad.axes = [0, 0];
  });
  await pad.frames();
  await pad.press(13);
  await expect(page.locator(".collection-grid button:focus")).toHaveCount(1);
  await page.mouse.wheel(0, 80);
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-focus", "hidden");
});

test("controller can dismiss Pause or end the journey immediately", async ({ page }) => {
  const pad = await controller(page);
  await page.addInitScript((value) => localStorage.setItem("fauna.save.v1", value), JSON.stringify(run()));
  await openHome(page);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeFocused();
  await pad.frames();
  await pad.press(0);
  await pad.press(1);
  for (let i = 0; i < 5; i++) await pad.press(13);
  await expect(page.getByRole("button", { name: "End journey", exact: true })).toBeFocused();
  await pad.press(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).revision)).toBe(
    run().revision,
  );
  await pad.press(1);
  for (let i = 0; i < 5; i++) await pad.press(13);
  await expect(page.getByRole("button", { name: "End journey", exact: true })).toBeFocused();
  await pad.press(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Main menu", exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!).phase))
    .toBe("defeat");
});

test("pointer use has no native or shadcn focus decoration in settings, tabs or pause", async ({ page }) => {
  await page.addInitScript((value) => localStorage.setItem("fauna.save.v1", value), JSON.stringify(run()));
  await openHome(page);
  const noDecoration = async () => {
    const styles = await page.locator(":focus").evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return { outline: style.outlineStyle, shadow: style.boxShadow };
      }),
    );
    expect(styles.length).toBeGreaterThan(0);
    await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-focus", "hidden");
    expect(styles).toEqual(styles.map(() => ({ outline: "none", shadow: "none" })));
  };
  await noDecoration();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await noDecoration();
  await page.getByRole("radio", { name: "125%", exact: true }).click();
  await noDecoration();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await noDecoration();
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  await page.getByRole("button", { name: "Burn talents", exact: true }).click();
  await noDecoration();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeFocused();
  await noDecoration();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeFocused();
  await noDecoration();
});

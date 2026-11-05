import { captureScreen, settleScreen } from "./support/rendered-evidence";
import { expect, type Locator } from "@playwright/test";
import { produce } from "immer";
import { run } from "../support/game";
import { test, seed, state, resume } from "./support/session";

function targetingBattle() {
  return produce(run(7), (d) => {
    const cards = d.cards.filter((c) =>
      ["emberback-attack", "prismram-attack", "prismram-spectrum-lance"].includes(c.definitionId),
    );
    d.battle!.hand = cards.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !cards.some((a) => a.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
  });
}

test("battle targeting uses remembered targets, forecasts bars, and has no targeted Play button", async ({
  page,
}) => {
  const fixture = targetingBattle();
  await page.addInitScript(() => localStorage.setItem("fauna.test.text-scale", "1.25"));
  await seed(page, fixture);
  await resume(page);
  const before = await state(page);
  const cards = page.locator(".app:not([inert]) .hand .action-card");
  await cards.first().focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".app:not([inert]) .player-row .creature-card:focus")).toHaveCount(1);
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card:focus")).toHaveCount(1);
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await cards.first().focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Target Pollenmoth", exact: true })).toBeFocused();
  await expect(page.locator(".enemy-row .target-preview")).toBeVisible();
  await expect(page.locator(".confirm-play")).toHaveCount(0);
  expect((await state(page)).revision).toBe(before.revision);
  await page.keyboard.press("Escape");
  await cards.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Target Pollenmoth", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  expect((await state(page)).revision).toBe(before.revision + 1);
  await expect(page.locator(".health-number,.intent,.battle-status,.pile-counts")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Mana \d of 4$/ })).toBeVisible();
});

for (const handSize of [4, 7]) {
  test(`battle icons and raised ${handSize}-card fan retain their layout`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => localStorage.setItem("fauna.test.text-scale", "1.25"));
    const fixture = produce(run(7), (draft) => {
      draft.battle!.enemies[0]!.block = 5;
      Object.assign(draft.battle!.enemies[0]!.combat, {
        armor: 3,
        thorns: 2,
        dodge: 10,
        burn: 1,
        poison: 1,
        bleed: 1,
        stun: 1,
        freeze: 1,
      });
      if (handSize === 7) draft.boons.push("facet-abacus");
      draft.battle!.hand = draft.cards.slice(0, handSize).map((card) => card.id);
      draft.battle!.draw = draft.cards.slice(handSize).map((card) => card.id);
      draft.battle!.discard = [];
    });
    await seed(page, fixture);
    await resume(page);
    await page.mouse.move(0, 0);
    await settleScreen(page);
    const geometry = await page.evaluate(() => {
      const active = document.querySelector(".app:not([inert])")!;
      const artNode = active.querySelector(".enemy-row .creature-card")!;
      const art = artNode.getBoundingClientRect();
      const statusNode = active.querySelector(".enemy-row .combat-status")!;
      const status = statusNode.getBoundingClientRect();
      const icons = [...statusNode.querySelectorAll(".status-icon")];
      const slots = [...active.querySelectorAll<HTMLElement>(".hand-slot")].sort(
        (a, b) =>
          Math.abs(Number(a.style.getPropertyValue("--fan-offset"))) -
          Math.abs(Number(b.style.getPropertyValue("--fan-offset"))),
      );
      const middle = slots[0]!.querySelector(".action-card")!;
      const handCss = getComputedStyle(middle);
      const handWidth = parseFloat(handCss.width);
      const handHeight = parseFloat(handCss.height);
      return {
        artWidth: art.width,
        glow: getComputedStyle(artNode).boxShadow,
        artBorder: getComputedStyle(artNode).borderTopWidth,
        handBorder: getComputedStyle(middle).borderTopWidth,
        artworkAreaRatio: (art.width * art.height) / (handWidth * handHeight),
        frameTop: art.top,
        toolbarBottom: active.querySelector(".autoplay-control")!.getBoundingClientRect().bottom,
        healthGaps: [...active.querySelectorAll(".creature-wrap")].map((wrap) => {
          const artwork = wrap.querySelector(".creature-card")!.getBoundingClientRect();
          const bar = wrap.querySelector(".health-forecast .progress-track")!.getBoundingClientRect();
          return Math.abs(artwork.bottom - bar.bottom);
        }),
        centerClipping: middle.getBoundingClientRect().bottom - innerHeight,
        fanStep: getComputedStyle(active.querySelector(".battle-screen")!).getPropertyValue(
          "--hand-fan-angle-step",
        ),
        statusCount: icons.length,
        statusText: statusNode.textContent,
        paging: statusNode.querySelectorAll(".pagination").length,
        iconFilters: icons.map((el) => getComputedStyle(el.querySelector("svg")!).filter),
        iconBelow: icons.every((el) => el.querySelector("svg")!.getBoundingClientRect().top >= art.bottom),
        centered: Math.abs(status.left + status.width / 2 - art.left - art.width / 2),
      };
    });
    expect(geometry.artworkAreaRatio).toBeCloseTo(1.21, 3);
    expect(geometry.frameTop).toBeLessThan(geometry.toolbarBottom);
    expect(geometry.healthGaps.every((gap) => gap < 0.1)).toBe(true);
    expect(geometry.glow).toBe("none");
    expect(geometry.artBorder).toBe("1px");
    expect(geometry.handBorder).toBe("1px");
    expect(geometry.centerClipping).toBeGreaterThan(0);
    expect(geometry.centerClipping).toBeLessThanOrEqual(4.1);
    expect(geometry.fanStep.trim()).toBe("4.2deg");
    expect(geometry.statusCount).toBe(8);
    expect(geometry.statusText).toBe("");
    expect(geometry.paging).toBe(0);
    expect(geometry.iconFilters.every((filter) => filter === "none")).toBe(true);
    expect(geometry.iconBelow).toBe(true);
    expect(geometry.centered).toBeLessThanOrEqual(1);
  });
}

test("idle enemy clicks open kit inspection without changing battle or portrait", async ({ page }) => {
  await seed(page, targetingBattle());
  await resume(page);
  const enemy = page.locator(".app:not([inert]) .enemy-row .creature-card").first();
  const before = await state(page);
  await enemy.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await settleScreen(page);
  const beforeScale = await enemy.evaluate((element) => getComputedStyle(element).scale);
  await page.mouse.down();
  expect(await enemy.evaluate((element) => getComputedStyle(element).scale)).toBe(beforeScale);
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await state(page)).toEqual(before);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await state(page)).toEqual(before);
});

test("battle tooltips, pointer targeting, Mana forecast and corners follow the design system", async ({
  page,
}) => {
  const expectCorners = async (el: Locator, radius: number) => {
    await expect(el).toHaveCSS("border-top-left-radius", `${radius}px`);
    expect(["round", "superellipse(1)"]).toContain(
      await el.evaluate((node) => getComputedStyle(node).getPropertyValue("corner-shape")),
    );
  };
  const fixture = produce(targetingBattle(), (d) => {
    d.battle!.enemies[0]!.health = 1;
  });
  await seed(page, fixture);
  await resume(page);
  const enemy = page.locator(".app:not([inert]) .enemy-row .creature-card").first();
  await enemy.hover();
  await expect(page.locator(".game-tooltip").first()).toHaveAttribute("data-side", "bottom");
  await expectCorners(page.locator(".game-tooltip").first(), 20);
  const ally = page.locator(".app:not([inert]) .player-row .creature-card").first();
  await ally.hover();
  await expect(page.locator(".game-tooltip").first()).toHaveAttribute("data-side", "top");
  const card = page.locator(".app:not([inert]) .hand .action-card").first();
  await card.hover();
  await expect(page.locator(".game-tooltip").first()).toHaveAttribute("data-side", "top");
  await card.click();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  expect(await enemy.evaluate((el) => el === document.activeElement)).toBe(false);
  await expect(page.locator(".game-tooltip")).toHaveCount(0);
  await expect(page.locator(".app:not([inert]) .player-row .invalid-target")).toHaveCount(3);
  await expect(page.locator('.mana-gem[data-preview-spent="true"]')).toHaveCount(1);
  await expect(page.locator(".knockout-preview")).toHaveCount(0);
  await enemy.hover();
  await expect(page.locator(".knockout-preview")).toHaveCount(0);
  await expect(page.getByText("Possible knockout", { exact: true })).toBeVisible();
  expect((await state(page)).battle!.mana).toBe(4);
  await page.mouse.move(0, 0);
  await expect(page.locator(".game-tooltip")).toHaveCount(0);
  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page
          .locator(".battle-screen img")
          .evaluateAll((images) =>
            images.every(
              (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await enemy.hover();
    await expect(page.locator(".knockout-preview")).toHaveCount(0);
    await expect(page.getByText("Possible knockout", { exact: true })).toBeVisible();
    await captureScreen(page, { path: `reports/battle-review/targeting-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await settleScreen(page);
  for (const el of [enemy, ally, card]) await expectCorners(el, 30);
  await expectCorners(page.locator(".end-turn"), 12);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".battle-screen")).toHaveAttribute("data-selected-card", "");
  await expect(page.locator('.mana-gem[data-preview-spent="true"]')).toHaveCount(0);
  await card.click();
  await enemy.click();
  await expect(page.locator(".app:not([inert]) .enemy-row .knocked-out")).toHaveCount(1);
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card")).toHaveCount(3);
  expect(
    await page
      .locator(".app:not([inert]) .hand .action-card")
      .evaluateAll((cards) => cards.some((c) => c === document.activeElement)),
  ).toBe(false);
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  await page.locator(".app:not([inert]) .hand .action-card").first().click();
  await ally.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator(".app:not([inert]) .enemy-row .creature-wrap:not(.knocked-out) .creature-card:focus"),
  ).toHaveCount(1);
  await card.hover();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "keyboard");
});

test("navigation returns to the nearest remaining card; invalid targets do nothing", async ({ page }) => {
  const fixture = targetingBattle();
  await seed(page, fixture);
  await resume(page);
  const cards = page.locator(".app:not([inert]) .hand .action-card");
  const last = await cards.nth(2).getAttribute("data-card-id");
  await cards.nth(1).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator(`.app:not([inert]) .hand [data-card-id="${last}"]`)).toBeFocused();
  const before = await state(page);
  await cards.first().click();
  const unavailable = page.locator(".app:not([inert]) .player-row .invalid-target").first();
  await unavailable.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).revision).toBe(before.revision);
  await expect(page.locator(".battle-screen")).not.toHaveAttribute("data-selected-card", "");
});

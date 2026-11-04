import { settleScreen } from "./rendered-evidence";
import { expect, type Page } from "@playwright/test";

/** Measure one settled frame so geometry comparisons cannot span different hover/resize states. */
export async function expectBattleGeometry(page: Page, width: number, height: number) {
  await page.mouse.move(0, 0);
  await settleScreen(page);
  const layout = await page.locator(".app:not([inert]) .battle-screen").evaluate((board) => {
    const rect = (selector: string) => board.querySelector(selector)!.getBoundingClientRect().toJSON();
    const size = (element: Element) => ({
      width: (element as HTMLElement).offsetWidth,
      height: (element as HTMLElement).offsetHeight,
    });
    const [left, hand, right] = [...board.querySelector(".hand-toolbar")!.children].map((child) =>
      child.getBoundingClientRect().toJSON(),
    );
    return {
      fits: document.documentElement.scrollWidth <= innerWidth,
      creatures: [...board.querySelectorAll(":is(.player-row, .enemy-row) .creature-card")].map(size),
      cards: [...board.querySelectorAll(".hand .action-card")].map((card) => ({
        ...size(card),
        imageWidth: card.querySelector("img")!.getAttribute("width"),
        imageFit: getComputedStyle(card.querySelector("img")!).objectFit,
      })),
      gem: rect(".mana-gem").width,
      mana: rect(".mana"),
      end: rect(".end-turn"),
      draw: rect('[data-pile="draw"]'),
      discard: rect('[data-pile="discard"]'),
      piles: [...board.querySelectorAll("[data-pile]")].map(size),
      fan: [...board.querySelectorAll(".hand-slot")].map((el) => el.getBoundingClientRect().toJSON()),
      controls: [...board.querySelectorAll(".hand-toolbar .battle-dock button:enabled")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          bottom: r.bottom,
          hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        };
      }),
      dock: { left: left!, hand: hand!, right: right! },
    };
  });
  expect(layout.fits).toBe(true);
  expect(layout.creatures.length).toBeGreaterThan(0);
  for (const card of layout.creatures) {
    expect(Math.abs(card.width / card.height - 4 / 3)).toBeLessThan(0.015);
    expect(card.width).toBe(layout.creatures[0]!.width);
    expect(card.width).toBeGreaterThan(44);
  }
  const cardSize = { width: layout.cards[0]!.width, height: layout.cards[0]!.height };
  expect(Math.abs(cardSize.width / cardSize.height - 0.75)).toBeLessThan(0.01);
  expect(cardSize.width).toBeGreaterThan(44);
  expect(Math.abs(layout.creatures[0]!.width / cardSize.height - 1.1)).toBeLessThan(0.02);
  expect(layout.cards).toEqual(
    Array.from({ length: 6 }, () => ({ ...cardSize, imageWidth: "600", imageFit: "contain" })),
  );
  expect(layout.gem).toBeGreaterThanOrEqual(16);
  expect(layout.gem).toBeLessThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Swap", exact: true })).toHaveCount(0);
  const { mana, end, draw, discard, fan, dock } = layout;
  expect(mana.bottom).toBeLessThan(draw.y);
  expect(end.bottom).toBeLessThan(discard.y);
  expect(Math.abs(mana.x + mana.width / 2 - draw.x - draw.width / 2)).toBeLessThan(1);
  expect(Math.abs(end.x + end.width / 2 - discard.x - discard.width / 2)).toBeLessThan(1);
  expect(Math.abs(draw.bottom - discard.bottom)).toBeLessThan(1);
  for (const pile of [draw, discard]) {
    expect(pile.bottom).toBeLessThanOrEqual(height);
    expect(pile.bottom).toBeGreaterThan(height - cardSize.height / 2);
  }
  expect(fan).toHaveLength(6);
  expect(Math.abs(fan[0]!.top - fan[5]!.top)).toBeLessThan(1);
  expect(Math.abs(fan[1]!.top - fan[4]!.top)).toBeLessThan(1);
  const centers = fan.map((card) => card.top + card.height / 2);
  expect(centers[0]!).toBeGreaterThan(centers[1]!);
  expect(centers[1]!).toBeGreaterThan(centers[2]!);
  expect(fan[0]!.bottom).toBeGreaterThan(height);
  expect(fan[0]!.bottom).toBeLessThan(height + 96);
  expect(Math.abs(fan[2]!.bottom - height)).toBeLessThan(16);
  expect(layout.controls.length).toBeGreaterThan(0);
  for (const control of layout.controls) {
    expect(control.bottom).toBeLessThanOrEqual(height);
    expect(control.hit).toBe(true);
  }
  expect(Math.abs((dock.left.left + dock.right.right) / 2 - width / 2)).toBeLessThan(1);
  expect(Math.abs(dock.left.width - dock.right.width)).toBeLessThan(1);
  expect(dock.left.right).toBeLessThan(dock.hand.left);
  expect(dock.hand.right).toBeLessThan(dock.right.left);
  for (const pile of layout.piles) expect(Math.abs(pile.width / cardSize.width - 0.8)).toBeLessThan(0.01);
}

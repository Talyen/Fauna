import { expect, type Page } from "@playwright/test";

/** Geometry for the same seven-card fixture used by the hand interaction journey. */
export async function expectBattleGeometry(page: Page, width: number, height: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const area = (element: HTMLElement) => element.offsetWidth * element.offsetHeight;
  expect(
    await page
      .locator(".app:not([inert]) .player-row .creature-card")
      .first()
      .evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
  ).toEqual(
    height <= 760
      ? { width: 235, height: 176 }
      : height <= 900
        ? { width: 264, height: 198 }
        : { width: 293, height: 220 },
  );
  expect(
    await page
      .locator(".app:not([inert]) .hand .action-card")
      .first()
      .evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
  ).toEqual(
    height <= 760
      ? { width: 144, height: 192 }
      : height <= 900
        ? { width: 162, height: 216 }
        : { width: 180, height: 240 },
  );
  expect(
    await page
      .locator(".mana-gem")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBe(18);
  const mana = (await page.getByRole("button", { name: /^Mana / }).boundingBox())!;
  const end = (await page.getByRole("button", { name: /^End turn/ }).boundingBox())!;
  const swap = (await page.getByRole("button", { name: "Swap", exact: true }).boundingBox())!;
  expect(swap.y + swap.height).toBeLessThan(end.y);
  expect(Math.abs(swap.x - end.x)).toBeLessThan(1);
  const draw = (await page.locator('[data-pile="draw"]').boundingBox())!;
  const discard = (await page.locator('[data-pile="discard"]').boundingBox())!;
  expect(mana.y + mana.height).toBeLessThan(draw.y);
  expect(end.y + end.height).toBeLessThan(discard.y);
  expect(Math.abs(mana.x + mana.width / 2 - draw.x - draw.width / 2)).toBeLessThan(1);
  expect(Math.abs(end.x + end.width / 2 - discard.x - discard.width / 2)).toBeLessThan(1);
  for (const pile of [draw, discard]) expect(Math.abs(pile.y + pile.height - height + 24)).toBeLessThan(1);
  await page.mouse.move(0, 0);
  const fan = await page
    .locator(".app:not([inert]) .hand-slot")
    .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().toJSON()));
  expect(Math.abs(fan[0]!.top - fan[6]!.top)).toBeLessThan(1);
  expect(Math.abs(fan[1]!.top - fan[5]!.top)).toBeLessThan(1);
  expect(fan[0]!.top).toBeGreaterThan(fan[1]!.top);
  expect(fan[1]!.top).toBeGreaterThan(fan[2]!.top);
  {
    expect(fan[0]!.bottom).toBeGreaterThan(height);
    expect(fan[0]!.bottom).toBeLessThan(height + 64);
    expect(Math.abs(fan[3]!.bottom - height)).toBeLessThan(1);
  }
  const creatureArea = await page
    .locator(".app:not([inert]) .player-row .creature-card")
    .first()
    .evaluate(area);
  for (const card of await page.locator(".app:not([inert]) .hand .action-card").all())
    expect(Math.abs((await card.evaluate(area)) / creatureArea - (0.9 / 1.1) ** 2)).toBeLessThan(0.025);
  for (const control of await page
    .locator(".app:not([inert]) .hand-toolbar .battle-dock button:enabled")
    .all()) {
    const bounds = (await control.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    expect(
      await control.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
  }
  const dock = await page.locator(".app:not([inert]) .hand-toolbar").evaluate((element) => {
    const [left, hand, right] = [...element.children].map((child) => child.getBoundingClientRect().toJSON());
    return { left: left!, hand: hand!, right: right! };
  });
  expect(Math.abs((dock.left.left + dock.right.right) / 2 - width / 2)).toBeLessThan(1);
  expect(Math.abs(dock.left.width - dock.right.width)).toBeLessThan(1);
  expect(dock.left.right).toBeLessThan(dock.hand.left);
  expect(dock.hand.right).toBeLessThan(dock.right.left);
  const handWidth = await page
    .locator(".app:not([inert]) .hand .action-card")
    .first()
    .evaluate((element: HTMLElement) => element.offsetWidth);
  for (const pile of await page.locator(".app:not([inert]) [data-pile]").all()) {
    const pileWidth = await pile.evaluate((element: HTMLElement) => element.offsetWidth);
    expect(Math.abs(pileWidth / handWidth - 0.8)).toBeLessThan(0.01);
  }
}

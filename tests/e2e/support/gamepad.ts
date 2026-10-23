import { type Page } from "@playwright/test";

export async function gamepad(page: Page) {
  await page.addInitScript(() => {
    const pad = {
      mapping: "standard",
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    Object.assign(window, { testPad: pad });
  });
  return async (index: number) => {
    await page.evaluate(
      (i) =>
        ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
          true),
      index,
    );
    // Observe both edges in the same animation-frame loop that polls controllers.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await page.evaluate(
      (i) =>
        ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
          false),
      index,
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  };
}

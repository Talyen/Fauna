import { type Page } from "@playwright/test";

type SimulatedPad = {
  mapping: string;
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean; touched: boolean; value: number }[];
};
declare global {
  interface Window {
    testPad: SimulatedPad;
  }
}

export async function controller(page: Page) {
  const install = () => {
    window.testPad = {
      mapping: "standard",
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [window.testPad], configurable: true });
  };
  await page.addInitScript(install);
  if (page.url() !== "about:blank") await page.evaluate(install);
  const frames = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  return {
    frames,
    press: (index: number) =>
      page.evaluate(
        (index) =>
          new Promise<void>((resolve) => {
            // Keep a tap inside the browser; driver round trips can otherwise turn it into held input
            requestAnimationFrame(() => {
              window.testPad.buttons[index]!.pressed = true;
              requestAnimationFrame(() => {
                window.testPad.buttons[index]!.pressed = false;
                requestAnimationFrame(() => resolve());
              });
            });
          }),
        index,
      ),
  };
}
export async function gamepad(page: Page) {
  return (await controller(page)).press;
}

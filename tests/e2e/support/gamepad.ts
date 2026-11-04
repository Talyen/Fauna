import { type Page } from "@playwright/test";
/** Browser evidence for Steam Input's keyboard/pointer output, not native hardware. */
export async function controller(page: Page) {
  const keys: Record<number, string> = {
    0: "Enter",
    1: "Escape",
    2: "i",
    4: "F7",
    5: "Tab",
    12: "ArrowUp",
    13: "ArrowDown",
    14: "ArrowLeft",
    15: "ArrowRight",
  };
  return {
    frames: () => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))),
    press: async (index: number) => {
      if (index === 3) {
        await page.getByRole("button", { name: "End turn", exact: true }).focus();
        await page.keyboard.press("Enter");
        return;
      }
      const key = keys[index];
      if (!key) throw new Error(`No Steam Input mapping for button ${index}`);
      await page.keyboard.press(key);
    },
  };
}
export async function gamepad(page: Page) {
  return (await controller(page)).press;
}

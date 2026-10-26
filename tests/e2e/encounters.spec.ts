import { captureScreen, settleScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { produce } from "immer";
import { encounterSource } from "../../src/game/encounters";
import { createGame } from "../../src/game/engine";
import { authoredPack, accept } from "../support/game";
import { reloadHome, test, seed, state, resume } from "./support/session";

for (const [width, enlarged, encounter] of [
  [1280, true, 0],
  [1920, false, 3],
] as const)
  test(`encounter ${encounter} enters directly at ${width}, enlarged ${enlarged}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const game = produce(
      accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
        type: "start",
      }),
      (draft) => {
        draft.encounter = encounter;
        draft.expedition!.pack = authoredPack(draft.encounter);
        draft.journey!.victories = encounter;
      },
    );
    await seed(page, game);
    await resume(page);
    if (enlarged) {
      await page.getByRole("button", { name: "Open menu", exact: true }).click();
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("radio", { name: "125%", exact: true }).click();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    }
    const enter = page.getByRole("button", {
      name: encounter === 0 ? "Combat" : `Boss: ${encounterSource(game).enemies[0]!.name}`,
      exact: true,
    });
    await expect(page.locator(".app:not([inert]) [data-encounter]")).toHaveCount(1);
    await expect(page.locator(".app:not([inert]) [data-enemy-id]")).toHaveCount(0);
    await enter.locator("img").evaluate((image) => (image as HTMLImageElement).decode());
    if (encounter === 0) {
      await page.mouse.move(0, 0);
      await settleScreen(page);
      const bounds = (await enter.boundingBox())!;
      expect(bounds.width).toBeCloseTo((640 / 3) * 1.1, 1);
      expect(bounds.height).toBeCloseTo(176, 1);
    }
    await captureScreen(page, {
      path: `reports/encounters/choice-${encounter}-${width}-${enlarged}.png`,
    });
    await enter.focus();
    await page.keyboard.press("i");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await state(page)).toEqual(game);
    // Resume an unstarted boss destination before entering through the UI
    if (encounter === 3) {
      await reloadHome(page);
      await resume(page);
      expect(await state(page)).toEqual(game);
    }
    await enter.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
    expect((await state(page)).expedition!.pack).toEqual(game.expedition!.pack);
    // Battle inspection shortcuts are inert; current effects remain on hover/focus.
    const enemy = page.locator(".app:not([inert]) .enemy-row .creature-card").first();
    const before = await state(page);
    await enemy.focus();
    await page.keyboard.press("i");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("tooltip")).toBeVisible();
    expect(await state(page)).toEqual(before);
  });

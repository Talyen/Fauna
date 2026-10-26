import { seed, state, resume, reloadHome, test } from "./support/session";
import { expect } from "@playwright/test";
import { produce } from "immer";
import { species } from "../../src/game/content";
import { creaturePassive } from "../../src/game/progression";
import { accept, merchantDestination } from "../support/game";
import { expectScrollFree } from "./support/layout-contract";
import { captureScreen } from "./support/rendered-evidence";

test("Recruit details and four destination options fit enlarged text and recruitment survives reload", async ({
  page,
}) => {
  const game = produce(merchantDestination(), (draft) => {
    draft.expedition!.recruit = "cadenza";
    draft.team[0]!.health = 0;
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem("fauna.text-scale", "1.25");
    localStorage.setItem("fauna.tooltip-scale", "1.25");
  });
  await seed(page, game);
  await resume(page);
  await expect(page.locator(".destination-option")).toHaveCount(4);
  const recruit = page.getByRole("button", { name: "Recruit Cadenza", exact: true });
  await recruit.hover();
  const tooltip = page.locator(".game-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText(species("cadenza").name, { exact: true })).toBeVisible();
  await expect(tooltip.getByText(species("cadenza").trait, { exact: true })).toBeVisible();
  await expect(tooltip).toContainText(creaturePassive(game, "cadenza").description);
  await captureScreen(page, { path: "reports/recruit-destinations/details-1280.png" });
  await page.keyboard.press("Tab");
  await recruit.focus();
  await page.keyboard.press("Enter");
  await expect(recruit).toHaveCount(0);
  const expected = accept(game, { type: "recruitDestination", species: "cadenza" });
  expect(await state(page)).toEqual(expected);
  await reloadHome(page);
  await resume(page);
  await expect(page.getByRole("button", { name: "Recruit Cadenza", exact: true })).toHaveCount(0);
  expect(await state(page)).toEqual(expected);
  await expectScrollFree(page);
});

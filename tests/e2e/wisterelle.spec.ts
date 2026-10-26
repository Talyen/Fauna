import { expect } from "@playwright/test";
import { produce } from "immer";
import { species } from "../../src/game/content";
import { wisterelleBattle } from "../support/wisterelle";
import { test, seed, resume, state, reloadHome } from "./support/session";
import { fits } from "./support/layout";

test("Wisterelle targets a chosen backup, cancels safely, restores an ally and draws its card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, wisterelleBattle());
  await resume(page);
  const ability = (name: string) => page.locator(`.hand [data-card-id="ally-0:wisterelle-${name}"]`);
  const before = await state(page);
  await ability("forgotten-junction").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Swap in Mossguard from backup", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Swap in Coralcurl from backup", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ability("forgotten-junction")).toBeFocused();
  expect(await state(page)).toEqual(before);

  await ability("lantern-fare").click();
  await page.locator('[data-actor-id="ally-1"] .creature-card').click();
  expect((await state(page)).team[1]!.health).toBe(15);
  expect((await state(page)).battle!.mana).toBe(4);

  await ability("left-luggage").click();
  expect((await state(page)).team[1]!.health).toBe(16);
  await expect(page.locator('.hand [data-card-id="ally-1:emberback-attack"]')).toBeVisible();
  expect((await state(page)).battle!.mana).toBe(4);

  await ability("forgotten-junction").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Swap in Coralcurl from backup", exact: true }).focus();
  await page.keyboard.press("Enter");
  const after = await state(page);
  expect(after.team[0]!.id).toBe("backup-coralcurl");
  expect(after.battle!.mana).toBe(3);
  await fits(page);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(after);
});

test("Wisterelle cannot spend Lantern Fare on full Health or Left Luggage without an ally's discarded card", async ({
  page,
}) => {
  const game = produce(wisterelleBattle(), (draft) => {
    draft.team.forEach((unit) => {
      unit.health = species(unit.species).health;
    });
    draft.battle.draw.push(...draft.battle.discard.splice(0));
  });
  await seed(page, game);
  await resume(page);
  const before = await state(page);
  await page.locator('.hand [data-card-id="ally-0:wisterelle-left-luggage"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".target-summary")).toContainText("There are no eligible ally cards in Discard");
  await page.locator('.hand [data-card-id="ally-0:wisterelle-lantern-fare"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".target-summary")).toContainText("There are no injured allies");
  expect(await state(page)).toEqual(before);
});

import { expect } from "@playwright/test";
import { dulceraBattle } from "../support/dulcera";
import { test, seed, resume, state, reloadHome } from "./support/session";
import { fits } from "./support/layout";
import { captureScreen } from "./support/rendered-evidence";

test("Dulcera's abilities restore, protect and exchange the visible team with keyboard input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, dulceraBattle());
  await resume(page);

  const ability = (id: string) => page.locator(`.hand [data-card-id="ally-0:dulcera-${id}"]`);
  await ability("chapel-light").focus();
  await page.keyboard.press("Enter");
  let game = await state(page);
  expect(game.team[0]!.health).toBe(23);
  expect(game.battle!.mana).toBe(4);

  await ability("meadow-shelter").focus();
  await page.keyboard.press("Enter");
  game = await state(page);
  expect(game.team.map((unit) => unit.block)).toEqual([2, 2, 2]);
  expect(game.battle!.mana).toBe(3);

  await ability("hushed-waters").focus();
  await page.keyboard.press("Enter");
  game = await state(page);
  expect(game.team[0]!).toMatchObject({
    id: "backup-coralcurl",
    health: 13,
    combat: { poison: 0, freeze: 0, blind: false },
  });
  expect(game.team[1]!.combat!.poison).toBe(0);
  expect(game.reserves[0]!).toMatchObject({ species: "dulcera", combat: { burn: 3 } });
  expect(game.battle!.mana).toBe(2);
  await fits(page);
  await captureScreen(page, { path: "reports/dulcera/after-abilities.png" });

  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(game);
});

test("Dulcera's Collection inspection presents the concise rules and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, dulceraBattle());
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const opener = page.getByRole("button", { name: "Inspect Dulcera", exact: true });
  await opener.click();
  const details = page.locator(".creature-inspection");
  await expect(details).toContainText("Allies restore 1 Health when they swap in");
  for (const [name, rule] of [
    ["Chapel Light", "Restore 3 Health / Gain 1 Mana"],
    ["Meadow Shelter", "Allies gain 2 Block"],
    ["Hushed Waters", "Swap out for a random backup / Cleanse all allies"],
  ]) {
    await details.getByRole("button", { name: new RegExp(`^${name},`) }).hover();
    await expect(page.getByRole("tooltip")).toContainText(rule!);
  }
  await page.mouse.move(0, 0);
  await captureScreen(page, { path: "reports/dulcera/collection.png" });
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});

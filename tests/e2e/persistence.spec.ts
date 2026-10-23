import { expect } from "@playwright/test";
import { produce } from "immer";
import { species, BOONS } from "../../src/game/content";
import { accept, winBattle, run, bossReward } from "../support/game";
import { openHome, reloadHome, test, key, seed, saved, state, resume } from "./support/session";
import { continueToRecruit } from "./support/journey";

test("last mana saves the full turn before immediate close and does not replay on resume", async ({
  page,
  context,
}) => {
  const fixture = produce(run(), (d) => {
    d.battle!.mana = 1;
    const card = d.cards.find((c) => c.definitionId === "mossguard-attack")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await resume(page);
  await page.locator(".app:not([inert]) .hand .action-card").click();
  await saved(page);
  const committed = await state(page);
  expect(committed.battle!.turn).toBe(2);
  await page.close();
  const reopened = await context.newPage();
  await openHome(reopened);
  await resume(reopened);
  expect(await state(reopened)).toEqual(committed);
  await expect(reopened.locator(".combat-number")).toHaveCount(0);
});

test("rewards resume without duplicate XP, currency, recruitment or boons", async ({ page }) => {
  const recruitReward = winBattle();
  await seed(page, recruitReward);
  await resume(page);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(recruitReward);
  await continueToRecruit(page);
  expect(await state(page)).toEqual(recruitReward);
  const recruit = recruitReward.reward!.recruits[0]!;
  await page.getByRole("button", { name: `Recruit ${species(recruit).name}`, exact: true }).click();
  const recruited = accept(recruitReward, { type: "recruit", species: recruit });
  expect(await state(page)).toEqual(recruited);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(recruited);

  const fixture = bossReward();
  await seed(page, fixture);
  await resume(page);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(fixture);
  const boon = fixture.reward!.boons[0]!;
  const choice = page.getByRole("button", {
    name: `Choose ${BOONS.find((entry) => entry.id === boon)!.name}`,
    exact: true,
  });
  await page.keyboard.press("Tab");
  await choice.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Enter");
  const after = accept(fixture, { type: "chooseBoon", boon });
  expect(await state(page)).toEqual(after);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(after);
});

test("corrupt saves recover backups and all-invalid saves continue silently", async ({ page }) => {
  await openHome(page);
  await page.evaluate(
    ({ key, game }) => {
      localStorage.setItem(key, "broken");
      localStorage.setItem(`${key}.backup1`, game);
    },
    { key, game: JSON.stringify(run()) },
  );
  await reloadHome(page);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  const recovered = accept(run(), { type: "endTurn" });
  expect(await state(page)).toEqual(recovered);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(recovered);
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, "broken");
  }, key);
  await reloadHome(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("fresh fixture seeding preserves init preferences and never resets a later save on reload", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, run(7));
  expect(await page.evaluate(() => localStorage.getItem("fauna.text-scale"))).toBe("1.25");
  await seed(page, run(8));
  await reloadHome(page);
  expect(await state(page)).toEqual(run(8));
  expect(await page.evaluate(() => localStorage.getItem("fauna.text-scale"))).toBe("1.25");
  await page.evaluate(() => localStorage.clear());
  await reloadHome(page);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
});

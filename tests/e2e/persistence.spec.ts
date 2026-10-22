import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { species } from "../../src/game/content";
import { BOONS } from "../../src/game/progression";
import { accept, winBattle, run, bossReward } from "../support/game";
import { key, seed, saved, state, resume } from "./support/session";

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
  await page.locator(".confirm-play").click();
  await saved(page);
  const committed = await state(page);
  expect(committed.battle!.turn).toBe(2);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await resume(reopened);
  expect(await state(reopened)).toEqual(committed);
  await expect(reopened.locator(".combat-number")).toHaveCount(0);
});

test("rewards resume without duplicate XP, currency, recruitment or boons", async ({ page }) => {
  const recruitReward = winBattle();
  await seed(page, recruitReward);
  await resume(page);
  await page.reload();
  await resume(page);
  expect(await state(page)).toEqual(recruitReward);
  const recruit = recruitReward.reward!.recruits[0]!;
  await page.getByRole("button", { name: `Recruit ${species(recruit).name}`, exact: true }).click();
  const recruited = accept(recruitReward, { type: "recruit", species: recruit });
  expect(await state(page)).toEqual(recruited);
  await page.reload();
  await resume(page);
  expect(await state(page)).toEqual(recruited);

  const fixture = bossReward();
  await seed(page, fixture);
  await resume(page);
  await page.reload();
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
  await page.reload();
  await resume(page);
  expect(await state(page)).toEqual(after);
});

test("corrupt saves recover backups and all-invalid saves continue silently", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ key, game }) => {
      localStorage.setItem(key, "broken");
      localStorage.setItem(`${key}.backup1`, game);
    },
    { key, game: JSON.stringify(run()) },
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  const recovered = accept(run(), { type: "endTurn" });
  expect(await state(page)).toEqual(recovered);
  await page.reload();
  await resume(page);
  expect(await state(page)).toEqual(recovered);
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, "broken");
  }, key);
  await page.reload();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

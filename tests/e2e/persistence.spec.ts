import { expect } from "@playwright/test";
import { produce } from "immer";
import { BOONS } from "../../src/game/content";
import { run, bossReward } from "../support/game";
import { openHome, reloadHome, test, key, seed, saved, state, resume } from "./support/session";

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
  await seed(page, run(8));
  await page.evaluate(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, fixture);
  expect(await page.evaluate(() => localStorage.getItem("fauna.text-scale"))).toBe("1.25");
  await reloadHome(page);
  expect(await state(page)).toEqual(fixture);
  expect(await page.evaluate(() => localStorage.getItem("fauna.text-scale"))).toBe("1.25");
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

test("Boon choice resumes without repeating the reward or earnings", async ({ page }) => {
  const fixture = bossReward();
  await seed(page, fixture);
  await resume(page);
  const boon = fixture.reward!.boons[0]!;
  const choice = page.getByRole("button", {
    name: `Choose ${BOONS.find((entry) => entry.id === boon)!.name}`,
    exact: true,
  });
  await page.keyboard.press("Tab");
  await choice.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Enter");
  const after = await state(page);
  expect(after.phase).toBe("teamSelection");
  expect(after.boons).toEqual([...fixture.boons, boon]);
  expect(after.journey!.currency).toBe(fixture.journey!.currency);
  expect(after.journey!.xp).toEqual(fixture.journey!.xp);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(after);
});

test("corrupt saves recover backups and all-invalid saves continue silently", async ({ page }) => {
  const fixture = run();
  await page.addInitScript(
    ({ key, game }) => {
      if (sessionStorage.getItem("fauna.test.corrupted")) return;
      sessionStorage.setItem("fauna.test.corrupted", "1");
      localStorage.setItem(key, "broken");
      localStorage.setItem(`${key}.backup1`, game);
    },
    { key, game: JSON.stringify(fixture) },
  );
  await openHome(page);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  const recovered = await state(page);
  expect(recovered.phase).toBe("battle");
  expect(recovered.battle!.turn).toBe(fixture.battle!.turn + 1);
  expect(recovered.team.map((creature) => creature.id)).toEqual(fixture.team.map((creature) => creature.id));
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
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
});

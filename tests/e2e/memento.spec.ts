import { expect } from "@playwright/test";
import { produce } from "immer";
import { authoredPack, accept, prepareDestination, run } from "../support/game";
import { ownedCards } from "../../src/game/team";
import { freshCombat } from "../../src/game/combat/index";
import { createPearls, summonEcho } from "../../src/game/combat/legendary";
import type { BattleState } from "../../src/game/types";
import { reloadHome, test, seed, state } from "./support/session";

function legendaryTeam() {
  return produce(run(), (draft) => {
    const previous = draft.team;
    const legendary = {
      id: "legend",
      species: "memento" as const,
      health: 60,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    };
    draft.team = [legendary];
    draft.reserves = [
      ...previous,
      { ...legendary, id: "backup-pollenmoth", species: "pollenmoth", health: 23, combat: freshCombat() },
    ];

    draft.discovery.encountered = [...new Set([...draft.discovery.encountered, "memento", "pollenmoth"])];
    draft.discovery.recruited.memento = 1;
    draft.discovery.recruited.pollenmoth = 1;
    draft.cards = ownedCards(legendary.id, legendary.species);
    draft.battle!.hand = draft.cards.slice(0, 4).map((card) => card.id);
    draft.battle!.draw = draft.cards.slice(4).map((card) => card.id);
    draft.battle!.discard = [];
    draft.battle!.buffer = [];
    for (const enemy of draft.battle!.enemies) enemy.targetId = legendary.id;
    summonEcho(draft as BattleState, legendary, "player", 6, []);
    summonEcho(draft as BattleState, legendary, "player", 6, []);
    createPearls(draft as BattleState, legendary, "player", 2, []);
  });
}

test("Legendary stays centered and only unplayed Pearls survive reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, legendaryTeam());
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const boss = await page.locator('.player-row [data-actor-id="legend"] .creature-card').boundingBox();
  expect(Math.abs(boss!.x + boss!.width / 2 - 640)).toBeLessThan(1);
  await expect(page.locator(".hand .action-card")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Swap", exact: true })).toHaveCount(0);
  const pearl = page.locator('.hand [data-effect="pearl"]').first();
  await expect(pearl).toHaveAccessibleName(/Consume/);
  const consumed = await pearl.getAttribute("data-card-id");
  await pearl.click();
  const saved = await state(page);
  expect(saved.cards.filter((card) => card.definitionId === "memento-pearl")).toHaveLength(1);
  expect(saved.cards.some((card) => card.id === consumed)).toBe(false);
  await reloadHome(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect(await state(page)).toEqual(saved);
});

test("enemy Echoes are targetable without being roster creatures", async ({ page }) => {
  const destination = produce(run(), (draft) => {
    prepareDestination(draft);
    draft.encounter = 3;
    draft.journey!.victories = 3;
    draft.expedition = { pack: authoredPack(draft.encounter), recruit: null, lastRoom: "boss" };
  });
  const fixture = produce(accept(destination, { type: "beginBattle" }), (draft) => {
    summonEcho(draft as BattleState, draft.battle!.enemies[0]!, "enemy", 6, []);
    const card = draft.cards.find((card) => card.definitionId === "emberback-attack")!;
    draft.battle!.hand = [card.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
  });
  await seed(page, fixture);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /^Ember Charge,/ }).click();
  await page.getByRole("button", { name: "Target Echo", exact: true }).click();
  const committed = await state(page);
  expect([...committed.team, ...committed.reserves].map((unit) => unit.species)).toEqual(
    [...fixture.team, ...fixture.reserves].map((unit) => unit.species),
  );
  expect(committed.battle!.minions![0]!.health).toBeLessThan(6);
});

test("a knocked-out Legendary offers all four living backups and clears its summons on replacement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const fixture = produce(legendaryTeam(), (d) => {
    d.team[0]!.health = 1;
    d.team[0]!.combat!.deathDoorUsed = true;
    d.team[0]!.combat!.burn = 1;
  });
  await seed(page, fixture);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect((await state(page)).battle!.minions!.map((echo) => echo.health)).toEqual([6, 6]);
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  const knockedOut = await state(page);
  expect(knockedOut.team[0]!.health).toBe(0);
  expect(knockedOut.battle!.minions!.map((echo) => echo.health)).toEqual([0, 0]);
  await expect(page.locator('.player-row [data-actor-id^="echo-legend-"]')).toHaveCount(0);
  const dialog = page.getByRole("dialog", { name: "Choose a replacement" });
  await expect(dialog.locator(".creature-card")).toHaveCount(5);
  for (const card of await dialog.locator(".creature-card").all()) await expect(card).toBeInViewport();
  await dialog.getByRole("button", { name: "Mossguard, backup", exact: true }).click();
  const next = await state(page);
  expect(next.team).toHaveLength(1);
  expect(next.team[0]!.species).toBe("mossguard");
  expect(next.battle!.minions!.map((echo) => echo.health)).toEqual([0, 0]);
  await expect(page.locator('.player-row [data-actor-id^="echo-legend-"]')).toHaveCount(0);
  expect(next.cards.some((card) => card.temporary)).toBe(false);
  await reloadHome(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect(await state(page)).toEqual(next);
});

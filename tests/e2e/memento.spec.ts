import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { accept, prepareDestination, run } from "../support/game";
import { ownedCards } from "../../src/game/team";
import { freshCombat } from "../../src/game/combat/index";
import { createPearls, summonEcho } from "../../src/game/combat/legendary";
import type { BattleState } from "../../src/game/types";
import { seed, state } from "./support/session";

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
    draft.reserves = [...previous, { ...legendary, id: "second-legend", combat: freshCombat() }];
    draft.roster = [...draft.team, ...draft.reserves].map((unit) => unit.species);
    draft.lineup = [legendary.id];
    draft.discovery.encountered.push("memento");
    draft.discovery.recruited.memento = 1;
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

test("Legendary stays centered; Swap shows all five roster creatures and Pearls survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, legendaryTeam());
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const boss = await page.locator('.player-row [data-actor-id="legend"] .creature-card').boundingBox();
  expect(Math.abs(boss!.x + boss!.width / 2 - 640)).toBeLessThan(1);
  await expect(page.locator(".hand .action-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Swap", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".creature-card")).toHaveCount(5);
  for (const creature of await dialog.locator(".creature-card").all())
    await expect(creature).toBeInViewport();
  await expect(dialog.getByRole("heading", { name: /^(Deployed|Backup)$/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Next page" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator('.hand [data-effect="pearl"]').first().click();
  const saved = await state(page);
  expect(saved.cards.filter((card) => card.definitionId === "memento-pearl")).toHaveLength(2);
  await page.reload();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect(await state(page)).toEqual(saved);
});

test("enemy Echoes are targetable without being roster creatures", async ({ page }) => {
  const destination = produce(run(), (draft) => {
    prepareDestination(draft);
    draft.encounter = 3;
    draft.journey!.victories = 3;
    draft.expedition = { pack: 0, recruit: null, lastRoom: "boss" };
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
  expect(committed.roster).toEqual(fixture.roster);
  expect(committed.battle!.minions![0]!.health).toBeLessThan(6);
});

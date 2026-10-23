import { authoredPack, swapFixture } from "../../../support/game";
import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, definition, FIRST_RUN_STARTERS, species } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { freshCombat } from "../../../../src/game/combat";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { actionValue, enemyAbilityValue, enemyInspectionValue } from "../../../../src/game/ability-rules";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { COMBAT_PACKS } from "../../../../src/game/encounters";
import type { GameState } from "../../../../src/game/types";
import { prepareDestination, accept, teamRun } from "../../../support/game";

function ready() {
  return produce(teamRun(1, ["sternshell", "mossguard", "prismram"]), (game) => {
    game.battle!.hand = game.cards.filter((card) => card.ownerId === "ally-0").map((card) => card.id);
    game.battle!.draw = game.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id);
    game.battle!.buffer = [];
    game.battle!.discard = [];
    for (const enemy of game.battle!.enemies) {
      enemy.block = 0;
      enemy.combat = freshCombat();
    }
    game.rng = 0;
  });
}
function play(game: GameState, definitionId: string, autoEndTurn = false) {
  return dispatch(game, {
    type: "play",
    cardId: game.cards.find((card) => card.definitionId === definitionId)!.id,
    targetId: game.battle!.enemies[0]!.id,
    autoEndTurn,
  });
}
it("adds the approved kit to drafts, encounters and current-format saves", () => {
  expect(
    CARDS.filter((card) => card.species === "sternshell").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Deal 3 Physical damage; Doubled if you have Armor"],
    [1, "Swap out for a random backup; Draw 1 card"],
    [1, "Deal 1 Water damage to all enemies; Gain 1 Mana"],
  ]);
  expect(cardText(definition("sternshell-attack"), 0, 6)).toBe(
    "Deal 3 Physical damage; Doubled if you have Armor",
  );
  expect(FIRST_RUN_STARTERS).toContain("sternshell");
  expect(COMBAT_PACKS.some((pack) => pack.some((kind) => kind === "sternshell"))).toBe(true);
  for (const card of CARDS.filter((card) => card.species === "sternshell")) {
    const game = ready();
    const before = encodeSave(game);
    const result = play(game, card.id);
    expect(result.accepted).toBe(true);
    expect(
      previewCard(game, game.cards.find((entry) => entry.definitionId === card.id)!.id, "enemy-0"),
    ).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  }
});
it.each([1, 2, 3, 4, 5, 6])("grants Shelter once at combat start for %i copies", (copies) => {
  let game = produce(ready(), (draft) => {
    prepareDestination(draft);
    draft.discovery.recruited.sternshell = copies;
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.team[0]!.combat!.armor).toBe(copies + 1);
  expect(species("sternshell").passiveTiers[copies - 1]!.description).toBe(
    `Sternshell starts combat with ${copies + 1} Armor`,
  );
  game = produce(game, (draft) => {
    draft.roster.push("coralcurl");
    draft.reserves.push({
      id: "backup",
      species: "coralcurl",
      health: 26,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    });
    draft.team[0]!.combat!.armor = 1;
  });
  game = swapFixture(game, { type: "swap", activeId: "ally-0", reserve: "backup" });
  game = swapFixture(decodeSave(encodeSave(game)), { type: "swap", activeId: "backup", reserve: "ally-0" });
  expect(game.team[0]!.combat!.armor).toBe(1);
});
it.each([0, 1, 7])("doubles Surge Ram only with Armor (%i)", (armor) => {
  const game = produce(ready(), (draft) => {
    draft.team[0]!.combat!.armor = armor;
  });
  const result = play(game, "sternshell-attack");
  expect(result.events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([
    armor ? 6 : 3,
  ]);
  expect(result.state.team[0]!.combat!.armor).toBe(armor);
  const card = { ...game.cards.find((card) => card.definitionId === "sternshell-attack")!, level: 1 };
  expect(actionValue(card, game.team[0]!, game)).toBe(armor ? 10 : 5);
  const enemy = { species: "sternshell" as const, power: 1, combat: { ...freshCombat(), armor } };
  expect(enemyAbilityValue(enemy, definition(card.definitionId))).toBe(armor ? 6 : 3);
  expect(enemyInspectionValue(enemy, definition(card.definitionId))).toBe(armor ? 6 : 3);
});
it("swaps to a living backup before drawing from the incoming kit", () => {
  const game = produce(ready(), (draft) => {
    draft.roster.push("coralcurl", "emberback");
    draft.reserves.push(
      { id: "backup", species: "coralcurl", health: 26, block: 0, combat: freshCombat(), attacked: false },
      { id: "fallen", species: "emberback", health: 0, block: 0, combat: freshCombat(), attacked: false },
    );
    const vault = draft.cards.find((card) => card.definitionId === "sternshell-swap")!.id;
    draft.battle!.hand = [vault];
    draft.battle!.draw = draft.cards
      .filter((card) => card.ownerId === "ally-0" && card.id !== vault)
      .map((card) => card.id);
    draft.battle!.discard = draft.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id);
  });
  const result = play(game, "sternshell-swap");
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.id).toBe("backup");
  expect(result.state.battle!.hand).toHaveLength(1);
  expect(result.state.cards.find((card) => card.id === result.state.battle!.hand[0])!.ownerId).toBe("backup");
  expect(result.state.battle!.mana).toBe(3);
  expect(result.state.reserves.find((unit) => unit.id === "ally-0")!.combat!.armor).toBe(2);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});
it("still draws when Siphon Vault has no backup or teammate", () => {
  const game = produce(ready(), (draft) => {
    const vault = draft.cards.find((card) => card.definitionId === "sternshell-swap")!.id;
    draft.battle!.hand = [vault];
    draft.battle!.draw = draft.cards
      .filter((card) => card.ownerId === "ally-0" && card.id !== vault)
      .map((card) => card.id);
    draft.battle!.discard = draft.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id);
    draft.team.slice(1).forEach((unit) => {
      unit.health = 0;
    });
  });
  const result = play(game, "sternshell-swap");
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.id).toBe("ally-0");
  expect(result.state.battle!.hand).toHaveLength(1);
  expect(result.state.battle!.mana).toBe(3);
});
it("hits every enemy and refunds Mana once before automatic end turn", () => {
  const game = produce(ready(), (draft) => {
    draft.battle!.mana = 1;
  });
  const result = play(game, "sternshell-spiral-return", true);
  expect(result.accepted).toBe(true);
  expect(result.events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual(
    game.battle!.enemies.map(() => 1),
  );
  expect(result.state.battle!.mana).toBe(1);
  expect(result.state.battle!.turn).toBe(1);
  expect(result.state.battleXP.water).toBe(1);
  expect(result.state.battleXP.mana).toBe(1);
});

it("grants enemy Shelter at base rank and does not grant opening Armor to backup", () => {
  let game = produce(ready(), (draft) => {
    prepareDestination(draft);
    draft.expedition = {
      recruit: null,
      lastRoom: null,
      pack: authoredPack(
        draft.encounter,
        COMBAT_PACKS.findIndex((pack) => pack[0] === "sternshell"),
      ),
    };
    draft.discovery.recruited.sternshell = 6;
    draft.roster.push("coralcurl");
    draft.reserves.push({
      id: "backup",
      species: "coralcurl",
      health: species("coralcurl").health,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    });
    draft.lineup[0] = "backup";
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.battle!.enemies[0]!.species).toBe("sternshell");
  expect(game.battle!.enemies[0]!.combat.armor).toBe(2);
  expect(game.reserves[0]!.species).toBe("sternshell");
  expect(game.reserves[0]!.combat!.armor).toBe(0);
  game = swapFixture(game, { type: "swap", activeId: "backup", reserve: "ally-0" });
  expect(game.team[0]!.combat!.armor).toBe(0);
  expect(decodeSave(encodeSave(game))).toEqual(game);
});

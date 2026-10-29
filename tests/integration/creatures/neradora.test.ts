import { enemyPlay } from "../../support/game";
import { swapFixture } from "../../support/game";
import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, FIRST_RUN_STARTERS, species } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import { freshCombat, startAction } from "../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { definitionKeywords } from "../../../src/game/keywords";
import type { GameEvent, GameState } from "../../../src/game/types";
import { prepareDestination, accept, teamRun } from "../../support/game";

function ready(copies = 1) {
  return produce(teamRun(1, ["neradora", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.neradora = copies;
    game.battle!.hand = game.cards.filter((card) => card.ownerId === "ally-0").map((card) => card.id);
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id);
    for (const enemy of game.battle!.enemies) enemy.targetId = "ally-1";
    game.team[1]!.block = 1000;
    game.rng = 0;
  });
}
function play(game: GameState, ability: "undertow-knot" | "bloom-shelter" | "tide-cup") {
  return dispatch(game, {
    type: "play",
    cardId: game.cards.find((card) => card.definitionId === `neradora-${ability}`)!.id,
    autoEndTurn: false,
  });
}

it("registers the selected support kit, Water classification, encounters and resumable previews", () => {
  const kit = CARDS.filter((card) => card.species === "neradora");
  expect(kit.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Gain 4 Block; Cleanse a harmful effect"],
    [1, "Restore 2 Health to all allies"],
    [1, "Draw 2 cards; Gain 1 Mana"],
  ]);
  expect(kit.map(definitionKeywords)).toEqual([["block", "health"], ["health"], ["mana"]]);
  expect(FIRST_RUN_STARTERS).not.toContain("neradora");

  for (const ability of ["undertow-knot", "bloom-shelter", "tide-cup"] as const) {
    const game = ready();
    const before = encodeSave(game);
    const result = play(game, ability);
    expect(result.accepted).toBe(true);
    expect(
      previewCard(game, game.cards.find((card) => card.definitionId === `neradora-${ability}`)!.id),
    ).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  }
  expect(() => decodeSave(JSON.stringify({ ...ready(), version: 39 }))).toThrow();
});

it("Undertow Knot protects and Cleanses its user, including through a preview and save", () => {
  const game = produce(ready(), (draft) => {
    draft.team[0]!.combat!.burn = 4;
  });
  const result = play(game, "undertow-knot");
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.block).toBe(4);
  expect(result.state.team[0]!.combat!.burn).toBe(0);
  expect(result.state.battleXP.block).toBe(1);
  expect(result.state.battleXP.health).toBe(1);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("heals all living deployed allies, caps at maximum and excludes backup and knockouts", () => {
  const game = produce(ready(), (draft) => {
    draft.team[0]!.health -= 5;
    draft.team[1]!.health -= 1;
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[2]!, id: "backup", health: 1, combat: freshCombat() });
    draft.reserves[0]!.health = 0;
  });
  const result = play(game, "bloom-shelter");
  const withLivingBackup = produce(game, (draft) => {
    draft.team[2]!.health = 1;
    draft.reserves[0]!.health = 1;
  });
  expect(play(withLivingBackup, "bloom-shelter").state.reserves[0]).toEqual(withLivingBackup.reserves[0]);
  expect(result.state.team.map((unit) => unit.health)).toEqual([25, species("mossguard").health, 0]);
  expect(result.state.reserves[0]!.health).toBe(0);
  expect(result.state.battleXP.health).toBe(1);
});

it("draws twice then refunds Mana before automatic end turn and grants accepted-play XP once", () => {
  const game = produce(ready(), (draft) => {
    draft.battle!.mana = 1;
  });
  const cardId = game.cards.find((card) => card.definitionId === "neradora-tide-cup")!.id;
  const result = dispatch(game, { type: "play", cardId });
  expect(result.state.battle!.turn).toBe(1);
  expect(result.state.battle!.mana).toBe(1);
  expect(result.state.battle!.hand).toHaveLength(4);
  expect(result.state.battleXP.mana).toBe(1);
  expect(result.state.battle!.cardsPlayedThisTurn).toBe(1);
  expect(result.state.battle!.discard).toEqual([cardId]);
});

it.each([1, 2, 3, 4, 5, 6])(
  "regenerates %i Health on even turns with the same cadence after resume",
  (amount) => {
    let game = produce(ready(amount), (draft) => {
      draft.team[0]!.health = 10;
      draft.team[0]!.block = 1000;
    });
    for (const turn of [2, 3, 4, 5]) {
      game = decodeSave(encodeSave(game));
      game = accept(game, { type: "endTurn" });
      expect(game.battle!.turn).toBe(turn);
      expect(game.team[0]!.health).toBe(10 + Math.floor(turn / 2) * amount);
    }
  },
);

it("keeps regeneration cadence across swaps, skips backup and knockouts, and heals through control", () => {
  produce(ready(6), (game) => {
    const actor = game.team[0]!;
    actor.health = 10;
    actor.combat!.controlled = "freeze";
    actor.combat!.controlTurns = 1;
    expect(startAction(actor, [], game)).toBe(false);
    expect(actor.health).toBe(16);
    game.battle!.turn = 2;
    startAction(actor, [], game);
    expect(actor.health).toBe(16);
    game.reserves.push(game.team.shift()!);
    game.battle!.turn = 3;
    startAction(game.reserves[0]!, [], game);
    expect(game.reserves[0]!.health).toBe(16);
    game.team.unshift(game.reserves.shift()!);
    game.battle!.turn = 4;
    startAction(game.team[0]!, [], game);
    expect(game.team[0]!.health).toBe(16);
    game.battle!.turn = 5;
    startAction(game.team[0]!, [], game);
    expect(game.team[0]!.health).toBe(22);
    game.team[0]!.health = 0;
    startAction(game.team[0]!, [], game);
    expect(game.team[0]!.health).toBe(0);
  });
});

it("runs enemy support on its own side and uses base regeneration independently of collection rank", () => {
  let game = produce(ready(6), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "neradora";
    enemy.name = "Neradora";
    enemy.health = 3;
    enemy.lastAbility = "neradora-bloom-shelter";
  });
  game = enemyPlay(game, "neradora-undertow-knot").state;
  expect(game.battle!.enemies[0]!.lastAbility).toBe("neradora-undertow-knot");
  expect(game.battle!.enemies[0]!.block).toBeGreaterThan(0);
  const events: GameEvent[] = [];
  produce(game, (draft) => {
    draft.battle!.turn = 2;
    const enemy = draft.battle!.enemies[0]!;
    const before = enemy.health;
    startAction(enemy, events, draft);
    expect(enemy.health).toBe(before + 1);
    expect(events).toContainEqual(expect.objectContaining({ kind: "heal", targetId: enemy.id, amount: 1 }));
  });
  const second = enemyPlay(game, "neradora-bloom-shelter");
  expect(second.state.battle!.enemies[0]!.lastAbility).toBe("neradora-bloom-shelter");
  expect(
    second.events.filter(
      (event): event is Extract<GameEvent, { kind: "heal" }> =>
        event.kind === "heal" && event.targetId?.startsWith("enemy-"),
    ).length,
  ).toBeGreaterThan(0);
});

it("retains Block through rejected commands and swaps without resetting turn cadence", () => {
  const game = produce(play(ready(), "undertow-knot").state, (draft) => {
    draft.discovery.recruited.emberback = 1;
    if (!draft.discovery.encountered.includes("emberback")) draft.discovery.encountered.push("emberback");
    draft.reserves.push({
      id: "backup",
      species: "emberback",
      health: 30,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
  });
  const rejected = play(game, "undertow-knot");
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
  expect(rejected.state.rng).toBe(game.rng);
  let swapped = swapFixture(game, { type: "swap", activeId: "ally-0", reserve: "backup" });
  swapped = decodeSave(encodeSave(swapped));
  expect(swapped.reserves[0]!.block).toBe(4);
  swapped = swapFixture(swapped, { type: "swap", activeId: "backup", reserve: "ally-0" });
  expect(swapped.team[0]!.block).toBe(4);
  expect(swapped.battle!.turn).toBe(1);
});

it("caps passive healing without card-only overhealing rewards and resets on a new battle", () => {
  const game = produce(ready(6), (draft) => {
    const actor = draft.team[0]!;
    actor.health = species("neradora").health - 1;
    actor.block = 0;
    draft.talents.push("health.overflow");
    startAction(actor, [], draft);
    expect(actor.health).toBe(species("neradora").health);
    expect(actor.block).toBe(0);
    actor.health = 10;
    actor.combat!.thorns = 8;
    prepareDestination(draft);
  });
  const next = accept(game, { type: "beginBattle" });
  expect(next.battle!.turn).toBe(1);
  expect(next.team[0]!.health).toBe(10);
  expect(next.team[0]!.combat!.thorns).toBe(0);
});

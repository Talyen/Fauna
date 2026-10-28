import { expect, it } from "vitest";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import {
  draw,
  drawAtTurnStart,
  drawDiscard,
  drawKeyword,
  drawOwner,
  journeyReturn,
  receiveCard,
} from "../../../src/game/card-zones";
import { freshCombat } from "../../../src/game/combat";
import { drawBossCards, summonEcho } from "../../../src/game/combat/legendary";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { addReserve, requireBattle, teamRun } from "../../support/game";
import { cardId, setBattleCards } from "../../support/cards";

it.each([
  ["neradora", "neradora-tide-cup"],
  ["cadenza", "cadenza-resonant-well"],
  ["shadebrim", "shadebrim-draw"],
  ["wickwaltz", "wickwaltz-draw"],
] as const)("%s cannot recycle its refunding draw card during the same turn", (kind, definitionId) => {
  const state = requireBattle(structuredClone(teamRun(42, [kind])));
  state.boons = ["dune-shuttle", "ironwood-buckler", "mineral-bookend"];
  state.team[0]!.combat = freshCombat();
  state.team[0]!.block = 0;
  setBattleCards(
    state,
    state.cards.map((card) => card.id),
  );
  const id = cardId(state, definitionId);
  const command = { type: "play" as const, cardId: id, autoEndTurn: false };
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  expect(previewCard(state, id)).toEqual(result);
  const after = requireBattle(result.state);
  expect(after.battle.mana).toBe(state.battle.mana);
  expect(after.battle.turn).toBe(state.battle.turn);
  expect(after.battle.draw).toEqual([]);
  expect(after.battle.discard).toEqual([id]);
  expect(after.battle.hand).not.toContain(id);
  expect(after.team[0]!.block).toBe(0);
  expect(after.team[0]!.combat!.thorns).toBe(0);
  expect(dispatch(after, command).accepted).toBe(false);
  expect(decodeSave(encodeSave(after))).toEqual(after);
});

it("ordinary, keyword, owner and Journey Loom draws cannot borrow from Discard", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["cadenza", "emberback"])));
  state.boons = ["journey-loom", "mineral-bookend"];
  setBattleCards(
    state,
    [],
    state.cards.map((card) => card.id),
  );
  const before = structuredClone(state);
  expect(draw(state, 2)).toBe(0);
  drawKeyword(state, "burn");
  expect(drawOwner(state, state.team[1]!.id, [])).toBe(false);
  journeyReturn(state, state.team[0]!.id, []);
  expect(state).toEqual(before);
  // Explicit recovery still draws a real Discard slot without empty-deck rewards.
  expect(drawDiscard(state, [])).toBeDefined();
  expect(state.battle.hand).toHaveLength(1);
  expect(state.team.map((ally) => ally.block)).toEqual(before.team.map((ally) => ally.block));
});

it("turn-start draws refill mid-draw while retaining fallen owners' inert slots", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["neradora", "mossguard"])));
  state.team[1]!.health = 0;
  const active = state.cards.filter((card) => card.ownerId === state.team[0]!.id).map((card) => card.id);
  const inert = state.cards.filter((card) => card.ownerId === state.team[1]!.id).map((card) => card.id);
  setBattleCards(state, [], active.slice(1));
  const ordinary = structuredClone(state);
  expect(draw(ordinary, 4)).toBe(1);
  expect(ordinary.battle.discard).toEqual(active.slice(1));
  expect(drawAtTurnStart(state, 4, [])).toBe(3);
  expect(new Set(state.battle.hand)).toEqual(new Set(active));
  expect(state.battle.draw).toEqual(inert);
  expect(state.battle.discard).toEqual([]);
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

it("ending the turn makes spent cards drawable again", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["neradora"])));
  setBattleCards(
    state,
    state.cards.map((card) => card.id),
  );
  for (const enemy of state.battle.enemies)
    enemy.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 2 };
  const id = cardId(state, "neradora-tide-cup");
  const played = dispatch(state, { type: "play", cardId: id, autoEndTurn: false });
  const ended = dispatch(played.state, { type: "endTurn" });
  expect(ended.accepted).toBe(true);
  expect(ended.state.battle!.turn).toBe(state.battle.turn + 1);
  expect(ended.state.battle!.hand).toContain(id);
  expect(ended.state.battle!.discard).toEqual([]);
});

it("Mineral Bookend grants team Block only on the actual last draw, including Echoes", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["memento", "mossguard"])));
  state.boons = ["mineral-bookend", "ironwood-buckler"];
  addReserve(state, "backup", "neradora", 28, freshCombat());
  summonEcho(state, state.team[0]!, "player", 6, []);
  state.team[1]!.health = 0;
  for (const unit of [...state.team, ...state.battle.minions!]) {
    unit.block = 0;
    unit.combat = freshCombat();
  }
  const cards = state.cards.filter((card) => card.ownerId === state.team[0]!.id);
  setBattleCards(
    state,
    [],
    state.cards.filter((card) => !cards.slice(0, 2).includes(card)).map((card) => card.id),
  );
  const mana = state.battle.mana;
  expect(draw(state, 1)).toBe(1);
  expect(state.team[0]!.block).toBe(0);
  expect(draw(state, 1)).toBe(1);
  expect(state.team[0]!.block).toBe(2);
  expect(state.battle.minions![0]!.block).toBe(2);
  expect(state.team[1]!.block).toBe(0);
  expect(state.reserves[0]!.block).toBe(0);
  expect(state.team[0]!.combat!.thorns).toBe(1);
  expect(state.battle.mana).toBe(mana);
  const blocks = state.team[0]!.block;
  receiveCard(state, state.battle.hand.pop()!);
  expect(draw(state, 2)).toBe(0);
  drawDiscard(state, []);
  expect(state.team[0]!.block).toBe(blocks);
});

it("enemy deck draws wait for turn start before recycling too", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["memento"])));
  const deck = {
    hand: [] as string[],
    buffer: [] as string[],
    draw: ["memento-drowned-revelation"],
    discard: ["memento-lost-procession"],
    mana: 4,
    pearls: 0,
  };
  drawBossCards(state, deck, 2);
  expect(deck.hand).toEqual(["memento-drowned-revelation"]);
  expect(deck.discard).toEqual(["memento-lost-procession"]);
  drawBossCards(state, deck, 1, true);
  expect(deck.hand).toEqual(["memento-drowned-revelation", "memento-lost-procession"]);
  expect(deck.discard).toEqual([]);
});

it("Auto-play does not invent draw rewards or Well Read copies from an empty deck", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["skybex", "rookhaven"])));
  state.boons = ["mineral-bookend", "dune-shuttle"];
  setBattleCards(
    state,
    state.cards.map((card) => card.id),
  );
  const id = cardId(state, "skybex-draw");
  expect(
    rankedBattleChoices(state, false).some(
      (choice) => choice.command.type === "play" && choice.command.cardId === id,
    ),
  ).toBe(false);
});

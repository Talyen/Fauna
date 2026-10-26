import { expect, it } from "vitest";
import { produce } from "immer";
import { cardId, playCard, setBattleCards, setHand } from "../../support/cards";
import { addReserve, prepareDestination, requireBattle, run, teamRun } from "../../support/game";
import { freshCombat } from "../../../src/game/combat/index";
import { decodeSave, encodeSave } from "../../../src/game/save";

it("arranges distinct Legendary copies exactly once in catalog draw order without consuming RNG", () => {
  const original = requireBattle(teamRun(42, ["memento"]));
  const [first, second, discarded] = original.cards;
  const next = produce(original, (draft) => {
    setBattleCards(draft, [second!.id, first!.id], [discarded!.id]);
  });
  expect(next.battle.hand).toEqual([second!.id, first!.id]);
  expect(next.battle.discard).toEqual([discarded!.id]);
  expect(next.battle.buffer).toEqual([]);
  expect(next.battle.draw).toEqual(original.cards.slice(3).map((card) => card.id));
  expect(next.cards).toBe(original.cards);
  expect(next.rng).toBe(original.rng);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});

it("selects the original first owned copy by definition and clears previously occupied piles", () => {
  const original = requireBattle(teamRun(42, ["memento"]));
  const id = "memento-lost-procession";
  const ready = produce(original, (draft) => {
    draft.battle.buffer = draft.battle.hand.splice(0, 1);
    setHand(draft, [id]);
  });
  expect(ready.battle.hand).toEqual([cardId(original, id)]);
  expect(ready.battle.draw).toEqual(original.cards.slice(1).map((card) => card.id));
  expect(ready.battle.buffer).toEqual([]);
  expect(ready.battle.discard).toEqual([]);
  expect(original.battle.buffer).toEqual([]);
});

it("leaves a zero-Mana player turn open after an isolated fixture play", () => {
  const game = produce(run(), (draft) => {
    setHand(draft, ["prismram-guard"]);
    draft.battle!.mana = 1;
  });
  const result = playCard(game, "prismram-guard");
  expect(result.accepted).toBe(true);
  expect(result.state.battle).toMatchObject({ turn: 1, mana: 0 });
  expect(game.battle!.mana).toBe(1);
});

it("registers backup discovery without resetting Collection progress or inventing combat lifetime data", () => {
  const state = structuredClone(run());
  prepareDestination(state);
  state.discovery.recruited.coralcurl = 4;
  state.discovery.encountered.push("coralcurl");
  const combat = freshCombat();
  addReserve(state, "injured", "coralcurl", 7, combat);
  addReserve(state, "new", "orifable", 0);
  expect(state.reserves).toEqual([
    { id: "injured", species: "coralcurl", health: 7, block: 0, attacked: false, combat },
    { id: "new", species: "orifable", health: 0, block: 0, attacked: false },
  ]);
  expect(state.reserves[0]!.combat).toBe(combat);
  expect(state.discovery.recruited).toMatchObject({ coralcurl: 4, orifable: 1 });
  expect(state.discovery.encountered.filter((kind) => kind === "orifable")).toHaveLength(1);
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

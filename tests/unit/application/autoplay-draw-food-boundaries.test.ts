import { produce } from "immer";
import { expect, it } from "vitest";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { dispatch } from "../../../src/game/engine";
import { CORNUCOPIA_CARD_ID, replenishJourneyCards } from "../../../src/game/journey-cards";
import { setBattleCards } from "../../support/cards";
import { requireBattle, teamRun } from "../../support/game";

it.each(["health.overflow", "health.clean-slate"] as const)(
  "Auto-play recognizes %s from Cornucopia at full Health",
  (talent) => {
    const state = produce(requireBattle(teamRun(42, ["mossguard"])), (game) => {
      game.boons = ["cornucopia"];
      game.talents = [talent];
      replenishJourneyCards(game);
      setBattleCards(game, [CORNUCOPIA_CARD_ID]);
      game.battle.mana = game.battle.maxMana;
      if (talent === "health.clean-slate") game.team[0]!.combat!.poison = 2;
    });
    const choice = rankedBattleChoices(state, false).find((entry) => entry.command.type === "play");
    expect(choice?.command).toMatchObject({ type: "play", cardId: CORNUCOPIA_CARD_ID });
    const result = dispatch(state, choice!.command);
    expect(result.accepted).toBe(true);
    if (talent === "health.overflow") expect(result.state.team[0]!.block).toBeGreaterThan(0);
    else expect(result.state.team[0]!.combat!.poison).toBe(0);
  },
);

it("Auto-play values Food Dodge while Quiet Pinwheel permits a controlled ally to Dodge", () => {
  const state = produce(requireBattle(teamRun(42, ["mossguard"])), (game) => {
    game.boons = ["velvet-whisk", "quiet-pinwheel"];
    const food = {
      id: "copy-0",
      definitionId: "food-apple",
      ownerId: null,
      level: 0,
      temporary: true as const,
    };
    game.cards.push(food);
    game.battle.copySerial = 1;
    setBattleCards(game, [food.id]);
    game.team[0]!.combat!.controlled = "freeze";
    game.team[0]!.combat!.controlTurns = 1;
  });
  const choice = rankedBattleChoices(state, false).find((entry) => entry.command.type === "play");
  expect(choice?.command).toMatchObject({ type: "play", cardId: "copy-0" });
  const result = dispatch(state, choice!.command);
  expect(result.state.team[0]!.combat!.temporaryDodge).toBe(20);
  const withoutPinwheel = produce(state, (game) => {
    game.boons = ["velvet-whisk"];
  });
  expect(rankedBattleChoices(withoutPinwheel, false)).toEqual([]);
});

it.each([
  ["aerostat", "aerostat-true-bearing"],
  ["dawncall", "dawncall-teamCleanse"],
] as const)("Auto-play does not invent self-draw rewards for %s", (kind, definitionId) => {
  const state = produce(requireBattle(teamRun(42, [kind])), (game) => {
    game.battle.hand = game.cards.map((card) => card.id);
    game.battle.draw = [];
    game.battle.discard = [];
    game.battle.buffer = [];
    game.team[0]!.block = 1_000_000;
    game.team[0]!.combat!.freeCard = true;
    game.battle.mana = game.battle.maxMana;
  });
  const card = state.cards.find((entry) => entry.definitionId === definitionId)!;
  const choice = (game: typeof state) =>
    rankedBattleChoices(game, false).find(
      (entry) => entry.command.type === "play" && entry.command.cardId === card.id,
    );
  for (const boon of ["dune-shuttle", "mineral-bookend"] as const) {
    const capped = produce(state, (game) => {
      game.boons = [boon];
    });
    expect(choice(capped)).toBeUndefined();
    const useful = produce(capped, (game) => {
      game.team[0]!.block--;
    });
    expect(choice(useful)).toBeUndefined();
  }
});

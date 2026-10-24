import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import { createFood } from "../../src/game/combat/food";
import { FOOD_CARDS } from "../../src/game/content/food";
import type { BattleState } from "../../src/game/types";

export function orifableBattle(withFood = false): BattleState {
  return produce(requireBattle(teamRun(42, ["orifable", "emberback", "mossguard"])), (draft) => {
    draft.team[0]!.health = 20;
    draft.team[1]!.health = 14;
    draft.team[2]!.health = 12;
    if (withFood) {
      createFood(draft, draft.team[0]!, 3, []);
      draft.cards
        .filter((card) => card.ownerId === null)
        .forEach((card, index) => {
          card.definitionId = FOOD_CARDS[index]!.id;
        });
    }
    const definitions = [
      "orifable-createFood",
      "orifable-heal",
      "orifable-attack",
      ...(withFood ? FOOD_CARDS.map((card) => card.id) : ["emberback-attack"]),
    ];
    draft.battle.hand = definitions.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle.discard = [];
    draft.battle.buffer = [];
  });
}

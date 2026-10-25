import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function arabescaBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["arabesca", "emberback", "mossguard"])), (draft) => {
    draft.team.forEach((unit) => {
      unit.health = 10;
    });
    draft.team[0]!.combat!.freeze = 4;
    draft.team[1]!.combat!.freeze = 6;
    const ids = [
      "arabesca-ribbon-snare",
      "arabesca-springbound",
      "arabesca-dancing-double",
      "emberback-attack",
    ];
    draft.battle.hand = ids.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.discard = [];
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle.buffer = [];
  });
}

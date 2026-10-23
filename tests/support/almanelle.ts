import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function almanelleBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["almanelle", "emberback", "mossguard"])), (draft) => {
    draft.team[0]!.health = 22;
    draft.team[0]!.combat!.burn = 3;
    draft.team[2]!.health = 12;
    const ids = [
      "almanelle-spring-current",
      "almanelle-autumn-insight",
      "almanelle-rooted-year",
      "emberback-attack",
    ];
    draft.battle.hand = ids.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    const discarded = draft.cards.find((card) => card.definitionId === "mossguard-guard")!.id;
    draft.battle.discard = [discarded];
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id) && card.id !== discarded)
      .map((card) => card.id);
    draft.battle.buffer = [];
  });
}

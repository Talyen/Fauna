import { produce } from "immer";
import { teamRun, requireBattle } from "./game";
import type { BattleState } from "../../src/game/types";

export function oatharaBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["oathara", "emberback", "mossguard"])), (draft) => {
    const fallen = draft.team[1]!;
    fallen.health = 0;
    fallen.combat!.deathDoorUsed = true;
    fallen.combat!.grace = 0;
    draft.team[2]!.health = 12;
    draft.battle.enemies[0]!.lastAbility = "emberback-attack";
    const ids = [
      "oathara-never-lost",
      "oathara-travelers-ward",
      "oathara-vow-of-return",
      "emberback-attack",
      "emberback-furnace-breath",
    ];
    draft.battle.hand = ids.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle.discard = [];
    draft.battle.buffer = [];
  });
}

import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function alpenglenBattle(stars = 0): BattleState {
  return produce(requireBattle(teamRun(42, ["alpenglen", "emberback", "mossguard"])), (draft) => {
    draft.discovery.recruited.alpenglen = stars + 1;
    draft.team[0]!.health = 20;
    draft.team[1]!.health = 12;
    const definitions = [
      "alpenglen-sunset-reversal",
      "alpenglen-ember-of-evening",
      "alpenglen-last-light-charge",
    ];
    draft.battle.hand = definitions.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle.discard = [];
    draft.battle.buffer = [];
    draft.battle.enemies.forEach((unit) => {
      unit.combat.controlled = "freeze";
      unit.combat.controlTurns = 1;
      unit.block = 0;
      unit.combat.armor = 0;
    });
  });
}

import { setHand } from "./cards";
import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function alpenglenBattle(stars = 0): BattleState {
  return produce(requireBattle(teamRun(42, ["alpenglen", "emberback", "mossguard"])), (draft) => {
    draft.discovery.recruited.alpenglen = stars + 1;
    draft.team[0]!.health = 20;
    draft.team[1]!.health = 12;
    setHand(draft, [
      "alpenglen-sunset-reversal",
      "alpenglen-ember-of-evening",
      "alpenglen-last-light-charge",
    ]);
    draft.battle.enemies.forEach((unit) => {
      unit.combat.controlled = "freeze";
      unit.combat.controlTurns = 1;
      unit.block = 0;
      unit.combat.armor = 0;
    });
  });
}

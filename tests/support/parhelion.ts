import { setHand } from "./cards";
import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function parhelionBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["parhelion", "emberback", "mossguard"])), (draft) => {
    draft.team[0]!.health = 18;
    draft.team[0]!.combat!.freeze = 4;
    draft.team[1]!.health = 20;
    draft.team[1]!.combat!.freeze = 6;
    draft.team[1]!.combat!.burn = 2;
    draft.team[2]!.health = 23;
    setHand(draft, [
      "parhelion-polar-reprieve",
      "parhelion-sundog-reservoir",
      "parhelion-whiteout-waltz",
      "emberback-attack",
    ]);
  });
}

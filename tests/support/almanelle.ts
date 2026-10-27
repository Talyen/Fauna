import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import { setHand } from "./cards";
import type { BattleState } from "../../src/game/types";

export function almanelleBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["almanelle", "emberback", "mossguard"])), (draft) => {
    draft.team[0]!.health = 22;
    draft.team[0]!.combat!.burn = 3;
    draft.team[2]!.health = 12;
    setHand(
      draft,
      ["almanelle-spring-current", "almanelle-autumn-insight", "almanelle-rooted-year", "emberback-attack"],
      ["mossguard-guard"],
    );
  });
}

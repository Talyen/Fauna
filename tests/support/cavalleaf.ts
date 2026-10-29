import { setHand } from "./cards";
import { produce } from "immer";
import { addReserve, requireBattle, teamRun } from "./game";
import { freshCombat } from "../../src/game/combat/index";
import type { BattleState } from "../../src/game/types";

export function cavalleafBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["cavalleaf", "coralcurl", "mossguard"])), (draft) => {
    draft.team[0]!.health = 20;
    draft.team[1]!.health = 20;
    draft.team[2]!.health = 20;
    draft.team[0]!.combat!.burn = 4;
    addReserve(draft, "backup", "dulcera", 20, freshCombat());
    setHand(draft, ["cavalleaf-meadow-return", "cavalleaf-raincall", "cavalleaf-prairie-leap"]);
  });
}

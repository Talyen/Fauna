import { setHand } from "./cards";
import { produce } from "immer";
import { addReserve, requireBattle, teamRun } from "./game";
import { freshCombat } from "../../src/game/combat/index";
import type { BattleState } from "../../src/game/types";

export function wendletBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["wendlet", "coralcurl", "mossguard"])), (draft) => {
    draft.team[0]!.block = 12;
    draft.team[1]!.health = 12;
    addReserve(draft, "backup", "dulcera", 20, freshCombat());
    setHand(draft, ["wendlet-midnight-mantle", "wendlet-umbra-snare", "wendlet-borrowed-silhouette"]);
  });
}

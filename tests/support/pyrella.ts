import { addReserve, requireBattle, teamRun } from "./game";
import { setHand } from "./cards";
import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";
import { species } from "../../src/game/content";

export function pyrellaBattle() {
  return produce(requireBattle(teamRun(42, ["pyrella", "emberback", "reedstag"])), (draft) => {
    addReserve(draft, "pyrella-backup", "mossguard", species("mossguard").health, freshCombat());
    setHand(draft, [
      "pyrella-festival-burst",
      "pyrella-ember-harvest",
      "pyrella-spark-decoy",
      "emberback-attack",
    ]);
  });
}

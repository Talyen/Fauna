import { addReserve, requireBattle, teamRun } from "./game";
import { setHand } from "./cards";
import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";
import { species } from "../../src/game/content";

export function skybexBattle() {
  return produce(requireBattle(teamRun(42, ["skybex", "emberback", "prismram"])), (draft) => {
    addReserve(draft, "skybex-backup", "mossguard", species("mossguard").health, freshCombat());
    setHand(draft, ["skybex-draw", "skybex-cloudstep", "skybex-sky-shepherd", "emberback-attack"]);
  });
}

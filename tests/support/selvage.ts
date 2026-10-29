import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";
import { setHand } from "./cards";
import { addReserve, requireBattle, teamRun } from "./game";

export function selvageBattle() {
  return produce(requireBattle(teamRun(42, ["selvage", "emberback", "prismram"])), (draft) => {
    draft.team[1]!.health = 10;
    addReserve(draft, "backup-mossguard", "mossguard", 0, freshCombat());
    setHand(draft, ["selvage-gust-wing", "selvage-nest-ward", "selvage-mending-song", "prismram-attack"]);
  });
}

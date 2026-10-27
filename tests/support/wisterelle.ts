import { addReserve, requireBattle, teamRun } from "./game";
import { setHand } from "./cards";
import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";

export function wisterelleBattle() {
  return produce(requireBattle(teamRun(42, ["wisterelle", "emberback", "prismram"])), (draft) => {
    draft.team.forEach((unit) => (unit.health = 12));
    addReserve(draft, "backup-mossguard", "mossguard", 20, freshCombat());
    addReserve(draft, "backup-coralcurl", "coralcurl", 15, freshCombat());
    setHand(
      draft,
      [
        "wisterelle-forgotten-junction",
        "wisterelle-lantern-fare",
        "wisterelle-left-luggage",
        "prismram-attack",
      ],
      ["emberback-attack"],
    );
  });
}

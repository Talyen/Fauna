import { addReserve, requireBattle, teamRun } from "./game";
import { setHand } from "./cards";
import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";
import type { BattleState } from "../../src/game/types";

export function dulceraBattle(withBackup = true): BattleState {
  return produce(requireBattle(teamRun(42, ["dulcera", "emberback", "mossguard"])), (draft) => {
    draft.team[0]!.health = 20;
    draft.team[0]!.combat!.burn = 3;
    draft.team[1]!.health = 14;
    draft.team[1]!.combat!.poison = 4;
    draft.team[2]!.health = 12;
    if (withBackup)
      addReserve(draft, "backup-coralcurl", "coralcurl", 12, {
        ...freshCombat(),
        poison: 4,
        freeze: 3,
        blind: true,
      });
    setHand(draft, [
      "dulcera-chapel-light",
      "dulcera-meadow-shelter",
      "dulcera-hushed-waters",
      "emberback-attack",
    ]);
  });
}

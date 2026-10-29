import { setHand } from "./cards";
import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function vitriloBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["vitrilo", "glintstride", "mossguard"])), (draft) => {
    draft.team[0]!.health -= 5;
    draft.battle.enemies[0]!.block = 8;
    setHand(draft, ["vitrilo-sunflare-cast", "vitrilo-prism-key", "vitrilo-kilnheart"]);
  });
}

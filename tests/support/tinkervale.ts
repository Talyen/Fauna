import { setHand } from "./cards";
import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function tinkervaleBattle(): BattleState {
  return produce(requireBattle(teamRun(42, ["tinkervale", "sternshell", "mossguard"])), (draft) => {
    setHand(draft, ["tinkervale-copper-canopy", "tinkervale-clockwork-launch", "tinkervale-gear-mender"]);
  });
}

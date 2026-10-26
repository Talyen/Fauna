import { setHand } from "./cards";
import { produce } from "immer";
import { accept, prepareDestination, requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function aerostatBattle(stars = 0): BattleState {
  const destination = produce(teamRun(42, ["aerostat", "emberback", "mossguard"]), (draft) => {
    prepareDestination(draft);
    draft.discovery.recruited.aerostat = stars + 1;
  });
  return produce(requireBattle(accept(destination, { type: "beginBattle" })), (draft) => {
    draft.team.forEach((unit) => {
      unit.combat!.blind = true;
    });
    setHand(draft, [
      "aerostat-voyagers-rest",
      "aerostat-true-bearing",
      "aerostat-parcel-drop",
      "emberback-attack",
    ]);
  });
}

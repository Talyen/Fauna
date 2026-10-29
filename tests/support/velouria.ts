import { produce } from "immer";
import { teamRun } from "./game";
import { setHand } from "./cards";

export function velouriaBattle() {
  return produce(teamRun(42, ["velouria", "glintstride", "mossguard"]), (draft) => {
    setHand(draft, ["velouria-moonlit-waltz", "velouria-velvet-aegis", "velouria-hushed-finale"]);
  });
}

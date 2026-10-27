import { produce } from "immer";
import { requireBattle, teamRun } from "./game";
import { setHand } from "./cards";

export function ravellandBattle() {
  return produce(requireBattle(teamRun(42, ["ravelland"])), (draft) => {
    setHand(draft, ["ravelland-antler-pass", "ravelland-canyon-rebuke", "ravelland-rainward"]);
  });
}

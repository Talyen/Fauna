import type { Command, GameState } from "./types";
import { freeze } from "immer";

const all = [
  "draft",
  "teamSelection",
  "battle",
  "recruit",
  "boon",
  "campfire",
  "support",
  "victory",
  "defeat",
] as const;
const destinations = ["teamSelection", "recruit", "boon", "campfire", "support"] as const;
/** One exhaustive phase gate precedes command-specific validation and mutation. */
export const commandPhases = freeze(
  {
    draft: ["draft"],
    start: ["draft"],
    beginBattle: ["teamSelection"],
    swap: ["battle"],
    play: ["battle"],
    endTurn: ["battle"],
    devWinBattle: ["battle"],
    visitCampfire: ["teamSelection"],
    rest: ["campfire"],
    leaveCampfire: ["campfire"],
    enterSupport: ["teamSelection"],
    buyBoon: ["support"],
    leaveSupport: ["support"],
    recruit: ["recruit"],
    recruitDestination: ["teamSelection"],
    confirmRecruit: ["recruit"],
    chooseBoon: ["boon"],
    skipBoon: ["boon"],
    buyTalent: all,
    resetTalents: all,
    newRun: ["draft", "victory", "defeat"],
    abandon: ["draft", "battle", ...destinations],
  } satisfies Record<Command["type"], readonly GameState["phase"][]>,
  true,
);

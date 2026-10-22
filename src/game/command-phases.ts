import type { Command, GameState } from "./types";

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
/** Command admission uses the same exhaustive phase table as lifecycle regression coverage. */
export const commandPhases = {
  draft: ["draft"],
  start: ["draft"],
  beginBattle: ["teamSelection"],
  setLineup: destinations,
  swap: ["teamSelection", "battle"],
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
  skipRecruit: ["recruit"],
  chooseBoon: ["boon"],
  skipBoon: ["boon"],
  buyTalent: all,
  resetTalents: all,
  newRun: ["draft", "victory", "defeat"],
  abandon: ["draft", "battle", ...destinations],
} satisfies Record<Command["type"], readonly GameState["phase"][]>;

import { DAMAGE_CUES, type SoundCue } from "./cues";
import type { GameEvent } from "../../game/types";
export type CombatCue =
  (typeof DAMAGE_CUES)[keyof typeof DAMAGE_CUES] | Extract<SoundCue, "heal" | "block" | "absorb">;
/** Alchemy-inspired outcome selection: one strongest meaningful cue per resolved action. */
export function selectCombatCue(events: readonly GameEvent[]): CombatCue | undefined {
  let best: CombatCue | undefined;
  let bestAmount = 0;
  let bestPriority = Infinity;
  for (const event of events) {
    if (event.kind !== "damage" && event.kind !== "heal" && event.kind !== "block") continue;
    const amount = Math.abs(event.amount);
    if (amount === 0) continue;
    const cue =
      event.kind === "damage"
        ? DAMAGE_CUES[event.damageType]
        : event.kind === "heal"
          ? "heal"
          : event.amount < 0
            ? "absorb"
            : "block";
    const priority = event.kind === "damage" ? 0 : event.kind === "heal" ? 1 : 2;
    if (!best || amount > bestAmount || (amount === bestAmount && priority < bestPriority)) {
      best = cue;
      bestAmount = amount;
      bestPriority = priority;
    }
  }
  return best;
}

import type { DamageType } from "../../game/content";
import type { GameEvent } from "../../game/types";
export type CombatCue =
  | Exclude<DamageType, "burn" | "freeze" | "bleed" | "stun" | "water">
  | "fire"
  | "ice"
  | "lightning"
  | "heal"
  | "block"
  | "absorb"
  | "deny";
/** Alchemy-inspired outcome selection: one strongest meaningful cue per resolved action. */
export function selectCombatCue(events: readonly GameEvent[]): CombatCue | undefined {
  let best: { cue: CombatCue; amount: number; priority: number } | undefined;
  for (const event of events) {
    const amount = Math.abs(event.amount ?? 0);
    if (amount === 0) continue;
    const cue =
      event.kind === "damage"
        ? event.damageType === "burn"
          ? "fire"
          : event.damageType === "freeze"
            ? "ice"
            : event.damageType === "bleed" || event.damageType === "water"
              ? "physical"
              : event.damageType === "stun"
                ? "lightning"
                : (event.damageType ?? "physical")
        : event.kind === "heal"
          ? "heal"
          : event.kind === "block"
            ? event.amount! < 0
              ? "absorb"
              : "block"
            : undefined;
    if (!cue) continue;
    const priority = event.kind === "damage" ? 0 : event.kind === "heal" ? 1 : 2;
    if (!best || amount > best.amount || (amount === best.amount && priority < best.priority))
      best = { cue, amount, priority };
  }
  return best?.cue;
}

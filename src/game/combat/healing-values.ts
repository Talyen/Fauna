import { isEnemy } from "../battlefield";
import { hasTalent } from "../progression";
import type { GameState } from "../types";
import { maximumHealth, type Combatant } from "./state";

/** Magnitude only; rewards, revival permission and bounce remain execution policy. */
export function healingValue(state: GameState | undefined, unit: Combatant, amount: number) {
  if (state?.phase === "battle") {
    if (!isEnemy(unit) && hasTalent(state, "health.mending")) amount *= 1.1;
    if (isEnemy(unit) && unit.combat.poison > 0 && hasTalent(state, "poison.necrosis")) amount *= 0.5;
    if (isEnemy(unit) && unit.combat.bleed > 0 && hasTalent(state, "bleed.mortal-wound")) amount *= 0.5;
  }
  return amount;
}

export function restoration(unit: Combatant, amount: number) {
  const rounded = Math.round(amount);
  const gain = Math.min(Math.max(0, rounded), maximumHealth(unit) - unit.health);
  return { rounded, gain, excess: Math.max(0, rounded - gain) };
}

export const overflowBlock = (excess: number) => Math.round(excess * 0.25);

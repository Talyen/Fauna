import { talentRule } from "../rules/talents";
import { healingAllies, isEnemy } from "../battlefield";
import { hasTalent } from "../progression";
import type { GameState } from "../types";
import { maximumHealth, type Combatant } from "./state";

/** Magnitude only; rewards, revival permission and bounce remain execution policy. */
export function healingValue(state: GameState | undefined, unit: Combatant, amount: number) {
  if (state?.phase === "battle") {
    if (!isEnemy(unit) && hasTalent(state, "health.mending"))
      amount *= 1 + talentRule("health.mending").percent / 100;
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

export const overflowBlock = (excess: number) =>
  Math.round(excess * (talentRule("health.overflow").percent / 100));

/** Overflow can reach only other living allies still at Death's Door. */
export function overflowRecipients(state: GameState, unit: Combatant) {
  return healingAllies(state).filter(
    (ally) => ally.id !== unit.id && (ally.combat?.grace ?? 0) > 0 && ally.health < maximumHealth(ally),
  );
}

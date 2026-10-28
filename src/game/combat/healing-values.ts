import { boonRule } from "../rules/boons";
import { harmfulStatuses } from "./state";
import { talentRule } from "../rules/talents";
import { healingAllies, isEnemy } from "../battlefield";
import { hasTalent } from "../progression";
import type { GameState } from "../types";
import { maximumHealth, mostInjured, type Combatant } from "./state";

/** Adds the scoop's per-recipient bonus even when another healing effect supplies an adjusted amount. */
export function scoopBonus(state: GameState | undefined, unit: Combatant, amount: number) {
  if (
    state?.phase !== "battle" ||
    isEnemy(unit) ||
    amount <= 0 ||
    !state.boons.includes("clover-measuring-scoop")
  )
    return 0;
  const stats = unit.combat;
  if (!stats) return 0;
  let count = 0;
  for (const status of harmfulStatuses) if (stats.controlled === status || Number(stats[status]) > 0) count++;
  return count * boonRule("clover-measuring-scoop").healing;
}

/** Magnitude only; rewards, revival permission and bounce remain execution policy. */
export function healingValue(state: GameState | undefined, unit: Combatant, amount: number) {
  if (state?.phase === "battle") {
    const enemy = isEnemy(unit);
    if (!enemy && hasTalent(state, "health.mending"))
      amount *= 1 + talentRule("health.mending").percent / 100;
    amount += scoopBonus(state, unit, amount);
    if (enemy && unit.combat.poison > 0 && hasTalent(state, "poison.necrosis")) amount *= 0.5;
    if (enemy && unit.combat.bleed > 0 && hasTalent(state, "bleed.mortal-wound")) amount *= 0.5;
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

/** Overflow Cup uses the same recipient for execution and visible benefit estimates. */
export function overflowCupRecipient(state: GameState, unit: Combatant) {
  return mostInjured(
    healingAllies(state).filter((ally) => ally.id !== unit.id && ally.health < maximumHealth(ally)),
  );
}

/** Overflow can reach only other living allies still at Death's Door. */
export function overflowRecipients(state: GameState, unit: Combatant) {
  return healingAllies(state).filter(
    (ally) => ally.id !== unit.id && (ally.combat?.grace ?? 0) > 0 && ally.health < maximumHealth(ally),
  );
}

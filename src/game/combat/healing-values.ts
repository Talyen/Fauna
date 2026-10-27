import { talentRule } from "../rules/talents";
import { healingAllies, isEnemy } from "../battlefield";
import { hasTalent } from "../progression";
import type { GameState } from "../types";
import { maximumHealth, mostInjured, type Combatant } from "./state";

/** Magnitude only; rewards, revival permission and bounce remain execution policy. */
export function healingValue(state: GameState | undefined, unit: Combatant, amount: number) {
  if (state?.phase === "battle") {
    const enemy = isEnemy(unit);
    if (!enemy && hasTalent(state, "health.mending"))
      amount *= 1 + talentRule("health.mending").percent / 100;
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
  const allies = healingAllies(state);
  let next = 0;
  for (const ally of allies)
    if (ally.id !== unit.id && ally.health < maximumHealth(ally)) allies[next++] = ally;
  allies.length = next;
  return mostInjured(allies);
}

/** Overflow can reach only other living allies still at Death's Door. */
export function overflowRecipients(state: GameState, unit: Combatant) {
  const allies = healingAllies(state);
  let next = 0;
  for (const ally of allies)
    if (ally.id !== unit.id && (ally.combat?.grace ?? 0) > 0 && ally.health < maximumHealth(ally))
      allies[next++] = ally;
  allies.length = next;
  return allies;
}

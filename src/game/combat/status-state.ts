import type { CombatState } from "../types";
import { STACK_LIMIT } from "./state";

export type PeriodicStatus = "burn" | "poison" | "bleed";
type Control = NonNullable<CombatState["controlled"]>;
type BleedPayout = CombatState["bleedLeech"][number];

export function enterControl(stats: CombatState, status: Control, turns: number) {
  stats[status] = 0;
  stats.controlled = status;
  stats.controlTurns = turns;
}

export function beginControlTurn(stats: CombatState) {
  stats.skipped = !!stats.controlled;
}

function recoverControl(stats: CombatState) {
  if (stats.controlled) delete stats.statusSources[stats.controlled];
  stats.controlled = null;
  stats.controlTurns = 0;
  stats.cooldown = 3;
}

/** Recovery cannot revoke the action window already skipped this turn. */
export function consumeControlTurn(stats: CombatState): Control | null {
  const status = stats.controlled;
  stats.controlTurns = Math.max(0, stats.controlTurns - 1);
  if (stats.controlTurns !== 0) return null;
  recoverControl(stats);
  return status;
}

export function cleanseControl(stats: CombatState) {
  recoverControl(stats);
  stats.skipped = false;
}

export function advanceControlImmunity(stats: CombatState) {
  if (stats.cooldown > 0) stats.cooldown--;
}

export function clearHarmfulStatus(stats: CombatState, status: PeriodicStatus | Control | "blind") {
  if (status === "blind") stats.blind = false;
  else stats[status] = 0;
  delete stats.statusSources[status];
  if (status === "bleed") stats.bleedLeech = [];
}

export function addPeriodicStacks(
  stats: CombatState,
  status: PeriodicStatus,
  amount: number,
  sourceId: string,
) {
  const before = stats[status];
  stats[status] = Math.min(STACK_LIMIT, before + amount);
  const gained = stats[status] - before;
  if (gained > 0) stats.statusSources[status] = sourceId;
  return gained;
}

/** Partial stack reduction has no Cleanse rewards; Bleed obligations remain FIFO. */
export function reducePeriodicStacks(stats: CombatState, status: PeriodicStatus, amount: number) {
  const removed = Math.min(stats[status], amount);
  stats[status] = Math.max(0, stats[status] - amount);
  if (status === "bleed") {
    let remaining = removed;
    while (remaining > 0 && stats.bleedLeech.length) {
      const payout = stats.bleedLeech[0]!;
      const reduction = Math.min(remaining, payout.amount);
      payout.amount -= reduction;
      remaining -= reduction;
      if (!payout.amount) stats.bleedLeech.shift();
    }
  }
  if (stats[status] === 0) clearHarmfulStatus(stats, status);
  return removed;
}

export function setPeriodicStacks(stats: CombatState, status: PeriodicStatus, amount: number) {
  stats[status] = amount;
  if (amount === 0) clearHarmfulStatus(stats, status);
}

export function deferLeech(stats: CombatState, sourceId: string, amount: number) {
  const entry = stats.bleedLeech.find((payout) => payout.sourceId === sourceId);
  const available = Math.max(0, stats.bleed - stats.bleedLeech.reduce((sum, row) => sum + row.amount, 0));
  const gained = Math.min(amount, available);
  if (entry) entry.amount += gained;
  else if (gained) stats.bleedLeech.push({ sourceId, amount: gained });
}

/** Retain the pre-reaction obligations even when a threshold Cleanse removes the wound. */
export function periodicTick(stats: CombatState, status: PeriodicStatus) {
  return {
    amount: stats[status],
    sourceId: stats.statusSources[status],
    payouts: status === "bleed" ? stats.bleedLeech : [],
  };
}

export function finishBleedTick(stats: CombatState) {
  stats.bleedLeech = [];
}

export function detonateBleedStacks(stats: CombatState) {
  const captured = periodicTick(stats, "bleed");
  clearHarmfulStatus(stats, "bleed");
  return captured;
}

/** Allocate Health actually removed, including unpaid entries whose owner has departed. */
export function bleedPayments(payouts: readonly BleedPayout[], lost: number) {
  let remaining = lost;
  return payouts.map(({ sourceId, amount }) => {
    const paid = Math.min(remaining, amount);
    remaining -= paid;
    return { sourceId, amount: paid };
  });
}

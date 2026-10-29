import type { CombatState } from "../types";
import { STACK_LIMIT, ensureCombat, removeArmor, type Combatant } from "./state";
import type { beneficialStatuses, harmfulStatuses } from "./state";

export type PeriodicStatus = "burn" | "poison" | "bleed";
type Control = NonNullable<CombatState["controlled"]>;
type BleedPayout = CombatState["bleedLeech"][number];

// A tick can synchronously trigger a Cleanse and a fresh application of the
// same status. The new application belongs to a later tick, not the old one.
const clearVersions = new WeakMap<CombatState, Partial<Record<PeriodicStatus, number>>>();
const addedStacks = new WeakMap<CombatState, Partial<Record<PeriodicStatus, number>>>();
export function periodicClearVersion(stats: CombatState, status: PeriodicStatus) {
  return clearVersions.get(stats)?.[status] ?? 0;
}
export function periodicAddedStacks(stats: CombatState, status: PeriodicStatus) {
  return addedStacks.get(stats)?.[status] ?? 0;
}

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
  if (status === "burn" || status === "poison" || status === "bleed") {
    let versions = clearVersions.get(stats);
    if (!versions) clearVersions.set(stats, (versions = {}));
    versions[status] = (versions[status] ?? 0) + 1;
  }
  if (status === "blind") stats.blind = false;
  else stats[status] = 0;
  delete stats.statusSources[status];
  if (status === "bleed") stats.bleedLeech = [];
}

/** Remove one selected status; Armor retains its depletion receipt for later reactions. */
export function clearSelectedStatus(
  unit: Combatant,
  status: (typeof harmfulStatuses)[number] | (typeof beneficialStatuses)[number],
) {
  const stats = ensureCombat(unit);
  if (status === "armor") return removeArmor(unit, stats.armor);
  if (status === "dodge") {
    stats.temporaryDodge = 0;
    stats.dodgeFreezeRetaliation = 0;
  }
  if (
    status === "reflect" ||
    status === "reflectBurn" ||
    status === "blind" ||
    status === "nullify" ||
    status === "negate" ||
    status === "attackReflection" ||
    status === "nullifyFreeze"
  )
    stats[status] = false;
  else if (status === "thorns" || status === "dodge") stats[status] = 0;
  else clearHarmfulStatus(stats, status);
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
  if (gained > 0) {
    stats.statusSources[status] = sourceId;
    let additions = addedStacks.get(stats);
    if (!additions) addedStacks.set(stats, (additions = {}));
    additions[status] = (additions[status] ?? 0) + gained;
  }
  return gained;
}

/** Partial stack reduction has no Cleanse rewards; Bleed obligations remain FIFO. */
export function reducePeriodicStacks(stats: CombatState, status: PeriodicStatus, amount: number) {
  const removed = Math.min(stats[status], amount);
  stats[status] = Math.max(0, stats[status] - amount);
  if (status === "bleed") {
    let remaining = removed;
    let consumed = 0;
    while (remaining > 0 && consumed < stats.bleedLeech.length) {
      const payout = stats.bleedLeech[consumed]!;
      const reduction = Math.min(remaining, payout.amount);
      payout.amount -= reduction;
      remaining -= reduction;
      if (!payout.amount) consumed++;
    }
    if (consumed) stats.bleedLeech.splice(0, consumed);
  }
  if (stats[status] === 0) clearHarmfulStatus(stats, status);
  return removed;
}

export function setPeriodicStacks(stats: CombatState, status: PeriodicStatus, amount: number) {
  stats[status] = amount;
  if (amount === 0) clearHarmfulStatus(stats, status);
}

export function deferLeech(stats: CombatState, sourceId: string, amount: number) {
  let entry: BleedPayout | undefined;
  let total = 0;
  for (const payout of stats.bleedLeech) {
    if (!entry && payout.sourceId === sourceId) entry = payout;
    total += payout.amount;
  }
  const available = Math.max(0, stats.bleed - total);
  const gained = Math.min(amount, available);
  if (entry) entry.amount += gained;
  else if (gained) stats.bleedLeech.push({ sourceId, amount: gained });
}

const NO_PAYOUTS: readonly BleedPayout[] = Object.freeze([]);

/** Retain the pre-reaction obligations even when a threshold Cleanse removes the wound. */
export function periodicTick(stats: CombatState, status: PeriodicStatus) {
  return {
    amount: stats[status],
    sourceId: stats.statusSources[status],
    payouts:
      status === "bleed" && stats.bleedLeech.length
        ? stats.bleedLeech.map((payout) => ({ ...payout }))
        : NO_PAYOUTS,
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

/** Allocate mitigated damage, including Block absorption and departed sources' unpaid entries. */
export function bleedPayments(payouts: readonly BleedPayout[], dealt: number) {
  let remaining = dealt;
  return payouts.map(({ sourceId, amount }) => {
    const paid = Math.min(remaining, amount);
    remaining -= paid;
    return { sourceId, amount: paid };
  });
}

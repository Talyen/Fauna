import { roll } from "../random";
import { draw } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";

import type { GameEvent, GameState } from "../types";
import { combat, unitName, STACK_LIMIT, type Combatant } from "./state";

import { reaction, type Resolution } from "./operations";

export function* tickStatuses(state: GameState, unit: Combatant, events: GameEvent[]): Resolution<void> {
  const stats = combat(unit);
  if (
    !("maxHealth" in unit) &&
    unit.health > 0 &&
    stats.poison > 0 &&
    state.boons.includes("plague-doctors-mask")
  ) {
    const removed = Math.min(2, stats.poison);
    stats.poison -= removed;
    events.push({
      kind: "status",
      targetId: unit.id,
      amount: -removed,
      status: "cleanse",
      affectedStatus: "poison",
      outcome: "remove",
      text: `${unitName(unit)} Cleanses ${removed} Poison.`,
    });
    if (stats.poison === 0) {
      delete stats.statusSources.poison;
      yield* reaction("cleanseRewards", state, unit, 1, events);
    }
    const target = state.battle!.enemies.find((enemy) => enemy.health > 0);
    if (target)
      yield* reaction("hit", state, unit, target, Math.round(removed / 2), "poison", events, {
        origin: "proc",
      });
    if (state.battle!.enemies.every((enemy) => enemy.health <= 0)) return;
  }
  for (const status of ["burn", "poison", "bleed"] as const) {
    if (unit.health <= 0) break;
    const amount = stats[status];
    if (amount <= 0) continue;
    // Ticks bypass Block and do not reapply their own buildup.
    const source =
      [...state.team, ...state.reserves, ...state.battle!.enemies].find(
        (candidate) => candidate.id === stats.statusSources[status],
      ) ?? unit;
    // Cleanse reactions may remove the wound, but cannot revoke healing earned by this tick.
    const payouts = status === "bleed" ? stats.bleedLeech : [];
    const lost =
      (yield* reaction("hit", state, source, unit, amount, status, events, { origin: "periodic" })) ?? 0;
    if (status === "bleed") {
      stats.bleedLeech = [];
      let remaining = lost;
      for (const payout of payouts) {
        const owner = [...state.team, ...state.reserves, ...state.battle!.enemies].find(
          (candidate) => candidate.id === payout.sourceId,
        );
        const paid = Math.min(remaining, payout.amount);
        if (owner) yield* reaction("leechHealth", state, owner, paid, events, true);
        remaining -= paid;
      }
    }
    // Threshold reactions can Cleanse the ticking status; decay must not restore it.
    if (stats[status] === 0) continue;
    stats[status] =
      status === "bleed"
        ? 0
        : status === "burn"
          ? amount <= 1
            ? 0
            : Math.round(amount / 2)
          : Math.max(0, amount - Math.max(1, Math.round(amount * 0.2)));
    if ("maxHealth" in unit && !("maxHealth" in source)) {
      if (status === "burn" && hasTalent(state, "burn.smoldering") && roll(state) < 0.1) stats.burn = amount;
      if (status === "poison") {
        if (stats.controlled === "freeze" && hasTalent(state, "freeze.cryo-preservation"))
          stats.poison = amount;
        if (hasTalent(state, "poison.virulent") && roll(state) < 0.1)
          stats.poison = Math.min(STACK_LIMIT, amount + 1);
      }
    }
    if (stats[status] === 0) delete stats.statusSources[status];
  }
}
/** Called once at the start of the owner's turn, including while in reserve. */
export function* startAction(
  unit: Combatant,
  events: GameEvent[],
  state?: GameState,
  resetTemporaryDodge = true,
): Resolution<boolean> {
  const stats = combat(unit);
  if (resetTemporaryDodge) stats.temporaryDodge = 0;
  stats.encoreUsed = false;
  stats.cardsPlayedThisTurn = 0;
  stats.firstAttackUsed = false;
  stats.skipped = !!stats.controlled;
  if (state?.phase === "battle" && state.battle && unit.health > 0) {
    const enemy = "maxHealth" in unit;
    const row = enemy ? state.battle.enemies : state.team;
    // The allied turn number advances after startAction; enemies act on the current number
    const turn = state.battle.turn + Number(!enemy);
    if (turn % 2 === 0 && row.some((deployed) => deployed.id === unit.id)) {
      const amount = creaturePassive(enemy ? undefined : state, unit.species).effects.reduce(
        (sum, effect) => sum + (effect.kind === "tidalRegeneration" ? effect.amount : 0),
        0,
      );
      if (amount > 0) yield* reaction("restoreHealth", unit, amount, events, false, state);
    }
  }
  if (stats.controlled) {
    events.push({
      kind: "status",
      targetId: unit.id,
      status: stats.controlled,
      outcome: "skip",
      text: `${unitName(unit)} skips its ${stats.controlled === "freeze" ? "Frozen" : "Stunned"} turn.`,
    });
    stats.controlTurns = Math.max(0, stats.controlTurns - 1);
    if (stats.controlTurns === 0) {
      if (
        stats.controlled === "freeze" &&
        "maxHealth" in unit &&
        state &&
        hasTalent(state, "freeze.thaw-dividend")
      )
        draw(state, 1);
      stats.controlled = null;
      stats.cooldown = 3;
    }
  } else if (stats.cooldown > 0) stats.cooldown--;
  return !stats.skipped;
}

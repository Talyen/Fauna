import { boonRule } from "../rules/boons";
import { chance as succeeds } from "../chance";
import { isEnemy, battlefield } from "../battlefield";
import { draw } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";

import type { GameEvent, GameState } from "../types";
import { ensureCombat, unitName, STACK_LIMIT, type Combatant } from "./state";

import { reaction, type Resolution } from "./operations";
import {
  beginControlTurn,
  consumeControlTurn,
  advanceControlImmunity,
  reducePeriodicStacks,
  periodicTick,
  finishBleedTick,
  bleedPayments,
  setPeriodicStacks,
} from "./status-state";

export function* tickStatuses(state: GameState, unit: Combatant, events: GameEvent[]): Resolution<void> {
  const stats = ensureCombat(unit);
  if (!isEnemy(unit) && unit.health > 0 && stats.poison > 0 && state.boons.includes("plague-doctors-mask")) {
    const removed = reducePeriodicStacks(stats, "poison", boonRule("plague-doctors-mask").removed);
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
      yield* reaction("cleanseRewards", state, unit, 1, events);
    }
    const target = state.battle!.enemies.find((enemy) => enemy.health > 0);
    if (target)
      yield* reaction(
        "hit",
        state,
        unit,
        target,
        Math.round(removed / boonRule("plague-doctors-mask").divisor),
        "poison",
        events,
        {
          origin: "proc",
        },
      );
    if (state.battle!.enemies.every((enemy) => enemy.health <= 0)) return;
  }
  for (const status of ["burn", "poison", "bleed"] as const) {
    if (unit.health <= 0) break;
    if (stats[status] <= 0) continue;
    const { amount, sourceId, payouts } = periodicTick(stats, status);
    // Ticks bypass Block and do not reapply their own buildup.
    const source =
      [...battlefield(state, "player"), ...state.reserves, ...battlefield(state, "enemy")].find(
        (candidate) => candidate.id === sourceId,
      ) ?? unit;
    // Cleanse reactions may remove the wound, but cannot revoke healing earned by this tick.
    const lost =
      (yield* reaction("hit", state, source, unit, amount, status, events, { origin: "periodic" })) ?? 0;
    if (status === "bleed") {
      finishBleedTick(stats);
      for (const payout of bleedPayments(payouts, lost)) {
        const owner = [
          ...battlefield(state, "player"),
          ...state.reserves,
          ...battlefield(state, "enemy"),
        ].find((candidate) => candidate.id === payout.sourceId);
        if (owner) yield* reaction("leechHealth", state, owner, payout.amount, events, true);
      }
    }
    // Threshold reactions can Cleanse the ticking status; decay must not restore it.
    if (stats[status] === 0) continue;
    let next =
      status === "bleed"
        ? 0
        : status === "burn"
          ? amount <= 1
            ? 0
            : Math.round(amount / 2)
          : Math.max(0, amount - Math.max(1, Math.round(amount * 0.2)));
    if (isEnemy(unit) && !isEnemy(source)) {
      if (status === "burn" && hasTalent(state, "burn.smoldering") && succeeds(state, 0.1, false, events))
        next = amount;
      if (status === "poison") {
        if (stats.controlled === "freeze" && hasTalent(state, "freeze.cryo-preservation")) next = amount;
        if (hasTalent(state, "poison.virulent") && succeeds(state, 0.1, false, events))
          next = Math.min(STACK_LIMIT, amount + 1);
      }
    }
    setPeriodicStacks(stats, status, next);
  }
}
/** Called once at the start of the owner's turn, including while in reserve. */
export function* startAction(
  unit: Combatant,
  events: GameEvent[],
  state?: GameState,
  resetTemporaryDodge = true,
): Resolution<boolean> {
  const stats = ensureCombat(unit);
  if (resetTemporaryDodge) stats.temporaryDodge = 0;
  stats.encoreUsed = false;
  stats.cardsPlayedThisTurn = 0;
  stats.fallenCardsPlayedThisTurn = 0;
  stats.firstAttackUsed = false;
  beginControlTurn(stats);
  if (state?.phase === "battle" && state.battle && unit.health > 0) {
    const enemy = isEnemy(unit);
    const row = battlefield(state, enemy ? "enemy" : "player");
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
    const recovered = consumeControlTurn(stats);
    if (recovered === "freeze" && isEnemy(unit) && state && hasTalent(state, "freeze.thaw-dividend"))
      draw(state, 1, events);
  } else advanceControlImmunity(stats);
  return !stats.skipped;
}

import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { chance as succeeds } from "../chance";
import { isEnemy, battlefield } from "../battlefield";
import { draw } from "../card-zones";
import { roll } from "../random";
import { hasTalent, creaturePassive } from "../progression";

import type { GameEvent, GameState } from "../types";
import { ensureCombat, unitName, STACK_LIMIT, harmfulStatuses, type Combatant } from "./state";

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
  if (!isEnemy(unit) && unit.health > 0 && state.boons.includes("knot-comb")) {
    const effects = harmfulStatuses.filter(
      (status) => stats.controlled === status || Number(stats[status]) > 0,
    );
    const effect =
      effects.length > 1
        ? effects[Math.floor(roll(state, { kind: "index", size: effects.length }) * effects.length)]
        : effects[0];
    if (effect) yield* reaction("removeEffects", unit, "cleanse", 1, events, state, effect);
  }
  if (!isEnemy(unit) && unit.health > 0 && stats.poison > 0 && state.boons.includes("plague-doctors-mask")) {
    const sourceId = stats.statusSources.poison;
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
    yield* reaction("cleanseThorns", state, unit, removed, events);
    yield* reaction("returnCleansedEffect", state, unit, "poison", removed, sourceId, events);
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
    // Ticks use ordinary Block absorption without reapplying their own buildup.
    const source =
      [...battlefield(state, "player"), ...state.reserves, ...battlefield(state, "enemy")].find(
        (candidate) => candidate.id === sourceId,
      ) ?? unit;
    // Cleanse reactions may remove the wound, but cannot revoke healing earned by this tick.
    // Periodic packets have no attack delivery; retain the payment for deferred Leech.
    const payment = yield* reaction("resolveHit", state, source, unit, amount, status, events, {
      origin: "periodic",
    });
    if (status === "bleed") {
      finishBleedTick(stats);
      for (const payout of bleedPayments(payouts, payment.outcome === "landed" ? payment.dealt : 0)) {
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
      if (
        status === "burn" &&
        hasTalent(state, "burn.smoldering") &&
        succeeds(state, talentRule("burn.smoldering").percent / 100, false, events)
      )
        next = amount;
      if (status === "poison") {
        if (stats.controlled === "freeze" && hasTalent(state, "freeze.cryo-preservation")) next = amount;
        if (
          hasTalent(state, "poison.virulent") &&
          succeeds(state, talentRule("poison.virulent").percent / 100, false, events)
        )
          next = Math.min(STACK_LIMIT, amount + 1);
      }
    }
    setPeriodicStacks(stats, status, next);
    if (
      status === "burn" &&
      isEnemy(unit) &&
      !isEnemy(source) &&
      state.boons.includes("cinder-fan") &&
      amount > next
    ) {
      const targets = battlefield(state, "enemy").filter((enemy) => enemy.id !== unit.id && enemy.health > 0);
      const lost = amount - next;
      for (const [index, target] of targets.entries()) {
        const damage = Math.floor(lost / targets.length) + Number(index < lost % targets.length);
        if (damage > 0)
          yield* reaction("hit", state, source, target, damage, "burn", events, { origin: "derived" });
      }
    }
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

import { boonRule } from "../rules/boons";
import { talentChance } from "../chance";
import { isEnemy, battlefield, combatantById, cleanseTargets } from "../battlefield";
import { draw } from "../card-zones";
import { roll } from "../random";
import { hasTalent, passiveAmount } from "../progression";

import type { GameEvent, GameState } from "../types";
import { ensureCombat, unitName, STACK_LIMIT, harmfulStatuses, controlled, type Combatant } from "./state";

import { reaction, type Resolution } from "./operations";
import { settleBleedLeech } from "./damage-reactions";
import {
  beginControlTurn,
  consumeControlTurn,
  advanceControlImmunity,
  reducePeriodicStacks,
  periodicTick,
  finishBleedTick,
  setPeriodicStacks,
  periodicClearVersion,
  periodicAddedStacks,
} from "./status-state";

const periodicStatuses = ["burn", "poison", "bleed"] as const;

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
    for (const recipient of cleanseTargets(state, unit)) {
      if (unit.health <= 0) break;
      const stats = ensureCombat(recipient);
      if (recipient.health <= 0 || stats.poison <= 0) continue;
      const sourceId = stats.statusSources.poison;
      const removed = reducePeriodicStacks(stats, "poison", boonRule("plague-doctors-mask").removed);
      events.push({
        kind: "status",
        targetId: recipient.id,
        amount: -removed,
        status: "cleanse",
        affectedStatus: "poison",
        outcome: "remove",
        text: `${unitName(recipient)} Cleanses ${removed} Poison.`,
      });
      if (stats.poison === 0) {
        yield* reaction("cleanseRewards", state, recipient, 1, events);
      }
      yield* reaction("cleanseThorns", state, recipient, removed, events);
      yield* reaction("poisonCleanseMana", state, recipient, removed, events);
      yield* reaction("returnCleansedEffect", state, recipient, "poison", removed, sourceId, events);
      const target = state.battle!.enemies.find((enemy) => enemy.health > 0);
      if (target)
        yield* reaction(
          "hit",
          state,
          recipient,
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
  }
  for (const status of periodicStatuses) {
    if (unit.health <= 0) break;
    if (stats[status] <= 0) continue;
    const { amount, sourceId, payouts } = periodicTick(stats, status);
    const clearVersion = periodicClearVersion(stats, status);
    const addedBefore = periodicAddedStacks(stats, status);
    // Ticks use ordinary Block absorption without reapplying their own buildup.
    const source = combatantById(state, sourceId) ?? unit;
    // Cleanse reactions may remove the wound, but cannot revoke healing earned by this tick.
    // Periodic packets have no attack delivery; retain the payment for deferred Leech.
    const payment = yield* reaction("resolveHit", state, source, unit, amount, status, events, {
      origin: "periodic",
    });
    if (status === "bleed") {
      if (periodicClearVersion(stats, status) === clearVersion) finishBleedTick(stats);
      yield* settleBleedLeech(state, unit, payouts, payment.outcome === "landed" ? payment.dealt : 0, events);
    }
    // Threshold reactions can Cleanse the ticking status; decay must not restore it.
    if (stats[status] === 0 || periodicClearVersion(stats, status) !== clearVersion) continue;
    let next =
      status === "bleed"
        ? 0
        : status === "burn"
          ? amount <= 1
            ? 0
            : Math.round(amount / 2)
          : Math.max(0, amount - Math.max(1, Math.round(amount * 0.2)));
    if (isEnemy(unit) && !isEnemy(source)) {
      if (status === "burn" && talentChance(state, "burn.smoldering", events)) next = amount;
      if (status === "poison") {
        if (stats.controlled === "freeze" && hasTalent(state, "freeze.cryo-preservation")) next = amount;
        if (talentChance(state, "poison.virulent", events)) next = Math.min(STACK_LIMIT, amount + 1);
      }
    }
    if (status === "burn" && isEnemy(unit) && stats.armor > 0 && state.boons.includes("lava-cameo"))
      next = amount;
    if (status === "burn" && isEnemy(unit) && state.boons.includes("last-candle"))
      next = Math.max(boonRule("last-candle").minimum, next);
    const fresh =
      status === "bleed" ? 0 : Math.min(stats[status], periodicAddedStacks(stats, status) - addedBefore);
    const old = stats[status] - fresh;
    const decayed = Math.max(0, next - (amount - old));
    setPeriodicStacks(stats, status, Math.min(STACK_LIMIT, decayed + fresh));
    if (
      status === "burn" &&
      isEnemy(unit) &&
      unit.health > 0 &&
      old > decayed &&
      state.boons.includes("ashfall-pendant")
    ) {
      const removed = Math.min(unit.block, old - decayed);
      unit.block -= removed;
      if (removed > 0)
        events.push({
          kind: "block",
          actorId: source.id,
          targetId: unit.id,
          amount: -removed,
          text: `${unitName(unit)} loses ${removed} Block to Ashfall Pendant`,
        });
    }
    if (
      status === "burn" &&
      isEnemy(unit) &&
      !isEnemy(source) &&
      state.boons.includes("cinder-fan") &&
      old > decayed
    ) {
      const targets = battlefield(state, "enemy").filter((enemy) => enemy.id !== unit.id && enemy.health > 0);
      const lost = old - decayed;
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
    // The allied turn number advances after startAction; enemies act on the current number
    const turn = state.battle.turn + Number(!enemy);
    if (turn % 2 === 0) {
      const amount = passiveAmount(enemy ? undefined : state, unit.species, "tidalRegeneration");
      if (
        amount > 0 &&
        battlefield(state, enemy ? "enemy" : "player").some((deployed) => deployed.id === unit.id)
      )
        yield* reaction("restoreHealth", unit, amount, events, false, state);
    }
  }
  if (stats.controlled) {
    if (controlled(unit, state))
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
  return !controlled(unit, state);
}

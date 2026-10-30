import { emitSupport } from "../events";
import { findLivingBattlefield } from "../battlefield";
import { encore, kindlingFlourish, beforeAbility, talentRepeat } from "./ability-modifiers";
import { goldenChorus } from "./legendary";
import { takeCardRepeat } from "./card-repeat";
import { executePrimary } from "./ability-handlers";
import { applyExtras } from "./ability-extras";
import { livingOpponents, type AbilityAction } from "./ability-context";
import { species } from "../content";
import { abilityKeywords } from "../progression";
import { ensureCombat, beginAttack, openingCriticalBonus } from "./index";
import { chance as succeeds } from "../chance";
import { boonRule } from "../rules/boons";
import { roll } from "../random";
import { passiveAmount } from "../progression";
import type { GameEvent, BattleState } from "../types";

/** Runs inside the command draft; command costs, counters and settlement stay with the caller. */
export function executeAbility(state: BattleState, action: AbilityAction, events: GameEvent[]) {
  const { actor, def } = action;
  const grantedRepeat = takeCardRepeat(state, action.side);
  const enemy = action.side === "enemy";
  const randomTarget = def.effect === "attack" && def.target === "randomEnemy";
  const opponents = randomTarget ? livingOpponents(state, action) : undefined;
  // Keep the selected target across repeats unless Tangram must continue after a defeat.
  let target =
    opponents !== undefined
      ? opponents[Math.floor(roll(state, { kind: "index", size: opponents.length }) * opponents.length)]
      : def.effect === "attack" && def.target === "allEnemies"
        ? undefined
        : action.targetId === undefined
          ? undefined
          : findLivingBattlefield(state, enemy ? "player" : "enemy", (unit) => unit.id === action.targetId);
  const name = enemy ? action.actor.name : species(actor.species).name;
  events.push({
    kind: "action",
    actionType: def.effect === "attack" ? "attack" : "support",
    actorId: actor.id,
    announcement: { kind: "useAbility", definitionId: def.id },
    targetId: enemy
      ? def.effect === "attack" && def.target === "allEnemies"
        ? undefined
        : target?.id
      : action.targetId,
    text: `${name} uses ${def.name}.`,
  });
  const keywords = abilityKeywords(def);
  beforeAbility(state, actor, target, keywords, enemy, events);
  if (actor.health <= 0) return;
  const stats = ensureCombat(actor);
  const prepared = def.effect === "attack" && stats.turnBackReady;
  if (prepared) stats.turnBackReady = false;
  const tideRepeat =
    !!prepared &&
    succeeds(
      state,
      passiveAmount(enemy ? undefined : state, actor.species, "turnBackTide") / 100,
      enemy,
      events,
    );
  const previousPlays = stats.cardsPlayedThisTurn;
  stats.cardsPlayedThisTurn = Math.min(2, previousPlays + 1);
  const flourishRepeat = previousPlays === 1 && kindlingFlourish(state, actor, events);
  const encoreRepeat = encore(state, actor, events);
  const abilityRepeat =
    def.repeatChance !== undefined && succeeds(state, def.repeatChance / 100, enemy, events);
  const repeat = talentRepeat(state, keywords, enemy, events);
  for (
    let play = 0;
    play < (grantedRepeat || repeat || encoreRepeat || abilityRepeat || flourishRepeat || tideRepeat ? 2 : 1);
    play++
  ) {
    if (
      play > 0 &&
      !enemy &&
      def.effect === "attack" &&
      target &&
      target.health <= 0 &&
      state.boons.includes("dream-tangram")
    )
      target = findLivingBattlefield(state, enemy ? "player" : "enemy");
    if (
      actor.health <= 0 ||
      (def.effect === "attack" &&
        (def.target === "allEnemies"
          ? !findLivingBattlefield(state, enemy ? "player" : "enemy")
          : !target || target.health <= 0))
    )
      break;
    if (play === 1 && (grantedRepeat || encoreRepeat || abilityRepeat || flourishRepeat || tideRepeat))
      emitSupport(events, actor.id, {
        text: `${name} repeats ${def.name}${flourishRepeat ? " with Kindling Flourish" : encoreRepeat ? " with Encore" : ""}`,
      });
    const toothpickPurge =
      def.effect === "attack" && !enemy && state.boons.includes("dragons-toothpick") && stats.toothpickReady;
    if (toothpickPurge) stats.toothpickReady = false;
    const oasisLeech = def.effect === "attack" && !enemy && stats[boonRule("oasis-seed").state];
    if (oasisLeech) stats[boonRule("oasis-seed").state] = false;
    const criticalBonus =
      def.effect === "attack"
        ? Math.max(
            openingCriticalBonus(state, actor),
            def.criticalWhenLastCard && action.lastCardInHand ? 100 : 0,
          )
        : 0;
    const repeatedPrecision = play > 0 && !enemy && state.boons.includes("aether-gramophone");
    const acrobatPrecision = def.effect === "attack" && !enemy && stats[boonRule("acrobat-top").state];
    if (acrobatPrecision) stats[boonRule("acrobat-top").state] = false;
    const cannotDodge = repeatedPrecision || acrobatPrecision;
    const candleLight =
      !enemy && def.effect === "attack" && def.damageType === "light" && state.boons.includes("vow-candle");
    const blindMiss =
      def.effect === "attack" && !candleLight
        ? beginAttack(state, actor, events) && !repeatedPrecision
        : false;
    const additionalTarget =
      play > 0 &&
      !enemy &&
      def.effect === "attack" &&
      def.target !== "allEnemies" &&
      state.boons.includes("cadence-panpipes")
        ? findLivingBattlefield(state, "enemy", (unit) => unit.id !== target?.id)
        : undefined;
    const primary = executePrimary({
      state,
      action,
      events,
      target,
      name,
      stats,
      keywords,
      blindMiss,
      cannotDodge,
      criticalBonus,
      oasisLeech,
      additionalTarget,
      toothpickPurge,
    });
    applyExtras(state, action, events, {
      target: primary ? primary.attackTarget : target,
      blindMiss,
      cannotDodge,
      criticalBonus,
      oasisLeech,
      negated: primary?.negated,
      sharedNegate: primary?.sharedNegate,
    });
    if (primary?.extraAttackTarget && actor.health > 0)
      applyExtras(state, action, events, {
        target: primary.extraAttackTarget,
        blindMiss,
        cannotDodge,
        criticalBonus,
        oasisLeech,
        negated: primary.negated,
        sharedNegate: primary.sharedNegate,
        attackTargetOnly: true,
      });
    if (def.effect === "attack" && actor.health > 0) goldenChorus(state, actor, events);
  }
}

import { encore, kindlingFlourish, beforeAbility, talentRepeat } from "./ability-modifiers";
import { takeCardRepeat } from "./card-repeat";
import { executePrimary } from "./ability-handlers";
import { applyExtras } from "./ability-extras";
import { opposingRow, alive, type AbilityAction, type AbilityOperations } from "./ability-context";
import { species } from "../content";
import { definitionKeywords } from "../keywords";
import { ensureCombat, beginAttack, openingCriticalBonus } from "./index";
import { chance as succeeds } from "../chance";
import { boonRule } from "../rules/boons";
import { roll } from "../random";
import type { GameEvent, BattleState } from "../types";

/** Runs inside the command draft; command costs, counters and settlement stay with the caller. */
export function executeAbility(
  state: BattleState,
  action: AbilityAction,
  events: GameEvent[],
  operations: AbilityOperations,
) {
  const { actor, def } = action;
  const grantedRepeat = takeCardRepeat(state, action.side);
  const enemy = action.side === "enemy";
  const opponents =
    (def.effect === "attack" && def.target === "randomEnemy") || action.targetId !== undefined
      ? alive(opposingRow(state, action))
      : [];
  // Keep the selected target across repeats unless Tangram must continue after a defeat.
  let target =
    def.effect === "attack" && def.target === "randomEnemy"
      ? opponents[Math.floor(roll(state, { kind: "index", size: opponents.length }) * opponents.length)]
      : def.effect === "attack" && def.target === "allEnemies"
        ? undefined
        : opponents.find((unit) => unit.id === action.targetId);
  const name = enemy ? action.actor.name : species(actor.species).name;
  events.push({
    kind: "action",
    actionType: def.effect === "attack" ? "attack" : "support",
    actorId: actor.id,
    targetId: enemy
      ? def.effect === "attack" && def.target === "allEnemies"
        ? undefined
        : target?.id
      : action.targetId,
    text: `${name} uses ${def.name}.`,
  });
  const keywords = definitionKeywords(def);
  beforeAbility(state, actor, target, keywords, enemy, events);
  if (actor.health <= 0) return;
  const stats = ensureCombat(actor);
  const previousPlays = stats.cardsPlayedThisTurn;
  stats.cardsPlayedThisTurn = Math.min(2, previousPlays + 1);
  const flourishRepeat = previousPlays === 1 && kindlingFlourish(state, actor, events);
  const encoreRepeat = encore(state, actor, events);
  const abilityRepeat =
    def.repeatChance !== undefined && succeeds(state, def.repeatChance / 100, enemy, events);
  const repeat = talentRepeat(state, keywords, enemy, events);
  for (
    let play = 0;
    play < (grantedRepeat || repeat || encoreRepeat || abilityRepeat || flourishRepeat ? 2 : 1);
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
      target = alive(opposingRow(state, action))[0];
    if (
      actor.health <= 0 ||
      (def.effect === "attack" &&
        (def.target === "allEnemies"
          ? !opposingRow(state, action).some((unit) => unit.health > 0)
          : !target || target.health <= 0))
    )
      break;
    if (play === 1 && (grantedRepeat || encoreRepeat || abilityRepeat || flourishRepeat))
      events.push({
        kind: "action",
        actionType: "support",
        actorId: actor.id,
        text: `${name} repeats ${def.name}${flourishRepeat ? " with Kindling Flourish" : encoreRepeat ? " with Encore" : ""}`,
      });
    const oasisLeech = def.effect === "attack" && !enemy && stats[boonRule("oasis-seed").state];
    if (oasisLeech) stats[boonRule("oasis-seed").state] = false;
    const criticalBonus =
      def.effect === "attack"
        ? Math.max(
            openingCriticalBonus(state, actor),
            def.criticalWhenLastCard && action.lastCardInHand ? 100 : 0,
          )
        : 0;
    const cannotDodge = play > 0 && !enemy && state.boons.includes("aether-gramophone");
    const blindMiss = def.effect === "attack" ? beginAttack(state, actor, events) && !cannotDodge : false;
    const primary = executePrimary({
      state,
      action,
      events,
      operations,
      target,
      name,
      stats,
      keywords,
      blindMiss,
      cannotDodge,
      criticalBonus,
      oasisLeech,
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
  }
}

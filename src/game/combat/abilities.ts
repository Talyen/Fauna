import { encore, kindlingFlourish, beforeAbility, talentRepeat } from "./ability-modifiers";
import { executePrimary } from "./ability-handlers";
import { applyExtras } from "./ability-extras";
import {
  actorPower,
  opposingRow,
  alive,
  type AbilityAction,
  type AbilityOperations,
} from "./ability-context";
import { species } from "../content";
import { definitionKeywords } from "../keywords";
import { ensureCombat, beginAttack, openingCriticalBonus } from "./index";
import { chance as succeeds } from "../chance";
import { roll } from "../random";
import type { GameEvent, BattleState } from "../types";

/** Runs inside the command draft; command costs, counters and settlement stay with the caller. */
export function executeAbility(
  state: BattleState,
  action: AbilityAction,
  events: GameEvent[],
  operations: AbilityOperations,
) {
  const { actor, def, value } = action;
  const enemy = action.side === "enemy";
  const power = actorPower(action);
  const opponents = alive(opposingRow(state, action));
  // Select once for the whole ability, including repeats. Group targets are read again per resolution.
  const target =
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
  for (let play = 0; play < (repeat || encoreRepeat || abilityRepeat || flourishRepeat ? 2 : 1); play++) {
    if (
      actor.health <= 0 ||
      (def.effect === "attack" &&
        (def.target === "allEnemies"
          ? !alive(opposingRow(state, action)).length
          : !target || target.health <= 0))
    )
      break;
    if (play === 1 && (encoreRepeat || abilityRepeat || flourishRepeat))
      events.push({
        kind: "action",
        actionType: "support",
        actorId: actor.id,
        text: `${name} repeats ${def.name}${flourishRepeat ? " with Kindling Flourish" : encoreRepeat ? " with Encore" : ""}`,
      });
    const negated = new Set<string>();
    const criticalBonus = def.effect === "attack" ? openingCriticalBonus(state, actor) : 0;
    const blindMiss = def.effect === "attack" ? beginAttack(state, actor, events) : false;
    const context = {
      state,
      action,
      actor,
      def,
      value,
      events,
      operations,
      enemy,
      power,
      target,
      attackTarget: target,
      name,
      stats,
      keywords,
      blindMiss,
      criticalBonus,
      negated,
    };
    executePrimary(context);
    applyExtras(state, action, events, { target: context.attackTarget, blindMiss, criticalBonus, negated });
  }
}

import { executePrimary } from "./ability-handlers";
import { applyExtras } from "./ability-extras";
import {
  actorPower,
  opposingRow,
  alive,
  type AbilityAction,
  type AbilityOperations,
} from "./ability-context";
import { isRosterCreature } from "../battlefield";
import { species } from "../content";
import { creaturePassive, hasTalent } from "../progression";
import { definitionKeywords } from "../keywords";
import {
  ensureCombat,
  grantArmor,
  triggerArmorBreak,
  removeArmor,
  beginAttack,
  openingCriticalBonus,
  type Combatant,
} from "./index";
import { chance as succeeds } from "../chance";
import { roll } from "../random";
import type { GameState, GameEvent, BattleState } from "../types";

function encore(state: GameState, actor: Combatant, events: GameEvent[]) {
  const stats = ensureCombat(actor);
  const chance = creaturePassive(isRosterCreature(actor) ? state : undefined, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "encore" ? effect.amount : 0),
    0,
  );
  if (chance <= 0 || stats.encoreUsed) return false;
  stats.encoreUsed = true;
  return succeeds(state, chance / 100, !isRosterCreature(actor), events);
}
function kindlingFlourish(state: GameState, actor: Combatant, events: GameEvent[]) {
  const chance = creaturePassive(isRosterCreature(actor) ? state : undefined, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "kindlingFlourish" ? effect.amount : 0),
    0,
  );
  return succeeds(state, chance / 100, !isRosterCreature(actor), events);
}
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
      ? opponents[Math.floor(roll(state) * opponents.length)]
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
  if (!enemy) {
    if (target && keywords.includes("leech") && hasTalent(state, "leech.armor-siphon")) {
      const { removed: stolen, depletion } = removeArmor(target, 1);
      grantArmor(state, actor, stolen, events);
      triggerArmorBreak(state, depletion, events);
    }
    if (
      keywords.includes("block") &&
      hasTalent(state, "armor.armored-surge") &&
      succeeds(state, 0.1, enemy, events)
    )
      grantArmor(state, actor, 6, events);
  }
  if (actor.health <= 0) return;
  const stats = ensureCombat(actor);
  const previousPlays = stats.cardsPlayedThisTurn;
  stats.cardsPlayedThisTurn = Math.min(2, previousPlays + 1);
  const flourishRepeat = previousPlays === 1 && kindlingFlourish(state, actor, events);
  const encoreRepeat = encore(state, actor, events);
  const abilityRepeat =
    def.repeatChance !== undefined && succeeds(state, def.repeatChance / 100, enemy, events);
  const repeatTalents = [
    ["burn", "burn.flash-fire"],
    ["freeze", "freeze.winter-s-grasp"],
    ["nature", "nature.overgrowth"],
    ["poison", "poison.venom-strike"],
    ["stun", "stun.jarring-blow"],
  ] as const;
  const repeat =
    !enemy &&
    repeatTalents.some(
      ([keyword, talent]) =>
        keywords.includes(keyword) && hasTalent(state, talent) && succeeds(state, 0.1, enemy, events),
    );
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

import { battlefieldView, isEnemy } from "../battlefield";
import { passiveAmount } from "../progression";
import { chance } from "../chance";
import { maximumHealth, unitName, type Combatant } from "./state";
import type { GameEvent, GameState } from "../types";

/** One selection per attack recipient; interception never asks another protector to intercept it. */
export function interceptAttack(
  state: GameState,
  source: Combatant,
  target: Combatant,
  events: GameEvent[],
): Combatant {
  if (!state.battle || source.health <= 0 || target.health <= 0 || isEnemy(source) === isEnemy(target))
    return target;
  const enemy = isEnemy(target);
  let targetFraction: number | undefined;
  for (const protector of battlefieldView(state, enemy ? "enemy" : "player")) {
    if (
      protector.id === target.id ||
      protector.health <= 0 ||
      (targetFraction ??= target.health / maximumHealth(target)) >=
        protector.health / maximumHealth(protector)
    )
      continue;
    const percent = passiveAmount(enemy ? undefined : state, protector.species, "gallantry");
    if (!chance(state, percent / 100, enemy, events)) continue;
    events.push({
      kind: "action",
      actionType: "support",
      actorId: protector.id,
      targetId: target.id,
      text: `${unitName(protector)} intercepts the attack against ${unitName(target)}`,
    });
    return protector;
  }
  return target;
}

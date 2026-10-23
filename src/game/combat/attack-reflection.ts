import { ensureCombat, unitName, type Combatant } from "./state";
import type { GameEvent } from "../types";

export function takeAttackReflection(source: Combatant, target: Combatant, events: GameEvent[]) {
  if (source.health <= 0 || target.health <= 0 || !ensureCombat(target).attackReflection) return false;
  ensureCombat(target).attackReflection = false;
  events.push({
    kind: "status",
    status: "attackReflection",
    outcome: "immune",
    actorId: target.id,
    targetId: source.id,
    text: `${unitName(target)} reflects the attack back at ${unitName(source)}`,
  });
  return true;
}

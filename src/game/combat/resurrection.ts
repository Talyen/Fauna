import { ensureCombat, maximumHealth, unitName, type Combatant } from "./state";
import type { GameEvent } from "../types";

import { RESURRECTION_HEALTH_PERCENT } from "../resurrection-rules";

/** Resurrection restores life directly, not healing rewards or another Death's Door. */
export function resurrect(unit: Combatant, actor: Combatant, events: GameEvent[]) {
  if (unit.health !== 0 || ("minion" in unit && unit.minion)) return;
  unit.health = Math.max(1, Math.round((maximumHealth(unit) * RESURRECTION_HEALTH_PERCENT) / 100));
  const stats = ensureCombat(unit);
  stats.grace = 0;
  events.push({
    kind: "heal",
    actorId: actor.id,
    targetId: unit.id,
    amount: unit.health,
    text: `${unitName(actor)} Resurrects ${unitName(unit)} with ${unit.health} Health`,
  });
}

import { battlefieldView, isEnemy } from "../battlefield";
import { passiveAmount } from "../progression";
import type { GameState } from "../types";
import type { Combatant } from "./state";

/** Only living deployed providers lend their side's Light attacks the theft. */
export function glassCutterAmount(state: GameState, attacker: Combatant): number {
  const enemy = isEnemy(attacker);
  let amount = 0;
  for (const unit of battlefieldView(state, enemy ? "enemy" : "player"))
    if (unit.health > 0) amount += passiveAmount(enemy ? undefined : state, unit.species, "glassCutter");
  return amount;
}

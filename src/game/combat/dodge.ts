import { battlefieldHasId, isEnemy, livingBattlefield } from "../battlefield";
import { passiveAmount } from "../progression";
import type { GameEvent, GameState } from "../types";
import { addTemporaryDodge, type Combatant } from "./state";
import { reaction, type Resolution } from "./operations";

export function* grantTemporaryDodge(
  state: GameState,
  unit: Combatant,
  amount: number,
  events: GameEvent[],
): Resolution<void> {
  if (!addTemporaryDodge(unit, amount, events)) return;
  const enemy = isEnemy(unit);
  const side = enemy ? "enemy" : "player";
  if (!battlefieldHasId(state, side, unit.id)) return;
  const frost = passiveAmount(enemy ? undefined : state, unit.species, "rimewake");
  if (!frost) return;
  for (const target of livingBattlefield(state, enemy ? "player" : "enemy")) {
    if (unit.health <= 0) break;
    if (target.health > 0)
      yield* reaction("hit", state, unit, target, frost, "freeze", events, { origin: "statusRetaliation" });
  }
}

import type { Creature, Enemy, GameState } from "./types";
export const isEnemy = (unit: Creature | Enemy): unit is Enemy =>
  "maxHealth" in unit && unit.minion?.side !== "player";
export const isRosterCreature = (unit: Creature | Enemy): unit is Creature => !("maxHealth" in unit);
/** Battle-only summons never enter the roster, backup, lineup or creature deck. */
export function battlefield(state: GameState, side: "player"): (Creature | Enemy)[];
export function battlefield(state: GameState, side: "enemy"): Enemy[];
export function battlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[];
export function battlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[] {
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  const result: (Creature | Enemy)[] = [...row];
  const minions = state.battle?.minions;
  if (!minions?.length) return result;
  const owners = new Set<string>();
  for (const unit of row) if (unit.health > 0) owners.add(unit.id);
  for (const unit of minions)
    if (unit.minion.side === side && owners.has(unit.minion.ownerId)) result.push(unit);
  return result;
}

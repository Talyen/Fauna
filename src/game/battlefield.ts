import type { Creature, Enemy, GameState } from "./types";
export const isEnemy = (unit: Creature | Enemy): unit is Enemy =>
  "maxHealth" in unit && unit.minion?.side !== "player";
/** Battle-only summons never enter the roster, backup, lineup or creature deck. */
export function battlefield(state: GameState, side: "player"): (Creature | Enemy)[];
export function battlefield(state: GameState, side: "enemy"): Enemy[];
export function battlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[];
export function battlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[] {
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  const owners = new Set(row.filter((unit) => unit.health > 0).map((unit) => unit.id));
  return [
    ...row,
    ...(state.battle?.minions ?? []).filter(
      (unit) => unit.minion.side === side && owners.has(unit.minion.ownerId),
    ),
  ];
}

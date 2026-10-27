import type { Creature, Enemy, GameState } from "./types";
export const isEnemy = (unit: Creature | Enemy): unit is Enemy =>
  "maxHealth" in unit && unit.minion?.side !== "player";
export const isRosterCreature = (unit: Creature | Enemy): unit is Creature => !("maxHealth" in unit);
/** Attribution receipts can outlive deployment, knockout and a summoner's departure. */
export function combatantById(state: GameState, id: string | undefined): Creature | Enemy | undefined {
  if (id === undefined) return;
  return (
    state.team.find((unit) => unit.id === id) ??
    state.reserves.find((unit) => unit.id === id) ??
    state.battle?.enemies.find((unit) => unit.id === id) ??
    state.battle?.minions?.find((unit) => unit.id === id)
  );
}
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

/** Stored summon receipts become inert immediately when their owner leaves or falls. */
export function isDepartedMinion(state: GameState, unit: Creature | Enemy): boolean {
  if (!("minion" in unit) || !unit.minion) return false;
  const side = unit.minion.side;
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  if (row.some((current) => current.id === unit.id)) return false;
  return !(state.battle?.minions ?? []).some(
    (current) =>
      current.id === unit.id &&
      current.minion.side === side &&
      row.some((owner) => owner.health > 0 && owner.id === current.minion.ownerId),
  );
}

/** Automatic healing can include backups; selectable targets remain the battlefield. */
export function healingAllies(state: GameState, side: "player" | "enemy" = "player"): (Creature | Enemy)[] {
  const row = battlefield(state, side);
  if (side === "player" && state.phase === "battle" && state.boons.includes("camp-hammock"))
    row.push(...state.reserves);
  return row.filter((unit) => unit.health > 0);
}

/** Expand one Cleanse application once; already-grouped abilities retain their removal count. */
export function cleanseTargets(state: GameState | undefined, unit: Creature | Enemy) {
  return state && !isEnemy(unit) && state.boons.includes("miracle-megaphone")
    ? [unit, ...battlefield(state, "player").filter((ally) => ally.id !== unit.id && ally.health > 0)]
    : [unit];
}

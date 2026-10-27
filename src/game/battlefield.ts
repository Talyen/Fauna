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
  if (minions.length === 1) {
    const unit = minions[0]!;
    if (
      unit.minion.side === side &&
      row.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId)
    )
      result.push(unit);
    return result;
  }
  let owners: Set<string> | undefined;
  for (const unit of minions) {
    if (unit.minion.side !== side) continue;
    if (!owners) {
      owners = new Set<string>();
      for (const owner of row) if (owner.health > 0) owners.add(owner.id);
    }
    if (owners.has(unit.minion.ownerId)) result.push(unit);
  }
  return result;
}

/** Read-only traversal; callers must not change membership while iterating. */
export function battlefieldView(state: GameState, side: "enemy"): readonly Enemy[];
export function battlefieldView(state: GameState, side: "player" | "enemy"): readonly (Creature | Enemy)[];
export function battlefieldView(state: GameState, side: "player" | "enemy"): readonly (Creature | Enemy)[] {
  if (state.battle?.minions?.length) return battlefield(state, side);
  return side === "player" ? state.team : (state.battle?.enemies ?? []);
}

/** Membership without constructing a snapshot; summons require a living deployed owner. */
export function battlefieldHasId(state: GameState, side: "player" | "enemy", id: string): boolean {
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  if (row.some((unit) => unit.id === id)) return true;
  return (
    state.battle?.minions?.some(
      (unit) =>
        unit.id === id &&
        unit.minion.side === side &&
        row.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId),
    ) ?? false
  );
}

/** Find a living participant in battlefield order without creating a row snapshot.
 * The predicate must not change battlefield membership or health.
 */
export function findLivingBattlefield(
  state: GameState,
  side: "enemy",
  predicate?: (unit: Enemy) => boolean,
): Enemy | undefined;
export function findLivingBattlefield(
  state: GameState,
  side: "player" | "enemy",
  predicate?: (unit: Creature | Enemy) => boolean,
): Creature | Enemy | undefined;
export function findLivingBattlefield(
  state: GameState,
  side: "player" | "enemy",
  predicate?: (unit: Creature | Enemy) => boolean,
): Creature | Enemy | undefined {
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  for (const unit of row) if (unit.health > 0 && (!predicate || predicate(unit))) return unit;
  for (const unit of state.battle?.minions ?? [])
    if (
      unit.minion.side === side &&
      unit.health > 0 &&
      row.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId) &&
      (!predicate || predicate(unit))
    )
      return unit;
  return undefined;
}

/** A fresh, ordered snapshot of living battlefield participants. */
export function livingBattlefield(state: GameState, side: "enemy"): Enemy[];
export function livingBattlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[];
export function livingBattlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[] {
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  const living: (Creature | Enemy)[] = [];
  for (const unit of row) if (unit.health > 0) living.push(unit);
  const minions = state.battle?.minions;
  if (!minions?.length) return living;
  let owners: Set<string> | undefined;
  for (const unit of minions) {
    if (unit.minion.side !== side || unit.health <= 0) continue;
    if (minions.length === 1) {
      if (row.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId)) living.push(unit);
    } else {
      if (!owners) {
        owners = new Set();
        for (const owner of living) owners.add(owner.id);
      }
      if (owners.has(unit.minion.ownerId)) living.push(unit);
    }
  }
  return living;
}

/** Stored summon receipts become inert immediately when their owner leaves or falls. */
export function isDepartedMinion(state: GameState, unit: Creature | Enemy): boolean {
  if (!("minion" in unit) || !unit.minion) return false;
  const side = unit.minion.side;
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  if (row.some((current) => current.id === unit.id)) return false;
  return !state.battle?.minions?.some(
    (current) =>
      current.id === unit.id &&
      current.minion.side === side &&
      row.some((owner) => owner.health > 0 && owner.id === current.minion.ownerId),
  );
}

/** Automatic healing can include backups; selectable targets remain the battlefield. */
export function healingAllies(state: GameState, side: "player" | "enemy" = "player"): (Creature | Enemy)[] {
  const row = livingBattlefield(state, side);
  if (side === "player" && state.phase === "battle" && state.boons.includes("camp-hammock"))
    for (const unit of state.reserves) if (unit.health > 0) row.push(unit);
  return row;
}

export function canSpreadCleanse(state: GameState | undefined, unit: Creature | Enemy): boolean {
  return !!state && !isEnemy(unit) && state.boons.includes("miracle-megaphone");
}

/** Expand one Cleanse application once; already-grouped abilities retain their removal count. */
export function cleanseTargets(state: GameState | undefined, unit: Creature | Enemy) {
  const targets: (Creature | Enemy)[] = [unit];
  if (state && canSpreadCleanse(state, unit))
    for (const ally of battlefield(state, "player"))
      if (ally.id !== unit.id && ally.health > 0) targets.push(ally);
  return targets;
}

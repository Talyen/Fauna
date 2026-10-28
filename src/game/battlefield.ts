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
  return battlefieldSnapshot(state, side, false);
}

function battlefieldSnapshot(state: GameState, side: "player" | "enemy", livingOnly: boolean) {
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  const result: (Creature | Enemy)[] = livingOnly ? row.filter((unit) => unit.health > 0) : [...row];
  const minions = state.battle?.minions;
  if (!minions?.length) return result;
  let owners: Set<string> | undefined;
  let checkedMinion = false;
  for (const unit of minions) {
    if (unit.minion.side !== side || (livingOnly && unit.health <= 0)) continue;
    if (!checkedMinion) {
      checkedMinion = true;
      if (row.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId)) result.push(unit);
    } else {
      if (!owners) {
        owners = new Set();
        for (const owner of row) if (owner.health > 0) owners.add(owner.id);
      }
      if (owners.has(unit.minion.ownerId)) result.push(unit);
    }
  }
  return result;
}

/** Read-only traversal; callers must not change membership while iterating. */
export function battlefieldView(state: GameState, side: "enemy"): readonly Enemy[];
export function battlefieldView(state: GameState, side: "player" | "enemy"): readonly (Creature | Enemy)[];
export function battlefieldView(state: GameState, side: "player" | "enemy"): readonly (Creature | Enemy)[] {
  if (state.battle?.minions?.some((unit) => unit.minion.side === side)) return battlefield(state, side);
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
  predicate?: ((unit: Enemy) => boolean) | ((unit: Creature | Enemy) => boolean),
): Creature | Enemy | undefined {
  const row = side === "player" ? state.team : (state.battle?.enemies ?? []);
  // Enemy predicates run only for enemy rows and enemy summons.
  const accepts = predicate as ((unit: Creature | Enemy) => boolean) | undefined;
  for (const unit of row) if (unit.health > 0 && (!accepts || accepts(unit))) return unit;
  const minions = state.battle?.minions;
  if (minions)
    for (const unit of minions)
      if (
        unit.minion.side === side &&
        unit.health > 0 &&
        row.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId) &&
        (!accepts || accepts(unit))
      )
        return unit;
  return undefined;
}

/** A fresh, ordered snapshot of living battlefield participants. */
export function livingBattlefield(state: GameState, side: "enemy"): Enemy[];
export function livingBattlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[];
export function livingBattlefield(state: GameState, side: "player" | "enemy"): (Creature | Enemy)[] {
  return battlefieldSnapshot(state, side, true);
}

/** Stored summon receipts become inert immediately when their owner leaves or falls. */
export function isDepartedMinion(state: GameState, unit: Creature | Enemy): boolean {
  if (!("minion" in unit) || !unit.minion) return false;
  return !battlefieldHasId(state, unit.minion.side, unit.id);
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
    for (const ally of battlefieldView(state, "player"))
      if (ally.id !== unit.id && ally.health > 0) targets.push(ally);
  return targets;
}

/** Snapshot reflected attacks with the original attacker first, then living enemy peers. */
export function enemyReflectionRecipients(state: GameState, source: Creature | Enemy): (Creature | Enemy)[] {
  const recipients: (Creature | Enemy)[] = [source];
  for (const unit of battlefieldView(state, "enemy"))
    if (unit.health > 0 && unit.id !== source.id) recipients.push(unit);
  return recipients;
}

import { roll } from "./random";
import { hasTalent, creaturePassive } from "./progression";
import { species } from "./content";
import type { CombatState, Creature, Enemy, GameEvent, GameState } from "./types";
export const TURN_MANA = 4;
export const TURN_DRAW = 4;
export const STACK_LIMIT = 1_000_000;
export type Combatant = Creature | Enemy;
export function freshCombat(): CombatState {
  return {
    controlTurns: 0,
    rhythm: 0,
    nextPhysical: 0,
    partingCut: false,
    riposte: false,
    freeNature: false,
    freeLight: false,
    freeCard: false,
    reflect: false,
    reflectBurn: false,
    nullify: false,
    nullifyFreeze: false,
    cardsPlayedThisTurn: 0,
    encoreUsed: false,
    firstAttackUsed: false,
    desperateGuardUsed: false,
    armor: 0,
    thorns: 0,
    waterThorns: 0,
    dodge: 0,
    temporaryDodge: 0,
    blind: false,
    burn: 0,
    poison: 0,
    bleed: 0,
    stun: 0,
    freeze: 0,
    controlled: null,
    cooldown: 0,
    skipped: false,
    deathDoorUsed: false,
    grace: 0,
    bleedLeech: [],
    statusSources: {},
  };
}
export function combat(unit: Combatant): CombatState {
  return unit.combat ?? (unit.combat = freshCombat());
}
export const maximumHealth = (unit: Combatant) =>
  "maxHealth" in unit ? unit.maxHealth : species(unit.species).health;
export const unitName = (unit: Combatant) => ("name" in unit ? unit.name : species(unit.species).name);
export const controlled = (unit: Combatant) => !!unit.combat?.controlled || !!unit.combat?.skipped;
export function mostInjured<T extends Combatant>(units: readonly T[]): T | undefined {
  return units
    .filter((unit) => unit.health > 0)
    .sort((a, b) => a.health / maximumHealth(a) - b.health / maximumHealth(b))[0];
}
export function loseHealth(state: GameState, unit: Combatant, amount: number, events: GameEvent[]) {
  const before = unit.health,
    stats = combat(unit);
  unit.health = Math.max(0, before - amount);
  if (
    !("maxHealth" in unit) &&
    unit.health === 0 &&
    before > 0 &&
    (!stats.deathDoorUsed || stats.grace > 0)
  ) {
    if (!stats.deathDoorUsed) {
      stats.deathDoorUsed = true;
      stats.grace = hasTalent(state, "health.will-to-live") ? 3 : 2;
      events.push({
        kind: "status",
        targetId: unit.id,
        status: "deathDoor",
        outcome: "apply",
        text: `${unitName(unit)} reaches Death's Door: ${stats.grace} grace turns.`,
      });
    }
    unit.health = 1;
  }
  const lost = before - unit.health;
  return lost;
}
export const harmfulStatuses = ["burn", "poison", "bleed", "stun", "freeze", "blind"] as const;
export function hasHarmfulEffects(unit: Combatant): boolean {
  const stats = unit.combat;
  return !!stats && (!!stats.controlled || harmfulStatuses.some((status) => Number(stats[status]) > 0));
}
export function deferLeech(target: Combatant, source: Combatant, amount: number) {
  const stats = combat(target);
  const entry = stats.bleedLeech.find((payout) => payout.sourceId === source.id);
  const available = Math.max(0, stats.bleed - stats.bleedLeech.reduce((sum, row) => sum + row.amount, 0));
  const gained = Math.min(amount, available);
  if (entry) entry.amount += gained;
  else if (gained) stats.bleedLeech.push({ sourceId: source.id, amount: gained });
}
function ownDodgeChance(state: GameState, unit: Combatant): number {
  if (unit.health <= 0 || unit.combat?.controlled) return 0;
  const allied = !("maxHealth" in unit);
  const stats = unit.combat;
  if (!allied && (stats?.poison ?? 0) > 0 && hasTalent(state, "poison.torpor")) return 0;
  return Math.min(
    75,
    5 +
      (stats?.dodge ?? 0) +
      (stats?.temporaryDodge ?? 0) +
      (allied
        ? (stats?.rhythm ?? 0) +
          Number(hasTalent(state, "dodge.lightfoot")) * 5 +
          (hasTalent(state, "health.last-gasp") && unit.health < maximumHealth(unit) / 2 ? 10 : 0)
        : 0),
  );
}
export function sharedDodgeChance(state: GameState, target: Combatant): number {
  const allied = !("maxHealth" in target);
  const row = allied ? state.team : (state.battle?.enemies ?? []);
  if (target.health <= 0 || !row.some((unit) => unit.id === target.id)) return 0;
  return row
    .filter((unit) => unit.id !== target.id && unit.health > 0)
    .reduce((total, unit) => {
      const share = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
        (sum, effect) => sum + (effect.kind === "shareDodge" ? effect.amount : 0),
        0,
      );
      return total + (ownDodgeChance(state, unit) * share) / 100;
    }, 0);
}
export function dodgeChance(state: GameState, target: Combatant): number {
  const own = ownDodgeChance(state, target);
  return own === 0 ? 0 : Math.min(75, own + sharedDodgeChance(state, target));
}
export function grantTemporaryDodge(unit: Combatant, amount: number, events: GameEvent[]) {
  if (unit.health <= 0) return;
  const stats = combat(unit),
    before = stats.temporaryDodge;
  stats.temporaryDodge = Math.min(70, before + amount);
  const gained = stats.temporaryDodge - before;
  if (!gained) return;
  events.push({
    kind: "status",
    targetId: unit.id,
    status: "dodge",
    outcome: "gain",
    amount: gained,
    text: `${unitName(unit)} gains ${gained}% Dodge until its next turn`,
  });
}
export function beginAttack(state: GameState, source: Combatant): boolean {
  const stats = combat(source);
  if (!stats.blind) return false;
  stats.blind = false;
  return roll(state) < 0.5;
}
export function openingCriticalBonus(state: GameState, source: Combatant): number {
  const stats = combat(source);
  if (stats.firstAttackUsed) return 0;
  stats.firstAttackUsed = true;
  return creaturePassive("maxHealth" in source ? undefined : state, source.species).effects.reduce(
    (total, effect) => total + (effect.kind === "earlyBird" ? effect.amount : 0),
    0,
  );
}

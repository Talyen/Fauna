import { chance as succeeds } from "../chance";
import { isEnemy, isRosterCreature, battlefield } from "../battlefield";
import { hasTalent, creaturePassive } from "../progression";
import { species } from "../content";
import type { CombatState, Creature, Enemy, GameEvent, GameState } from "../types";
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
    negate: false,
    attackReflection: false,
    fallenCardsPlayedThisTurn: 0,
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
export function ensureCombat(unit: Combatant): CombatState {
  return unit.combat ?? (unit.combat = freshCombat());
}
export const maximumHealth = (unit: Combatant) =>
  "maxHealth" in unit ? unit.maxHealth : species(unit.species).health;
export const unitName = (unit: Combatant) => ("name" in unit ? unit.name : species(unit.species).name);
export const controlled = (unit: Combatant) => !!unit.combat?.controlled || !!unit.combat?.skipped;
/** Ties retain battlefield order; reserves and knockouts are never recipients. */
export function mostInjured<T extends Combatant>(units: readonly T[]): T | undefined {
  let target: T | undefined;
  let lowest = Infinity;
  for (const unit of units) {
    if (unit.health <= 0) continue;
    const fraction = unit.health / maximumHealth(unit);
    if (!target || fraction < lowest) {
      target = unit;
      lowest = fraction;
    }
  }
  return target;
}
export function loseHealth(state: GameState, unit: Combatant, amount: number, events: GameEvent[]) {
  const before = unit.health,
    stats = ensureCombat(unit);
  unit.health = Math.max(0, before - amount);
  if (
    isRosterCreature(unit) &&
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
export function ownDodgeChance(state: GameState, unit: Combatant): number {
  if (unit.health <= 0 || unit.combat?.controlled) return 0;
  const allied = !isEnemy(unit);
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
/** Share intrinsic Dodge only; received aura bonuses never amplify another provider. */
export function sharedDodgeChance(state: GameState, target: Combatant): number {
  const allied = !isEnemy(target);
  const row = battlefield(state, allied ? "player" : "enemy");
  if (target.health <= 0 || !row.some((unit) => unit.id === target.id)) return 0;
  let total = 0;
  for (const unit of row) {
    if (unit.id === target.id || unit.health <= 0) continue;
    const share = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "shareDodge" ? effect.amount : 0),
      0,
    );
    total += (ownDodgeChance(state, unit) * share) / 100;
  }
  return total;
}
export function dodgeChance(state: GameState, target: Combatant): number {
  const own = ownDodgeChance(state, target);
  return own === 0 ? 0 : Math.min(75, own + sharedDodgeChance(state, target));
}
export function grantTemporaryDodge(unit: Combatant, amount: number, events: GameEvent[]) {
  if (unit.health <= 0) return;
  const stats = ensureCombat(unit),
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
/** One Blind roll owns the attack, including area targets and authored extra packets. */
export function beginAttack(state: GameState, source: Combatant, events: GameEvent[] = []): boolean {
  const stats = ensureCombat(source);
  if (!stats.blind) return false;
  stats.blind = false;
  return !succeeds(state, 0.5, isEnemy(source), events, true);
}
/** Capture once per attack so every area target receives the same opening bonus. */
export function openingCriticalBonus(state: GameState, source: Combatant): number {
  const stats = ensureCombat(source);
  if (stats.firstAttackUsed) return 0;
  stats.firstAttackUsed = true;
  return creaturePassive(isEnemy(source) ? undefined : state, source.species).effects.reduce(
    (total, effect) => total + (effect.kind === "earlyBird" ? effect.amount : 0),
    0,
  );
}

/** A transient receipt for one positive-to-zero transition; never part of the saved aggregate. */
export interface ArmorDepletion {
  readonly unit: Combatant;
  delivered: boolean;
}
export function removeArmor(unit: Combatant, amount: number) {
  const stats = ensureCombat(unit);
  const before = stats.armor;
  const removed = Math.min(before, Math.max(0, amount));
  stats.armor -= removed;
  const depletion: ArmorDepletion | null =
    before > 0 && stats.armor === 0 ? { unit, delivered: false } : null;
  return { removed, depletion };
}

export function gainGold(state: GameState, amount: number, events: GameEvent[]) {
  if (!state.battle) return;
  const gained = Math.min(Math.max(0, Math.round(amount)), STACK_LIMIT - state.currency);
  state.currency += gained;
  state.battle.earnedGold += gained;
  if (state.journey) state.journey.currency = Math.min(STACK_LIMIT, state.journey.currency + gained);
  if (gained) events.push({ kind: "reward", amount: gained, text: `Gain ${gained} Gold.` });
}

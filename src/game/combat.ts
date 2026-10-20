import { species, type DamageType } from "./content";
import type { CombatState, Creature, Enemy, GameEvent, GameState } from "./types";

export const TURN_MANA = 4;
export const TURN_DRAW = 4;
export const HAND_LIMIT = 7;
export const STACK_LIMIT = 1_000_000;
export type Combatant = Creature | Enemy;
export function freshCombat(): CombatState {
  return {
    armor: 0,
    forge: 0,
    thorns: 0,
    dodge: 0,
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
  };
}
export function combat(unit: Combatant): CombatState {
  return unit.combat ?? (unit.combat = freshCombat());
}
export function roll(state: GameState) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}
export const maximumHealth = (unit: Combatant) =>
  "maxHealth" in unit ? unit.maxHealth : species(unit.species).health;
export const unitName = (unit: Combatant) => ("name" in unit ? unit.name : species(unit.species).name);
export const controlled = (unit: Combatant) => !!unit.combat?.controlled || !!unit.combat?.skipped;
export function restoreHealth(unit: Combatant, amount: number, events: GameEvent[], revive = false) {
  if (unit.health === 0 && !revive) return;
  const gain = Math.min(Math.max(0, Math.round(amount)), maximumHealth(unit) - unit.health);
  unit.health += gain;
  if (gain)
    events.push({
      kind: "heal",
      targetId: unit.id,
      amount: gain,
      text: `${unitName(unit)} restores ${gain} Health.`,
    });
}
function loseHealth(unit: Combatant, amount: number, events: GameEvent[]) {
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
      stats.grace = 2;
      events.push({
        kind: "status",
        targetId: unit.id,
        text: `${unitName(unit)} reaches Death's Door: 2 grace turns.`,
      });
    }
    unit.health = 1;
  }
  return before - unit.health;
}
export function grantStatus(
  unit: Combatant,
  status: "armor" | "forge" | "thorns" | "dodge",
  amount: number,
  events: GameEvent[],
) {
  if (unit.health <= 0) return;
  const stats = combat(unit),
    before = stats[status];
  stats[status] = Math.min(status === "dodge" ? 70 : STACK_LIMIT, before + amount);
  const gain = stats[status] - before;
  if (gain)
    events.push({
      kind: "status",
      targetId: unit.id,
      amount: gain,
      text: `${unitName(unit)} gains ${gain} ${status}.`,
    });
}
export function removeEffects(
  unit: Combatant,
  kind: "cleanse" | "purge",
  count: number,
  events: GameEvent[],
) {
  const stats = combat(unit);
  const statuses =
    kind === "cleanse"
      ? (["burn", "poison", "bleed", "stun", "freeze"] as const)
      : (["armor", "forge", "thorns", "dodge"] as const);
  if (kind === "purge" && unit.block > 0 && count > 0) {
    unit.block = 0;
    count--;
  }
  if (kind === "cleanse" && stats.controlled && count > 0) {
    stats.controlled = null;
    stats.skipped = false;
    stats.cooldown = 3;
    count--;
  }
  let removed = false;
  for (const status of statuses)
    if (count > 0 && stats[status] > 0) {
      stats[status] = 0;
      if (status === "bleed") stats.bleedLeech = [];
      count--;
      removed = true;
    }
  if (removed || count === 0)
    events.push({
      kind: "status",
      targetId: unit.id,
      text: `${unitName(unit)}: ${kind === "cleanse" ? "Cleanse" : "Purge"}.`,
    });
}
/** One attack packet. Periodic and retaliation packets never dodge, crit, build statuses, or retaliate. */
export function hit(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  events: GameEvent[],
  options: { periodic?: boolean; retaliation?: boolean; leech?: boolean } = {},
) {
  if (source.health <= 0 || target.health <= 0 || value <= 0) return;
  const attack = !options.periodic && !options.retaliation;
  const stats = combat(target),
    offense = combat(source),
    before = target.health;
  if (attack && !controlled(target) && roll(state) < Math.min(75, 5 + stats.dodge) / 100) {
    events.push({ kind: "status", targetId: target.id, text: `${unitName(target)} Dodges.` });
    if (!("maxHealth" in target))
      state.battleXP.dodge = Math.min(STACK_LIMIT, (state.battleXP.dodge ?? 0) + 1);
    return;
  }
  let damage = Math.round(value + (attack && (type === "physical" || type === "stun") ? offense.forge : 0));
  const critical = attack && !("maxHealth" in source) && roll(state) < 0.05;
  if (critical) damage *= 2;
  const blocked = options.periodic ? 0 : Math.min(target.block, damage);
  target.block -= blocked;
  damage -= blocked;
  if (type === "physical" || type === "stun") damage = Math.max(0, damage - stats.armor);
  const lost = loseHealth(target, damage, events);
  if (damage > 0) stats.armor = Math.max(0, stats.armor - 1);
  if (blocked)
    events.push({
      kind: "block",
      actorId: source.id,
      targetId: target.id,
      amount: -blocked,
      text: `${unitName(target)} blocks ${blocked} damage.`,
    });
  events.push({
    kind: "damage",
    actorId: source.id,
    targetId: target.id,
    amount: lost,
    damageType: type,
    text: `${unitName(target)} takes ${lost} ${type} damage${critical ? " (Critical)" : ""}.`,
  });
  if (target.health === 0)
    events.push({ kind: "knockout", targetId: target.id, text: `${unitName(target)} is knocked out.` });
  if (attack && damage > 0) {
    if (type === "burn" || type === "poison" || type === "bleed") {
      stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
      if (type === "bleed" && options.leech) stats.bleedLeech.push({ sourceId: source.id, amount: damage });
      events.push({
        kind: "status",
        targetId: target.id,
        text: `${unitName(target)} gains ${damage} ${type}.`,
      });
    }
    if (
      (type === "stun" || type === "freeze") &&
      source.health > 0 &&
      target.health > 0 &&
      !stats.controlled &&
      !stats.skipped &&
      stats.cooldown === 0
    ) {
      stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
      const threshold = ("maxHealth" in target ? before : maximumHealth(target)) / 2;
      if (stats[type] >= threshold) {
        stats[type] = 0;
        stats.controlled = type;
        events.push({
          kind: "status",
          targetId: target.id,
          text: `${unitName(target)} is ${type === "stun" ? "Stunned" : "Frozen"}.`,
        });
      }
    }
    // Captured damage remains valid even if retaliation later removes the attacker.
    if (lost > 0 && stats.thorns > 0 && target.health > 0) {
      const reflected = stats.thorns;
      stats.thorns--;
      hit(state, target, source, reflected, "nature", events, { retaliation: true });
    }
    if (options.leech && type !== "bleed" && source.health > 0)
      restoreHealth(source, Math.round(lost / 2), events);
  }
}
export function tickStatuses(state: GameState, unit: Combatant, events: GameEvent[]) {
  const stats = combat(unit);
  for (const status of ["burn", "poison", "bleed"] as const) {
    if (unit.health <= 0) break;
    const amount = stats[status];
    if (amount <= 0) continue;
    const before = unit.health;
    // Ticks bypass Block and do not reapply their own buildup.
    hit(state, unit, unit, amount, status, events, { periodic: true });
    stats[status] =
      status === "bleed"
        ? 0
        : status === "burn"
          ? amount <= 1
            ? 0
            : Math.round(amount / 2)
          : Math.max(0, amount - Math.max(1, Math.round(amount * 0.2)));
    if (status === "bleed") {
      let remaining = before - unit.health;
      for (const payout of stats.bleedLeech) {
        const source = [...state.team, ...state.reserves, ...state.battle!.enemies].find(
          (c) => c.id === payout.sourceId,
        );
        const paid = Math.min(remaining, payout.amount);
        if (source) restoreHealth(source, Math.round(paid / 2), events);
        remaining -= paid;
      }
      stats.bleedLeech = [];
    }
  }
}
/** Called once at the owner's action window, including while in reserve. */
export function startAction(unit: Combatant, events: GameEvent[]) {
  const stats = combat(unit);
  stats.skipped = !!stats.controlled;
  if (stats.controlled) {
    events.push({
      kind: "status",
      targetId: unit.id,
      text: `${unitName(unit)} skips its ${stats.controlled === "freeze" ? "Frozen" : "Stunned"} turn.`,
    });
    stats.controlled = null;
    stats.cooldown = 3;
  } else if (stats.cooldown > 0) stats.cooldown--;
  return !stats.skipped;
}

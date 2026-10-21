import { hasTalent } from "./progression";
import { physicalBonus } from "./rules";
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
    statusSources: {},
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
export function restoreHealth(
  unit: Combatant,
  amount: number,
  events: GameEvent[],
  revive = false,
  state?: GameState,
) {
  if (state?.phase === "battle") {
    if (!("maxHealth" in unit) && hasTalent(state, "heal.mending")) amount *= 1.1;
    if ("maxHealth" in unit && unit.combat.poison > 0 && hasTalent(state, "poison.necrosis")) amount *= 0.5;
    if ("maxHealth" in unit && unit.combat.bleed > 0 && hasTalent(state, "bleed.mortal-wound")) amount *= 0.5;
  }
  if (unit.health === 0 && !revive) return;
  const gain = Math.min(Math.max(0, Math.round(amount)), maximumHealth(unit) - unit.health);
  unit.health += gain;
  if (gain) {
    events.push({
      kind: "heal",
      targetId: unit.id,
      amount: gain,
      text: `${unitName(unit)} restores ${gain} Health.`,
    });
    if (state?.phase === "battle" && !("maxHealth" in unit) && state.boons.includes("groves-favor"))
      grantStatus(unit, "thorns", 1, events);
  }
}
export function grantBlock(state: GameState, unit: Combatant, amount: number, events: GameEvent[]) {
  if (unit.health <= 0 || amount <= 0) return;
  const gained = Math.min(STACK_LIMIT - unit.block, Math.round(amount));
  unit.block += gained;
  if (!gained) return;
  events.push({
    kind: "block",
    targetId: unit.id,
    amount: gained,
    text: `${unitName(unit)} gains ${gained} Block.`,
  });
  if (!("maxHealth" in unit) && state.boons.includes("ironwood-buckler"))
    grantStatus(unit, "thorns", 1, events);
}
function leechHealth(state: GameState, unit: Combatant, lost: number, events: GameEvent[]) {
  if (lost <= 0) return;
  let amount = Math.round(lost / 2);
  if (!("maxHealth" in unit)) {
    if (hasTalent(state, "leech.deep-siphon")) amount++;
    if (hasTalent(state, "leech.desperate-siphon") && unit.health < maximumHealth(unit) / 2) amount *= 2;
  }
  restoreHealth(unit, amount, events, false, state);
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
  status: "armor" | "thorns" | "dodge",
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
  state?: GameState,
) {
  const stats = combat(unit);
  let cleansed = 0;
  const statuses =
    kind === "cleanse"
      ? (["burn", "poison", "bleed", "stun", "freeze"] as const)
      : (["armor", "thorns", "dodge"] as const);
  if (kind === "purge" && unit.block > 0 && count > 0) {
    unit.block = 0;
    count--;
  }
  if (kind === "cleanse" && stats.controlled && count > 0) {
    stats.controlled = null;
    cleansed++;
    stats.skipped = false;
    stats.cooldown = 3;
    count--;
  }
  let removed = false;
  for (const status of statuses)
    if (count > 0 && stats[status] > 0) {
      stats[status] = 0;
      if (kind === "cleanse") {
        cleansed++;
        delete stats.statusSources[status as "burn" | "poison" | "bleed"];
      }
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
  if (cleansed > 0 && state && !("maxHealth" in unit)) {
    const healing =
      Number(hasTalent(state, "heal.renewal")) * 2 + (state.boons.includes("sin-eaters-lantern") ? 6 : 0);
    if (healing) restoreHealth(unit, healing * cleansed, events, false, state);
  }
}
/** One attack packet. Periodic and retaliation packets never dodge, crit, build statuses, or retaliate. */
export function hit(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  events: GameEvent[],
  options: { periodic?: boolean; retaliation?: boolean; derived?: boolean; leech?: boolean } = {},
) {
  if ((source.health <= 0 && !options.periodic && !options.derived) || target.health <= 0 || value <= 0)
    return;
  const attack = !options.periodic && !options.retaliation && !options.derived;
  const alliedSource = !("maxHealth" in source),
    alliedTarget = !("maxHealth" in target);
  const stats = combat(target),
    before = target.health;
  const blessedLeech =
    alliedSource &&
    type === "light" &&
    hasTalent(state, "light.blessed-leech") &&
    source.health < maximumHealth(source) / 2;
  let appliedControl = false;
  if (
    attack &&
    !stats.controlled &&
    !(!alliedTarget && stats.poison > 0 && hasTalent(state, "poison.torpor")) &&
    roll(state) <
      Math.min(75, 5 + stats.dodge + (alliedTarget && hasTalent(state, "dodge.lightfoot") ? 5 : 0)) / 100
  ) {
    events.push({ kind: "status", targetId: target.id, text: `${unitName(target)} Dodges.` });
    if (alliedTarget && hasTalent(state, "dodge.catch-breath"))
      restoreHealth(target, 1, events, false, state);
    if (alliedTarget) state.battleXP.dodge = Math.min(STACK_LIMIT, (state.battleXP.dodge ?? 0) + 1);
    return;
  }
  let damage = value;
  if (
    attack &&
    alliedSource &&
    type === "burn" &&
    state.battle &&
    state.boons.includes("meteorite") &&
    !state.battle.meteoriteUsed
  ) {
    state.battle.meteoriteUsed = true;
    damage *= 2;
  }
  if (attack && alliedSource) {
    if (type === "physical") damage += physicalBonus(source, state);
    if (type === "bleed" && stats.bleed === 0 && hasTalent(state, "bleed.first-blood")) damage *= 1.25;
  }
  damage = Math.round(damage);
  const critical = attack && !("maxHealth" in source) && roll(state) < 0.05;
  if (critical) damage *= 2;
  const blocked = options.periodic ? 0 : Math.min(target.block, damage);
  target.block -= blocked;
  const depletedBlock = blocked > 0 && target.block === 0;
  damage -= blocked;
  if (type === "physical" || type === "stun") damage = Math.max(0, damage - stats.armor);
  const armorBefore = stats.armor;
  const lost = loseHealth(target, damage, events);
  if (damage > 0) {
    stats.armor = Math.max(0, stats.armor - 1);
    if (alliedSource && type === "burn" && hasTalent(state, "burn.melting-point"))
      stats.armor = Math.max(0, stats.armor - damage);
    if (alliedTarget && armorBefore > 0 && stats.armor === 0 && hasTalent(state, "armor.reactive-guard"))
      grantBlock(state, target, 3, events);
  }
  // Depletion rewards use the original block payment, not any newly granted Block.
  if (alliedTarget && depletedBlock && hasTalent(state, "block.second-wind"))
    restoreHealth(target, 2, events, false, state);
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
  if (target.health === 0 && !alliedTarget && alliedSource && state.boons.includes("bone-charm"))
    restoreHealth(source, 3, events, false, state);
  if (attack && damage > 0) {
    if (type === "burn" || type === "poison" || type === "bleed") {
      stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
      stats.statusSources[type] = source.id;
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
      stats.cooldown === 0 &&
      !(type === "stun" && alliedTarget && target.block > 0 && hasTalent(state, "block.grounding"))
    ) {
      stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
      const threshold =
        ("maxHealth" in target ? before : maximumHealth(target)) *
        (type === "freeze" && alliedSource && hasTalent(state, "freeze.bitter-cold") ? 0.4 : 0.5);
      if (stats[type] >= threshold) {
        stats[type] = 0;
        stats.controlled = type;
        appliedControl = true;
        if (alliedSource && !alliedTarget) {
          if (type === "freeze" && hasTalent(state, "freeze.glacial-barrier"))
            grantBlock(state, source, 3, events);
          if (type === "stun" && hasTalent(state, "stun.guarded-counter") && source.block === 0)
            grantBlock(state, source, 4, events);
          if (type === "stun" && hasTalent(state, "stun.shatter-guard")) stats.armor = 0;
        }
        events.push({
          kind: "status",
          targetId: target.id,
          text: `${unitName(target)} is ${type === "stun" ? "Stunned" : "Frozen"}.`,
        });
      }
    }
    if (alliedSource && !alliedTarget && source.health > 0) {
      if (type === "nature" && hasTalent(state, "nature.bramblegrowth") && roll(state) < 0.1)
        grantStatus(source, "thorns", damage, events);
      if (type === "light" && lost > 0 && hasTalent(state, "light.faith-barrier") && roll(state) < 0.1)
        grantBlock(state, source, lost, events);
    }
    // Captured damage remains valid even if retaliation later removes the attacker.
    if (lost > 0 && stats.thorns > 0 && target.health > 0) {
      const reflected = stats.thorns;
      stats.thorns--;
      hit(state, target, source, reflected, "nature", events, { retaliation: true });
    }
    if ((options.leech || blessedLeech) && type !== "bleed" && source.health > 0)
      leechHealth(state, source, lost, events);
    if (appliedControl && alliedSource && !alliedTarget) {
      if (type === "freeze" && state.boons.includes("icy-heart"))
        hit(state, source, target, 6, "physical", events, { derived: true });
      if (type === "stun" && state.boons.includes("thunderstone"))
        hit(state, source, target, 6, "nature", events, { derived: true });
    }
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
    const source =
      [...state.team, ...state.reserves, ...state.battle!.enemies].find(
        (candidate) => candidate.id === stats.statusSources[status],
      ) ?? unit;
    hit(state, source, unit, amount, status, events, { periodic: true });
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
        if (source) leechHealth(state, source, paid, events);
        remaining -= paid;
      }
      stats.bleedLeech = [];
    }
    if (stats[status] === 0) delete stats.statusSources[status];
  }
}
/** Called once at the start of the owner's turn, including while in reserve. */
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

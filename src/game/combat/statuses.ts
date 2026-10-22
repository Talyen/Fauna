import { roll } from "../random";
import { draw } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";

import type { DamageType } from "../content";
import type { GameEvent, GameState } from "../types";
import {
  combat,
  maximumHealth,
  unitName,
  deferLeech,
  harmfulStatuses,
  STACK_LIMIT,
  removeArmor,
  type ArmorDepletion,
  type Combatant,
} from "./state";

import { reaction, type Resolution } from "./operations";

interface StatusResult {
  depletions: ArmorDepletion[];
  appliedControl: boolean;
  suppressed: boolean;
}

export function* grantStatus(
  unit: Combatant,
  status: "armor" | "thorns" | "waterThorns" | "dodge",
  amount: number,
  events: GameEvent[],
  state?: GameState,
  sharing = true,
): Resolution<void> {
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
      status,
      outcome: "gain",
      text: `${unitName(unit)} gains ${gain} ${status === "waterThorns" ? "Water Thorns" : status}.`,
    });
  if ((status === "thorns" || status === "waterThorns") && state && sharing)
    yield* reaction("shareProtection", state, unit, status, gain, events);
}
export function* triggerArmorBreak(
  state: GameState,
  depletion: ArmorDepletion | null,
  events: GameEvent[],
): Resolution<void> {
  if (!depletion || depletion.delivered) return;
  depletion.delivered = true;
  const { unit } = depletion;
  if (state.phase !== "battle" || unit.health <= 0 || !state.battle) return;
  const allied = !("maxHealth" in unit);
  if (allied && hasTalent(state, "armor.reactive-guard"))
    yield* reaction("grantBlock", state, unit, 3, events);
  const row = allied ? state.team : state.battle.enemies;
  if (!row.some((deployed) => deployed.id === unit.id)) return;
  const amount = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
    (total, effect) => total + (effect.kind === "armorBreak" ? effect.amount : 0),
    0,
  );
  if (!amount) return;
  const targets = allied ? state.battle.enemies : state.team;
  for (const target of targets) {
    if (unit.health <= 0) break;
    if (target.health > 0)
      yield* reaction("hit", state, unit, target, amount, "burn", events, { origin: "proc" });
  }
}
export function* removeFreezeBuildup(
  state: GameState,
  unit: Combatant,
  events: GameEvent[],
): Resolution<void> {
  const stats = combat(unit);
  if (stats.freeze <= 0) return;
  const amount = stats.freeze;
  stats.freeze = 0;
  events.push({
    kind: "status",
    targetId: unit.id,
    status: "cleanse",
    affectedStatus: "freeze",
    outcome: "remove",
    amount,
    text: `${unitName(unit)}: Cleanse Freeze build-up`,
  });
  yield* reaction("cleanseRewards", state, unit, 1, events);
}
export function* removeEffects(
  unit: Combatant,
  kind: "cleanse" | "purge",
  count: number,
  events: GameEvent[],
  state?: GameState,
): Resolution<void> {
  const stats = combat(unit);
  let depletion: ArmorDepletion | null = null;
  let cleansed = 0;
  const removedStatuses: NonNullable<GameEvent["affectedStatus"]>[] = [];
  const statuses =
    kind === "cleanse"
      ? harmfulStatuses
      : ([
          "armor",
          "thorns",
          "waterThorns",
          "dodge",
          "reflect",
          "reflectBurn",
          "nullify",
          "nullifyFreeze",
        ] as const);
  if (kind === "purge" && unit.block > 0 && count > 0) {
    unit.block = 0;
    removedStatuses.push("block");
    count--;
  }
  if (kind === "cleanse" && stats.controlled && count > 0) {
    removedStatuses.push(stats.controlled);
    stats.controlled = null;
    stats.controlTurns = 0;
    cleansed++;
    stats.skipped = false;
    stats.cooldown = 3;
    count--;
  }
  for (const status of statuses)
    if (count > 0 && (Number(stats[status]) > 0 || (status === "dodge" && stats.temporaryDodge > 0))) {
      if (status === "dodge") stats.temporaryDodge = 0;
      if (
        status === "reflect" ||
        status === "reflectBurn" ||
        status === "blind" ||
        status === "nullify" ||
        status === "nullifyFreeze"
      )
        stats[status] = false;
      else if (status === "armor") depletion = removeArmor(unit, stats.armor).depletion;
      else stats[status] = 0;
      if (kind === "cleanse") {
        cleansed++;
        delete stats.statusSources[status as "burn" | "poison" | "bleed"];
      }
      if (status === "bleed") stats.bleedLeech = [];
      count--;
      removedStatuses.push(
        status === "reflectBurn" ? "reflect" : status === "nullifyFreeze" ? "nullify" : status,
      );
    }
  for (const affectedStatus of new Set(removedStatuses))
    events.push({
      kind: "status",
      targetId: unit.id,
      status: kind,
      outcome: "remove",
      affectedStatus,
      text: `${unitName(unit)}: ${kind === "cleanse" ? "Cleanse" : "Purge"} ${affectedStatus === "waterThorns" ? "Water Thorns" : affectedStatus}.`,
    });
  if (removedStatuses.length === 0)
    events.push({
      kind: "status",
      targetId: unit.id,
      status: kind,
      outcome: "remove",
      amount: 0,
      text: `${unitName(unit)}: ${kind === "cleanse" ? "Cleanse" : "Purge"} removes no effects.`,
    });
  if (cleansed > 0 && state) yield* reaction("cleanseRewards", state, unit, cleansed, events);
  if (state) yield* reaction("triggerArmorBreak", state, depletion, events);
}
export function* cleanseRewards(
  state: GameState,
  unit: Combatant,
  cleansed: number,
  events: GameEvent[],
): Resolution<void> {
  const stats = combat(unit);
  if (!("maxHealth" in unit)) {
    if (hasTalent(state, "light.divine-favor")) stats.freeLight = true;
    const healing =
      Number(hasTalent(state, "health.renewal")) * 2 + (state.boons.includes("sin-eaters-lantern") ? 6 : 0);
    if (healing) yield* reaction("restoreHealth", unit, healing * cleansed, events, false, state);
  }
}
export function* applyHarmfulStatus(
  state: GameState,
  source: Combatant,
  target: Combatant,
  damage: number,
  type: DamageType | "blind",
  events: GameEvent[],
  options: { leech?: boolean; reflected?: boolean } = {},
): Resolution<StatusResult> {
  if (
    type !== "burn" &&
    type !== "poison" &&
    type !== "bleed" &&
    type !== "stun" &&
    type !== "freeze" &&
    type !== "blind"
  )
    return { depletions: [], appliedControl: false, suppressed: false };
  const stats = combat(target);
  const alliedSource = !("maxHealth" in source),
    alliedTarget = !("maxHealth" in target);
  let appliedControl = false;
  const depletions: ArmorDepletion[] = [];
  const immune =
    (type === "stun" || type === "freeze") &&
    (stats.controlled ||
      stats.skipped ||
      stats.cooldown > 0 ||
      (type === "stun" && alliedTarget && target.block > 0 && hasTalent(state, "block.grounding")));
  if (
    target.health > 0 &&
    !immune &&
    stats.nullify &&
    Number(stats[type]) < (type === "blind" ? 1 : STACK_LIMIT)
  ) {
    stats.nullify = false;
    events.push({
      kind: "status",
      targetId: target.id,
      status: "nullify",
      affectedStatus: type,
      outcome: "remove",
      text: `${unitName(target)} nullifies ${type}`,
    });
    return { depletions: [], appliedControl: false, suppressed: true };
  }
  if (
    target.health > 0 &&
    !options.reflected &&
    !immune &&
    Number(stats[type]) < (type === "blind" ? 1 : STACK_LIMIT)
  ) {
    const enemies = (alliedTarget ? (state.battle?.enemies ?? []) : state.team).filter(
      (unit) => unit.health > 0,
    );
    const chance = creaturePassive(alliedTarget ? state : undefined, target.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "statusReflection" ? effect.amount : 0),
      0,
    );
    const burnReflection = type === "burn" && stats.reflectBurn;
    if (enemies.length && (burnReflection || stats.reflect || (chance > 0 && roll(state) < chance / 100))) {
      const recipient = enemies[Math.floor(roll(state) * enemies.length)]!;
      if (burnReflection) stats.reflectBurn = false;
      else stats.reflect = false;
      events.push({
        kind: "status",
        actorId: target.id,
        targetId: target.id,
        status: "reflect",
        affectedStatus: type,
        outcome: "apply",
        text: `${unitName(target)} reflects ${type} to ${unitName(recipient)}`,
      });
      const reflected = yield* reaction(
        "applyHarmfulStatus",
        state,
        target,
        recipient,
        damage,
        type,
        events,
        {
          reflected: true,
        },
      );
      if (reflected.appliedControl && type !== "blind")
        yield* reaction("controlRewards", state, target, recipient, type, events);
      for (const depletion of reflected.depletions)
        yield* reaction("triggerArmorBreak", state, depletion, events);
      return { depletions: [], appliedControl: false, suppressed: true };
    }
  }
  if (type === "blind" && target.health > 0 && !stats.blind) {
    stats.blind = true;
    events.push({
      kind: "status",
      actorId: source.id,
      targetId: target.id,
      status: "blind",
      outcome: "apply",
      text: `${unitName(target)} is Blinded`,
    });
  }
  if (type === "burn" || type === "poison" || type === "bleed") {
    const beforeStacks = stats[type];
    stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
    stats.statusSources[type] = source.id;
    if (type === "bleed" && options.leech) deferLeech(target, source, damage);
    events.push({
      kind: "status",
      targetId: target.id,
      status: type,
      outcome: "gain",
      amount: stats[type] - beforeStacks,
      text: `${unitName(target)} gains ${stats[type] - beforeStacks} ${type}.`,
    });
  }
  if (
    (type === "stun" || type === "freeze") &&
    target.health > 0 &&
    (stats.controlled ||
      stats.skipped ||
      stats.cooldown > 0 ||
      (type === "stun" && alliedTarget && target.block > 0 && hasTalent(state, "block.grounding")))
  )
    events.push({
      kind: "status",
      targetId: target.id,
      status: type,
      outcome: "immune",
      text: `${unitName(target)} is immune to ${type} buildup.`,
    });
  if (
    (type === "stun" || type === "freeze") &&
    source.health > 0 &&
    target.health > 0 &&
    !stats.controlled &&
    !stats.skipped &&
    stats.cooldown === 0 &&
    !(type === "stun" && alliedTarget && target.block > 0 && hasTalent(state, "block.grounding"))
  ) {
    const beforeStacks = stats[type];
    stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
    events.push({
      kind: "status",
      targetId: target.id,
      status: type,
      outcome: "gain",
      amount: stats[type] - beforeStacks,
      text: `${unitName(target)} gains ${stats[type] - beforeStacks} ${type} buildup.`,
    });
    const threshold =
      maximumHealth(target) *
      (alliedSource &&
      ((type === "freeze" && hasTalent(state, "freeze.bitter-cold")) ||
        (type === "stun" && hasTalent(state, "stun.concussive-force")))
        ? 0.4
        : 0.5);
    if (stats[type] >= threshold) {
      stats[type] = 0;
      stats.controlled = type;
      stats.controlTurns =
        (type === "stun" && alliedSource && hasTalent(state, "stun.extended-stun")) ||
        (type === "freeze" && alliedSource && !alliedTarget && state.boons.includes("frozen-pocketwatch"))
          ? 2
          : 1;
      appliedControl = true;
      if (alliedSource && !alliedTarget) {
        if (type === "freeze" && hasTalent(state, "freeze.icebound")) target.block = 0;
        if (type === "freeze" && hasTalent(state, "freeze.brittle-armor")) {
          const { depletion } = removeArmor(target, stats.armor);
          if (depletion) depletions.push(depletion);
        }
        if (type === "stun" && hasTalent(state, "stun.free-follow-up")) combat(source).freeCard = true;
        if (type === "stun" && hasTalent(state, "stun.stun-insight")) draw(state, 1);
        if (type === "stun" && hasTalent(state, "stun.stun-surge") && state.battle?.mana === 0)
          yield* reaction("gainMana", state, 1, events);
        if (type === "freeze" && hasTalent(state, "freeze.glacial-barrier"))
          yield* reaction("grantBlock", state, source, 3, events);
        if (type === "stun" && hasTalent(state, "stun.guarded-counter") && source.block === 0)
          yield* reaction("grantBlock", state, source, 4, events);
        if (type === "stun" && hasTalent(state, "stun.shatter-guard")) {
          const { depletion } = removeArmor(target, stats.armor);
          if (depletion) depletions.push(depletion);
        }
      }
      events.push({
        kind: "status",
        targetId: target.id,
        status: type,
        outcome: "apply",
        text: `${unitName(target)} is ${type === "stun" ? "Stunned" : "Frozen"}.`,
      });
    }
  }
  return { depletions, appliedControl, suppressed: false };
}
export function* controlRewards(
  state: GameState,
  source: Combatant,
  target: Combatant,
  type: DamageType,
  events: GameEvent[],
): Resolution<void> {
  if (!("maxHealth" in source) && "maxHealth" in target) {
    if (type === "freeze" && state.boons.includes("icy-heart"))
      yield* reaction("hit", state, source, target, 6, "physical", events, { origin: "derived" });
    if (type === "stun" && state.boons.includes("thunderstone"))
      yield* reaction("hit", state, source, target, 6, "nature", events, { origin: "derived" });
  }
}
export function* applyBlind(
  state: GameState,
  source: Combatant,
  target: Combatant,
  events: GameEvent[],
): Resolution<void> {
  yield* reaction("applyHarmfulStatus", state, source, target, 1, "blind", events);
}

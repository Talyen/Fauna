import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { chance as succeeds } from "../chance";
import { isEnemy, battlefield } from "../battlefield";
import { roll } from "../random";
import { draw } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";

import type { DamageType } from "../content";
import type { GameEvent, GameState } from "../types";
import {
  ensureCombat,
  maximumHealth,
  unitName,
  harmfulStatuses,
  STACK_LIMIT,
  removeArmor,
  type ArmorDepletion,
  type Combatant,
} from "./state";

import { reaction, type Resolution } from "./operations";
import {
  enterControl,
  cleanseControl,
  clearHarmfulStatus,
  addPeriodicStacks,
  deferLeech,
} from "./status-state";

interface StatusResult {
  depletions: ArmorDepletion[];
  appliedControl: boolean;
  suppressed: boolean;
}

/** Returned effects use ordinary protection and immunity, with no second reflection. */
export function* returnCleansedEffect(
  state: GameState,
  unit: Combatant,
  status: (typeof harmfulStatuses)[number],
  amount: number,
  sourceId: string | undefined,
  events: GameEvent[],
  turns?: number,
): Resolution<void> {
  if (
    state.phase !== "battle" ||
    isEnemy(unit) ||
    unit.health <= 0 ||
    amount <= 0 ||
    !state.boons.includes("orbit-armillary")
  )
    return;
  const target = battlefield(state, "enemy").find((enemy) => enemy.id === sourceId && enemy.health > 0);
  if (!target) return;
  const result = yield* reaction(
    "applyHarmfulStatus",
    state,
    unit,
    target,
    turns ? Math.ceil(maximumHealth(target) / 2) : amount,
    status,
    events,
    { reflected: true, controlTurns: turns },
  );
  if (result.appliedControl && status !== "blind")
    yield* reaction("controlRewards", state, unit, target, status, events);
  for (const depletion of result.depletions) yield* reaction("triggerArmorBreak", state, depletion, events);
}

export function* grantStatus(
  unit: Combatant,
  status: "armor" | "thorns" | "waterThorns" | "fireThorns" | "dodge",
  amount: number,
  events: GameEvent[],
  state?: GameState,
  sharing = true,
): Resolution<void> {
  if (unit.health <= 0) return;
  const stats = ensureCombat(unit),
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
      text: `${unitName(unit)} gains ${gain} ${status === "waterThorns" ? "Water Thorns" : status === "fireThorns" ? "Fire Thorns" : status}.`,
    });
  if ((status === "thorns" || status === "waterThorns" || status === "fireThorns") && state && sharing)
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
  const allied = !isEnemy(unit);
  if (allied && hasTalent(state, "armor.reactive-guard"))
    yield* reaction("grantBlock", state, unit, talentRule("armor.reactive-guard").amount, events);
  const row = battlefield(state, allied ? "player" : "enemy");
  if (!row.some((deployed) => deployed.id === unit.id)) return;
  const amount = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
    (total, effect) => total + (effect.kind === "armorBreak" ? effect.amount : 0),
    0,
  );
  if (!amount) return;
  const targets = battlefield(state, allied ? "enemy" : "player");
  for (const target of targets) {
    if (unit.health <= 0) break;
    if (target.health > 0)
      yield* reaction("hit", state, unit, target, amount, "burn", events, { origin: "proc" });
  }
}
export function* removeControlBuildup(
  state: GameState,
  unit: Combatant,
  status: "stun" | "freeze",
  events: GameEvent[],
): Resolution<void> {
  const stats = ensureCombat(unit);
  if (stats[status] <= 0) return;
  const amount = stats[status];
  const sourceId = stats.statusSources[status];
  clearHarmfulStatus(stats, status);
  events.push({
    kind: "status",
    targetId: unit.id,
    status: "cleanse",
    affectedStatus: status,
    outcome: "remove",
    amount,
    text: `${unitName(unit)}: Cleanse ${status === "freeze" ? "Freeze" : "Stun"} build-up`,
  });
  yield* reaction("cleanseRewards", state, unit, 1, events, status === "freeze");
  yield* returnCleansedEffect(state, unit, status, amount, sourceId, events);
}
export function* removeEffects(
  unit: Combatant,
  kind: "cleanse" | "purge",
  count: number,
  events: GameEvent[],
  state?: GameState,
  onlyStatus?: (typeof harmfulStatuses)[number] | "thorns" | "waterThorns" | "fireThorns",
  source?: Combatant,
): Resolution<number> {
  const stats = ensureCombat(unit);
  const thornsBefore = stats.thorns;
  let depletion: ArmorDepletion | null = null;
  let cleansed = 0;
  const hadFreezeBuildup = stats.freeze > 0;
  const removedStatuses: NonNullable<import("../types").StatusEvent["affectedStatus"]>[] = [];
  const returned: {
    status: (typeof harmfulStatuses)[number];
    amount: number;
    sourceId?: string;
    turns?: number;
  }[] = [];
  const remember = (status: (typeof harmfulStatuses)[number], turns?: number) =>
    returned.push({
      status,
      amount: status === "blind" || turns ? 1 : Number(stats[status]),
      sourceId: stats.statusSources[status],
      turns,
    });
  const beneficial = [
    "armor",
    "thorns",
    "waterThorns",
    "fireThorns",
    "dodge",
    "reflect",
    "reflectBurn",
    "nullify",
    "nullifyFreeze",
    "negate",
    "attackReflection",
  ] as const;
  const statuses = onlyStatus ? [onlyStatus] : kind === "cleanse" ? harmfulStatuses : beneficial;
  if (kind === "purge" && state && !isEnemy(unit) && state.boons.includes("basalt-glass-bookmark")) {
    const remaining =
      Number(unit.block > 0) +
      beneficial.filter(
        (status) => Number(stats[status]) > 0 || (status === "dodge" && stats.temporaryDodge > 0),
      ).length;
    count = Math.min(count, Math.max(0, remaining - 1));
  }
  if (kind === "purge" && !onlyStatus && unit.block > 0 && count > 0) {
    unit.block = 0;
    removedStatuses.push("block");
    count--;
  }
  if (
    kind === "cleanse" &&
    stats.controlled &&
    count > 0 &&
    (!onlyStatus || onlyStatus === stats.controlled)
  ) {
    remember(stats.controlled, stats.controlTurns);
    removedStatuses.push(stats.controlled);
    cleanseControl(stats);
    cleansed++;
    count--;
  }
  for (const status of statuses)
    if (count > 0 && (Number(stats[status]) > 0 || (status === "dodge" && stats.temporaryDodge > 0))) {
      if (kind === "cleanse" && harmfulStatuses.includes(status as (typeof harmfulStatuses)[number]))
        remember(status as (typeof harmfulStatuses)[number]);
      if (status === "dodge") stats.temporaryDodge = 0;
      if (
        status === "reflect" ||
        status === "reflectBurn" ||
        status === "blind" ||
        status === "nullify" ||
        status === "negate" ||
        status === "attackReflection" ||
        status === "nullifyFreeze"
      )
        stats[status] = false;
      else if (status === "armor") depletion = removeArmor(unit, stats.armor).depletion;
      else if (
        status === "thorns" ||
        status === "waterThorns" ||
        status === "fireThorns" ||
        status === "dodge"
      )
        stats[status] = 0;
      else clearHarmfulStatus(stats, status);
      if (kind === "cleanse") {
        cleansed++;
        delete stats.statusSources[status as (typeof harmfulStatuses)[number]];
      }
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
      text: `${unitName(unit)}: ${kind === "cleanse" ? "Cleanse" : "Purge"} ${affectedStatus === "waterThorns" ? "Water Thorns" : affectedStatus === "fireThorns" ? "Fire Thorns" : affectedStatus}.`,
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
  if (cleansed > 0 && state)
    yield* reaction(
      "cleanseRewards",
      state,
      unit,
      cleansed,
      events,
      hadFreezeBuildup && stats.freeze === 0 && removedStatuses.includes("freeze"),
    );
  if (
    kind === "purge" &&
    state &&
    isEnemy(unit) &&
    source &&
    !isEnemy(source) &&
    source.health > 0 &&
    thornsBefore > stats.thorns &&
    state.boons.includes("pruning-crescent")
  )
    yield* reaction("grantStatus", source, "thorns", thornsBefore - stats.thorns, events, state);
  if (state)
    for (const effect of returned)
      yield* returnCleansedEffect(
        state,
        unit,
        effect.status,
        effect.amount,
        effect.sourceId,
        events,
        effect.turns,
      );
  if (state) yield* reaction("triggerArmorBreak", state, depletion, events);
  // Typed wards share feedback labels but spend separate Purge categories;
  // Cleanse still coalesces active control with buildup of the same status
  return kind === "purge" ? removedStatuses.length : new Set(removedStatuses).size;
}
export function* cleanseRewards(
  state: GameState,
  unit: Combatant,
  cleansed: number,
  events: GameEvent[],
  freezeBuildupRemoved = false,
): Resolution<void> {
  const stats = ensureCombat(unit);
  if (freezeBuildupRemoved && unit.health > 0) {
    const allied = !isEnemy(unit);
    const row = battlefield(state, allied ? "player" : "enemy");
    const healing = row.some((ally) => ally.id === unit.id)
      ? row.reduce(
          (total, ally) =>
            total +
            (ally.health > 0
              ? creaturePassive(allied ? state : undefined, ally.species).effects.reduce(
                  (sum, effect) => sum + (effect.kind === "sunthaw" ? effect.amount : 0),
                  0,
                )
              : 0),
          0,
        )
      : 0;
    if (healing) yield* reaction("restoreHealth", unit, healing, events, false, state);
  }
  if (!isEnemy(unit)) {
    if (hasTalent(state, "light.divine-favor")) stats[talentRule("light.divine-favor").state] = true;
    const healing =
      Number(hasTalent(state, "health.renewal")) * talentRule("health.renewal").amount +
      (state.boons.includes("sin-eaters-lantern") ? boonRule("sin-eaters-lantern").healing : 0);
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
  options: { leech?: boolean; reflected?: boolean; blocked?: boolean; controlTurns?: number } = {},
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
  const stats = ensureCombat(target);
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target);
  let appliedControl = false;
  const depletions: ArmorDepletion[] = [];
  const immune =
    (type === "stun" || type === "freeze") &&
    (stats.controlled ||
      stats.skipped ||
      stats.cooldown > 0 ||
      (type === "stun" &&
        alliedTarget &&
        (target.block > 0 || options.blocked) &&
        hasTalent(state, "block.grounding")));
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
    const enemies = battlefield(state, alliedTarget ? "enemy" : "player").filter((unit) => unit.health > 0);
    const chance = creaturePassive(alliedTarget ? state : undefined, target.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "statusReflection" ? effect.amount : 0),
      0,
    );
    const burnReflection = type === "burn" && stats.reflectBurn;
    if (
      enemies.length &&
      (burnReflection || stats.reflect || succeeds(state, chance / 100, !alliedTarget, events))
    ) {
      const recipient =
        enemies[Math.floor(roll(state, { kind: "index", size: enemies.length }) * enemies.length)]!;
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
    stats.statusSources.blind = source.id;
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
    const gained = addPeriodicStacks(stats, type, damage, source.id);
    if (type === "bleed" && options.leech) deferLeech(stats, source.id, gained);
    events.push({
      kind: "status",
      targetId: target.id,
      status: type,
      outcome: "gain",
      amount: gained,
      text: `${unitName(target)} gains ${gained} ${type}.`,
    });
  }
  if ((type === "stun" || type === "freeze") && target.health > 0 && immune)
    events.push({
      kind: "status",
      targetId: target.id,
      status: type,
      outcome: "immune",
      text: `${unitName(target)} is immune to ${type} buildup.`,
    });
  if ((type === "stun" || type === "freeze") && source.health > 0 && target.health > 0 && !immune) {
    const beforeStacks = stats[type];
    stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
    if (stats[type] > beforeStacks) stats.statusSources[type] = source.id;
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
        ? 0.5 -
          (type === "freeze"
            ? talentRule("freeze.bitter-cold").percent
            : talentRule("stun.concussive-force").percent) /
            100
        : 0.5);
    let reachesThreshold = stats[type] >= threshold;
    if (alliedSource && !alliedTarget && state.boons.includes("undertow-castanets")) {
      const other = type === "stun" ? "freeze" : "stun";
      const otherThreshold =
        maximumHealth(target) *
        (0.5 -
          (other === "freeze" && hasTalent(state, "freeze.bitter-cold")
            ? talentRule("freeze.bitter-cold").percent
            : other === "stun" && hasTalent(state, "stun.concussive-force")
              ? talentRule("stun.concussive-force").percent
              : 0) /
            100);
      reachesThreshold = stats[type] / threshold + stats[other] / otherThreshold >= 1;
    }
    if (reachesThreshold) {
      const turns =
        type === "stun" && alliedSource && hasTalent(state, "stun.extended-stun")
          ? 1 + talentRule("stun.extended-stun").amount
          : type === "freeze" && alliedSource && !alliedTarget && state.boons.includes("frozen-pocketwatch")
            ? 1 + boonRule("frozen-pocketwatch").turns
            : 1;
      enterControl(stats, type, options.controlTurns ?? turns);
      if (alliedSource && !alliedTarget && state.boons.includes("undertow-castanets")) {
        const other = type === "stun" ? "freeze" : "stun";
        clearHarmfulStatus(stats, other);
      }
      appliedControl = true;
      if (alliedSource && !alliedTarget) {
        if (type === "freeze" && hasTalent(state, "freeze.icebound")) target.block = 0;
        if (type === "freeze" && hasTalent(state, "freeze.brittle-armor")) {
          const { depletion } = removeArmor(target, stats.armor);
          if (depletion) depletions.push(depletion);
        }
        if (type === "stun" && hasTalent(state, "stun.free-follow-up"))
          ensureCombat(source)[talentRule("stun.free-follow-up").state] = true;
        if (type === "stun" && hasTalent(state, "stun.stun-insight")) draw(state, 1, events);
        if (type === "stun" && hasTalent(state, "stun.stun-surge") && state.battle?.mana === 0)
          yield* reaction("gainMana", state, talentRule("stun.stun-surge").amount, events);
        if (type === "freeze" && hasTalent(state, "freeze.glacial-barrier"))
          yield* reaction("grantBlock", state, source, talentRule("freeze.glacial-barrier").amount, events);
        if (type === "stun" && hasTalent(state, "stun.guarded-counter") && source.block === 0)
          yield* reaction("grantBlock", state, source, talentRule("stun.guarded-counter").amount, events);
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
  if (!isEnemy(source) && isEnemy(target)) {
    if (type === "freeze" && state.boons.includes("icy-heart"))
      yield* reaction("hit", state, source, target, boonRule("icy-heart").damage, "physical", events, {
        origin: "derived",
      });
    if (type === "stun" && state.boons.includes("thunderstone"))
      yield* reaction("hit", state, source, target, boonRule("thunderstone").damage, "nature", events, {
        origin: "derived",
      });
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

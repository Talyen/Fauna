import { packetPolicy, type DamagePacket, type AttackPacket } from "./combat-policy";
import { roll } from "./random";
import { draw, drawKeyword } from "./card-zones";
import { hasTalent, creaturePassive } from "./progression";
import { physicalBonus } from "./rules";
import type { DamageType } from "./content";
import type { GameEvent, GameState } from "./types";
import {
  combat,
  maximumHealth,
  unitName,
  mostInjured,
  loseHealth,
  deferLeech,
  harmfulStatuses,
  dodgeChance,
  beginAttack,
  STACK_LIMIT,
  removeArmor,
  gainGold,
  type ArmorDepletion,
  type Combatant,
} from "./combat-state";

type HitResult = { outcome: "ignored" | "miss" } | { outcome: "landed"; lost: number };

interface StatusResult {
  depletions: ArmorDepletion[];
  appliedControl: boolean;
  suppressed: boolean;
}
const handlers = {
  bounce,
  restoreHealth,
  shareProtection,
  grantBlock,
  gainMana,
  grantArmor,
  leechHealth,
  healthThresholds,
  grantStatus,
  triggerArmorBreak,
  removeFreezeBuildup,
  removeEffects,
  cleanseRewards,
  applyHarmfulStatus,
  controlRewards,
  applyBlind,
  hit,
  resolveHit,
  tickStatuses,
  startAction,
};
type Operations = typeof handlers;
type OperationName = keyof Operations;
export type CombatArguments<K extends OperationName> = Parameters<Operations[K]>;
type CombatResult<K extends OperationName> =
  ReturnType<Operations[K]> extends Generator<unknown, infer R, unknown> ? R : never;
type CombatOperation = { [K in OperationName]: { kind: K; args: CombatArguments<K> } }[OperationName];
type Resolution<R = void> = Generator<CombatOperation, R, unknown>;

/** Yield one child to the explicit stack, retaining typed results in the suspended parent. */
function* reaction<K extends OperationName>(
  kind: K,
  ...args: CombatArguments<K>
): Resolution<CombatResult<K>> {
  return (yield { kind, args } as CombatOperation) as CombatResult<K>;
}
function frame(operation: CombatOperation): Resolution<unknown> {
  // The discriminated request ties each argument tuple to this closed handler registry.
  // Erase that correlation only at invocation; callers retain the typed request/result pair.
  const handler = handlers[operation.kind] as (...args: unknown[]) => Resolution<unknown>;
  return handler(...operation.args);
}
/** Each root owns its stack and draft arguments; no global current resolver or saved continuation. */
export function resolveCombat<K extends OperationName>(
  kind: K,
  ...args: CombatArguments<K>
): CombatResult<K> {
  const stack: Resolution<unknown>[] = [frame({ kind, args } as CombatOperation)];
  let result: unknown;
  while (stack.length) {
    const step = stack[stack.length - 1]!.next(result);
    result = undefined;
    if (step.done) {
      stack.pop();
      result = step.value;
    } else stack.push(frame(step.value));
  }
  return result as CombatResult<K>;
}
function* bounce(
  state: GameState,
  source: Combatant,
  first: Combatant,
  action:
    | { effect: "heal"; amount: number; events: GameEvent[]; cardHealing: boolean }
    | { effect: "light"; amount: number; events: GameEvent[]; packet: AttackPacket },
): Resolution<void> {
  if (!state.battle) return;
  const { effect } = action;
  const allied = !("maxHealth" in source);
  const pool =
    effect === "heal"
      ? allied
        ? state.team
        : state.battle.enemies
      : allied
        ? state.battle.enemies
        : state.team;
  const visited = new Set([first.id]);
  for (const entry of creaturePassive(allied ? state : undefined, source.species).effects) {
    if (entry.kind !== "bounce" || entry.effect !== effect) continue;
    for (let i = 0; i < entry.amount; i++) {
      const eligible = pool.filter(
        (unit) =>
          unit.health > 0 &&
          !visited.has(unit.id) &&
          (effect !== "heal" || unit.health < maximumHealth(unit)),
      );
      if (source.health <= 0 || !eligible.length) return;
      if (entry.chance !== undefined && roll(state) >= entry.chance) return;
      const target =
        effect === "heal" ? mostInjured(eligible)! : eligible[Math.floor(roll(state) * eligible.length)]!;
      visited.add(target.id);
      if (action.effect === "heal")
        yield* reaction(
          "restoreHealth",
          target,
          action.amount,
          action.events,
          false,
          state,
          action.cardHealing,
        );
      else
        yield* reaction("hit", state, source, target, action.amount, "light", action.events, {
          ...action.packet,
          delivery: "bounce",
        });
    }
  }
}
function* restoreHealth(
  unit: Combatant,
  amount: number,
  events: GameEvent[],
  revive = false,
  state?: GameState,
  cardHealing = false,
  source?: Combatant,
): Resolution<void> {
  const baseAmount = amount;
  if (state?.phase === "battle") {
    if (!("maxHealth" in unit) && hasTalent(state, "health.mending")) amount *= 1.1;
    if ("maxHealth" in unit && unit.combat.poison > 0 && hasTalent(state, "poison.necrosis")) amount *= 0.5;
    if ("maxHealth" in unit && unit.combat.bleed > 0 && hasTalent(state, "bleed.mortal-wound")) amount *= 0.5;
  }
  if (unit.health === 0 && !revive) return;
  const gain = Math.min(Math.max(0, Math.round(amount)), maximumHealth(unit) - unit.health);
  const excess = Math.max(0, Math.round(amount) - gain);
  unit.health += gain;
  if (cardHealing && state && !("maxHealth" in unit) && excess > 0) {
    if (hasTalent(state, "health.overflow"))
      yield* reaction("grantBlock", state, unit, Math.round(excess * 0.25), events);
    if (hasTalent(state, "health.clean-slate"))
      yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
  }
  if (gain || amount > 0) {
    events.push({
      kind: "heal",
      targetId: unit.id,
      amount: gain,
      text: `${unitName(unit)} restores ${gain} Health.`,
    });
    if (
      gain > 0 &&
      state?.phase === "battle" &&
      !("maxHealth" in unit) &&
      state.boons.includes("groves-favor")
    )
      yield* reaction("grantStatus", unit, "thorns", 1, events, state);
  }
  if (gain > 0 && source && state?.phase === "battle")
    yield* reaction("bounce", state, source, unit, {
      effect: "heal",
      amount: baseAmount,
      events,
      cardHealing,
    });
}
function* shareProtection(
  state: GameState,
  source: Combatant,
  effect: "block" | "thorns" | "waterThorns",
  amount: number,
  events: GameEvent[],
): Resolution<void> {
  if (state.phase !== "battle" || !state.battle || source.health <= 0 || amount <= 0) return;
  const allied = !("maxHealth" in source);
  const pool = allied ? state.team : state.battle.enemies;
  if (!pool.some((unit) => unit.id === source.id)) return;
  const recipients = pool.filter((unit) => unit.id !== source.id && unit.health > 0);
  if (!recipients.length) return;
  const chance = creaturePassive(allied ? state : undefined, source.species).effects.reduce(
    (total, entry) => total + (entry.kind === "shareProtection" ? entry.amount : 0),
    0,
  );
  if (chance <= 0 || (chance < 100 && roll(state) >= chance / 100)) return;
  for (const recipient of recipients) {
    if (effect === "block") yield* reaction("grantBlock", state, recipient, amount, events, false);
    else yield* reaction("grantStatus", recipient, effect, amount, events, state, false);
  }
}
function* grantBlock(
  state: GameState,
  unit: Combatant,
  amount: number,
  events: GameEvent[],
  sharing = true,
): Resolution<void> {
  if (unit.health <= 0 || amount <= 0) return;
  let gained = Math.min(STACK_LIMIT - unit.block, Math.round(amount));
  if (gained > 0 && state.phase === "battle" && state.battle) {
    const allied = !("maxHealth" in unit);
    const pool = allied ? state.team : state.battle.enemies;
    if (pool.some((recipient) => recipient.id === unit.id)) {
      const percent = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
        (sum, effect) => sum + (effect.kind === "blockConversion" ? effect.amount : 0),
        0,
      );
      const recipient = percent > 0 ? mostInjured<Combatant>(pool) : undefined;
      if (recipient) {
        const converted = Math.min(
          Math.round((gained * percent) / 100),
          maximumHealth(recipient) - recipient.health,
        );
        gained -= converted;
        if (converted > 0) yield* reaction("restoreHealth", recipient, converted, events, false, state);
      }
    }
  }
  if (!gained) return;
  unit.block += gained;
  events.push({
    kind: "block",
    targetId: unit.id,
    amount: gained,
    text: `${unitName(unit)} gains ${gained} Block.`,
  });
  if (!("maxHealth" in unit) && hasTalent(state, "light.radiant-guard") && roll(state) < 0.1)
    drawKeyword(state, "light");
  if (!("maxHealth" in unit) && state.boons.includes("ironwood-buckler"))
    yield* reaction("grantStatus", unit, "thorns", 1, events, state, sharing);
  if (sharing) yield* reaction("shareProtection", state, unit, "block", gained, events);
}
function* gainMana(state: GameState, amount: number, events: GameEvent[]): Resolution<void> {
  if (!state.battle || amount <= 0) return;
  const gained = Math.min(amount, state.battle.maxMana - state.battle.mana);
  state.battle.mana += gained;
  if (gained > 0) {
    events.push({ kind: "status", amount: gained, text: `Gain ${gained} Mana.` });
    if (hasTalent(state, "mana.arcane-mending"))
      for (const unit of state.team) yield* reaction("restoreHealth", unit, gained, events, false, state);
  }
}
function* grantArmor(
  state: GameState,
  unit: Combatant,
  amount: number,
  events: GameEvent[],
): Resolution<void> {
  if (unit.health <= 0 || amount <= 0) return;
  const allied = !("maxHealth" in unit),
    before = combat(unit).armor;
  if (allied) {
    if (hasTalent(state, "armor.last-stand") && unit.health < maximumHealth(unit) / 2) amount *= 1.25;
    if (hasTalent(state, "armor.reinforced") && roll(state) < 0.1) amount *= 2;
  }
  yield* reaction("grantStatus", unit, "armor", Math.round(amount), events, state);
  if (allied && combat(unit).armor > before && hasTalent(state, "armor.purification") && roll(state) < 0.1)
    yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
}
function* leechHealth(
  state: GameState,
  unit: Combatant,
  lost: number,
  events: GameEvent[],
  afflicted = false,
): Resolution<void> {
  if (lost <= 0) return;
  let amount = Math.round(lost / 2);
  if (!("maxHealth" in unit)) {
    if (afflicted && hasTalent(state, "leech.affliction-siphon")) amount *= 1.1;
    if (hasTalent(state, "leech.deep-siphon")) amount++;
    if (hasTalent(state, "leech.desperate-siphon") && unit.health < maximumHealth(unit) / 2) amount *= 2;
  }
  const before = unit.health;
  yield* reaction("restoreHealth", unit, amount, events, false, state);
  const restored = unit.health - before;
  if (!("maxHealth" in unit) && restored > 0) {
    if (hasTalent(state, "leech.blood-debt") && roll(state) < 0.1) gainGold(state, restored, events);
    if (
      hasTalent(state, "leech.sanguine-overflow") &&
      before < maximumHealth(unit) &&
      unit.health === maximumHealth(unit)
    )
      yield* reaction("gainMana", state, 1, events);
    if (hasTalent(state, "leech.bloodletting") && roll(state) < 0.1)
      yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
    if (hasTalent(state, "leech.mana-siphon") && roll(state) < 0.1)
      yield* reaction("gainMana", state, 1, events);
  }
}
function* healthThresholds(
  state: GameState,
  unit: Combatant,
  before: number,
  events: GameEvent[],
): Resolution<void> {
  const stats = combat(unit);
  if (!("maxHealth" in unit) && unit.health > 0) {
    if (before >= maximumHealth(unit) / 2 && unit.health < maximumHealth(unit) / 2) {
      if (hasTalent(state, "armor.steadfast")) yield* reaction("grantArmor", state, unit, 3, events);
      if (hasTalent(state, "health.desperate-guard") && !stats.desperateGuardUsed) {
        stats.desperateGuardUsed = true;
        yield* reaction("grantBlock", state, unit, 6, events);
      }
    }
    if (
      before >= maximumHealth(unit) / 4 &&
      unit.health < maximumHealth(unit) / 4 &&
      hasTalent(state, "health.last-resort")
    )
      yield* reaction("removeEffects", unit, "cleanse", 6, events, state);
  }
}
function* grantStatus(
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
function* triggerArmorBreak(
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
function* removeFreezeBuildup(state: GameState, unit: Combatant, events: GameEvent[]): Resolution<void> {
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
function* removeEffects(
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
function* cleanseRewards(
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
function* applyHarmfulStatus(
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
function* controlRewards(
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
function* applyBlind(
  state: GameState,
  source: Combatant,
  target: Combatant,
  events: GameEvent[],
): Resolution<void> {
  yield* reaction("applyHarmfulStatus", state, source, target, 1, "blind", events);
}
function* hit(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  events: GameEvent[],
  options: DamagePacket = { origin: "ability" },
): Resolution<number | undefined> {
  const policy = packetPolicy(options);
  const wrongFoot =
    target.combat?.blind && policy.wrongFoot
      ? creaturePassive("maxHealth" in source ? undefined : state, source.species).effects.reduce(
          (total, effect) => total + (effect.kind === "wrongFoot" ? effect.amount : 0),
          0,
        )
      : 0;
  const result = yield* reaction("resolveHit", state, source, target, value, type, events, options);
  const lost = result.outcome === "landed" ? result.lost : undefined;
  if (lost !== undefined && wrongFoot > 0)
    yield* reaction("hit", state, source, target, wrongFoot, "light", events, { origin: "proc" });
  if (
    lost !== undefined &&
    lost > 0 &&
    type === "stun" &&
    source.health > 0 &&
    target.health > 0 &&
    policy.resonance
  ) {
    const chance = creaturePassive("maxHealth" in source ? undefined : state, source.species).effects.reduce(
      (total, effect) => total + (effect.kind === "resonance" ? effect.amount : 0),
      0,
    );
    if (chance > 0 && roll(state) < chance / 100) {
      events.push({
        kind: "action",
        actionType: "support",
        actorId: source.id,
        targetId: target.id,
        text: `${unitName(source)} repeats Stun damage with Resonance`,
      });
      // Repeat the packet once, retaining Stun buildup but suppressing attack proc chains.
      yield* reaction("hit", state, source, target, value, type, events, { ...options, origin: "resonance" });
    }
  }
  if (
    lost !== undefined &&
    type === "light" &&
    policy.bounce &&
    (options.origin === "ability" || options.origin === "proc" || options.origin === "resonance")
  )
    yield* reaction("bounce", state, source, target, {
      effect: "light",
      amount: value,
      events,
      packet: options,
    });
  return lost;
}
function* resolveHit(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  events: GameEvent[],
  options: DamagePacket = { origin: "ability" },
): Resolution<HitResult> {
  const policy = packetPolicy(options);
  if ((source.health <= 0 && !policy.deadSource) || target.health <= 0 || value <= 0)
    return { outcome: "ignored" };
  const { attack, direct } = policy;
  const leech = "leech" in options && options.leech;
  const cardLeech = "cardLeech" in options && options.cardLeech;
  const alliedSource = !("maxHealth" in source),
    alliedTarget = !("maxHealth" in target);
  const stats = combat(target),
    before = target.health;
  const depletions: ArmorDepletion[] = [];
  const erode = (amount: number) => {
    const { depletion } = removeArmor(target, amount);
    if (depletion) depletions.push(depletion);
  };
  const blessedLeech =
    alliedSource &&
    type === "light" &&
    hasTalent(state, "light.blessed-leech") &&
    source.health < maximumHealth(source) / 2;
  const blindMiss =
    direct && ((options.origin === "ability" ? options.blindMiss : undefined) ?? beginAttack(state, source));
  if (
    direct &&
    (blindMiss || (dodgeChance(state, target) > 0 && roll(state) < dodgeChance(state, target) / 100))
  ) {
    events.push({
      kind: "status",
      targetId: target.id,
      status: "dodge",
      outcome: "dodge",
      text: `${unitName(target)} Dodges.`,
    });
    if (alliedTarget && hasTalent(state, "dodge.catch-breath"))
      yield* reaction("restoreHealth", target, 1, events, false, state);
    if (alliedTarget) {
      stats.rhythm = 0;
      if (hasTalent(state, "dodge.thornstep"))
        yield* reaction("grantStatus", target, "thorns", 1, events, state);
      if (hasTalent(state, "dodge.clean-getaway")) {
        for (const status of ["burn", "poison", "bleed"] as const) {
          stats[status] = Math.max(0, stats[status] - 1);
          if (status === "bleed" && stats.bleedLeech.length) {
            const payout = stats.bleedLeech[0]!;
            payout.amount--;
            if (!payout.amount) stats.bleedLeech.shift();
          }
          if (!stats[status]) {
            delete stats.statusSources[status];
            if (status === "bleed") stats.bleedLeech = [];
          }
        }
      }
      if (hasTalent(state, "dodge.open-flank")) stats.nextPhysical = 2;
      if (hasTalent(state, "dodge.unburdened")) {
        stats.stun = 0;
        stats.freeze = 0;
      }
      if (hasTalent(state, "dodge.tailwind")) draw(state, 1);
      if (hasTalent(state, "dodge.perfect-timing") && stats.armor === 0)
        yield* reaction("grantArmor", state, target, 2, events);
      if (hasTalent(state, "block.footwork")) yield* reaction("grantBlock", state, target, 2, events);
      if (hasTalent(state, "bleed.parting-cut")) stats.partingCut = true;
      if (hasTalent(state, "physical.riposte")) stats.riposte = true;
      if (hasTalent(state, "nature.windstep")) stats.freeNature = true;
      if (hasTalent(state, "burn.smoke-screen") && combat(source).burn > 0)
        yield* reaction("hit", state, target, source, 2, "burn", events, { origin: "proc" });
    }
    const cinderstep = creaturePassive(alliedTarget ? state : undefined, target.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "dodgeBurn" ? effect.amount : 0),
      0,
    );
    if (cinderstep)
      yield* reaction("hit", state, target, source, cinderstep, "burn", events, {
        origin: "statusRetaliation",
      });
    if (alliedTarget) state.battleXP.dodge = Math.min(STACK_LIMIT, (state.battleXP.dodge ?? 0) + 1);
    return { outcome: "miss" };
  }
  if (type === "freeze" && stats.nullifyFreeze) {
    stats.nullifyFreeze = false;
    events.push({
      kind: "status",
      targetId: target.id,
      status: "nullify",
      outcome: "immune",
      affectedStatus: "freeze",
      text: `${unitName(target)} nullifies Freeze damage`,
    });
    return { outcome: "landed", lost: 0 };
  }
  const nextPhysical = direct && alliedSource ? combat(source).nextPhysical : 0;
  if (nextPhysical) combat(source).nextPhysical = 0;
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
    if (type === "water") {
      if (hasTalent(state, "water.pressure")) damage += 1;
      if (source.block > 0 && hasTalent(state, "water.high-tide")) damage *= 1.25;
    }
    if (type === "physical") damage += physicalBonus(source, state);
    if (type === "physical" && hasTalent(state, "block.weighted-guard")) damage += source.block * 0.1;
    if (type === "light" && hasTalent(state, "block.sacred-shield")) damage += source.block * 0.1;
    if (type === "stun" && hasTalent(state, "block.impact-guard")) damage += source.block * 0.1;
    if (
      type === "physical" &&
      target.health < maximumHealth(target) / 4 &&
      hasTalent(state, "physical.finish-him")
    )
      damage *= 2;
    if (
      type === "physical" &&
      source.health < maximumHealth(source) / 2 &&
      hasTalent(state, "physical.unrelenting")
    )
      damage *= 2;
    if (
      type === "bleed" &&
      source.health < maximumHealth(source) / 2 &&
      hasTalent(state, "bleed.bleeding-out")
    )
      damage *= 1.25;
    if (type === "burn" && hasTalent(state, "mana.manaburn")) damage += (state.battle?.mana ?? 0) * 0.25;
    if (type === "freeze" && hasTalent(state, "mana.arcane-frost"))
      damage += (state.battle?.mana ?? 0) * 0.25;
    if (type === "light" && hasTalent(state, "light.prosperity")) damage += state.currency * 0.01;
    if (type === "light" && stats.burn > 0 && hasTalent(state, "light.purge")) damage *= 1.1;
    if (cardLeech && target.health < maximumHealth(target) / 2 && hasTalent(state, "leech.cull-the-weak"))
      damage *= 1.25;
    if (type === "bleed" && stats.bleed === 0 && hasTalent(state, "bleed.first-blood")) damage *= 1.25;
  }
  if (
    alliedSource &&
    !alliedTarget &&
    options.origin !== "retaliation" &&
    options.origin !== "statusRetaliation"
  ) {
    if (stats.poison > 0 && hasTalent(state, "poison.corrosive")) damage++;
    if (stats.controlled === "freeze" && hasTalent(state, "freeze.brittle-ice")) damage++;
    if (stats.controlled === "stun" && hasTalent(state, "stun.exploit-weakness")) damage *= 2;
    if (type === "poison" && stats.bleed > 0 && hasTalent(state, "bleed.septic-shock")) damage *= 1.1;
  }
  if (alliedTarget) {
    if (
      (type === "burn" && hasTalent(state, "burn.fire-resistance")) ||
      (type === "poison" && hasTalent(state, "poison.toxin-resistance")) ||
      (type === "bleed" && hasTalent(state, "bleed.wound-care")) ||
      (type === "freeze" && hasTalent(state, "freeze.cold-resistance")) ||
      (type === "light" && hasTalent(state, "light.celestial-ward"))
    )
      damage *= 0.5;
    if (
      target.block > 0 &&
      ((type === "bleed" && hasTalent(state, "block.blood-ward")) ||
        (type === "poison" && hasTalent(state, "block.venom-ward")))
    )
      damage *= 0.5;
  }
  if (type === "burn" || type === "freeze") {
    const protectors = alliedTarget ? state.team : (state.battle?.enemies ?? []);
    // Use the strongest deployed protection; swaps and knockouts change it immediately.
    const resistance = protectors.reduce((best, unit) => {
      if (unit.health <= 0) return best;
      return Math.max(
        best,
        ...creaturePassive(alliedTarget ? state : undefined, unit.species).effects.map((effect) =>
          effect.kind === (type === "burn" ? "teamBurnResistance" : "teamFreezeResistance")
            ? effect.amount
            : 0,
        ),
      );
    }, 0);
    if (protectors.some((unit) => unit.id === target.id)) damage *= 1 - Math.min(100, resistance) / 100;
  }
  damage = Math.round(damage);
  const riposte = direct && alliedSource && type === "physical" && combat(source).riposte;
  const criticalChance =
    0.05 + ((options.origin === "ability" ? options.criticalBonus : undefined) ?? 0) / 100;
  const critical =
    direct && (riposte || (criticalChance > 0 && (criticalChance >= 1 || roll(state) < criticalChance)));
  if (riposte) combat(source).riposte = false;
  const partingCut = direct && alliedSource && type === "physical" && combat(source).partingCut;
  if (partingCut) combat(source).partingCut = false;
  if (critical) damage *= 2;
  const blockRatio = alliedTarget && type === "physical" && hasTalent(state, "block.reinforce") ? 1.1 : 1;
  const blocked = policy.bypassBlock ? 0 : Math.min(Math.round(target.block * blockRatio), damage);
  const blockSpent = Math.min(target.block, Math.ceil(blocked / blockRatio));
  target.block -= blockSpent;
  const depletedBlock = blocked > 0 && target.block === 0;
  damage -= blocked;
  if (
    attack &&
    alliedSource &&
    !alliedTarget &&
    state.boons.includes("sundering-charm") &&
    (type === "physical" || type === "stun")
  )
    erode(2);
  if (
    type === "physical" ||
    type === "stun" ||
    (alliedTarget &&
      ((type === "burn" && hasTalent(state, "armor.fireward")) ||
        (type === "bleed" && hasTalent(state, "armor.thick-hide"))))
  )
    damage = Math.max(0, damage - stats.armor);
  const lost = loseHealth(state, target, damage, events);
  if (damage > 0) {
    erode(1);
    if (alliedSource && type === "poison" && hasTalent(state, "poison.caustic")) erode(damage);
    if (alliedSource && type === "burn" && hasTalent(state, "burn.melting-point")) erode(damage);
  }
  if (lost > 0) yield* reaction("healthThresholds", state, target, before, events);
  if (alliedTarget && lost > 0 && hasTalent(state, "dodge.finding-rhythm"))
    stats.rhythm = Math.min(70, stats.rhythm + 5);
  if (alliedTarget && depletedBlock && attack && hasTalent(state, "block.sun-struck-shield"))
    yield* reaction("hit", state, target, source, Math.round(blockSpent * 0.3), "light", events, {
      origin: "derived",
    });
  // Depletion rewards use the original block payment, not any newly granted Block.
  if (alliedTarget && depletedBlock && hasTalent(state, "block.second-wind"))
    yield* reaction("restoreHealth", target, 2, events, false, state);
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
    critical,
    periodic: options.origin === "periodic",
    text: `${unitName(target)} takes ${lost} ${type} damage${critical ? " (Critical)" : ""}.`,
  });
  if (target.health === 0)
    events.push({ kind: "knockout", targetId: target.id, text: `${unitName(target)} is knocked out.` });
  if (
    target.health === 0 &&
    !alliedTarget &&
    alliedSource &&
    stats.poison > 0 &&
    hasTalent(state, "poison.toxic-profit")
  )
    gainGold(state, 3, events);
  if (target.health === 0 && !alliedTarget && alliedSource && state.boons.includes("bone-charm"))
    yield* reaction("restoreHealth", source, 3, events, false, state);
  if (alliedSource && !alliedTarget && lost > 0 && (source.health > 0 || policy.deadSource)) {
    if (type === "bleed" && state.boons.includes("cutpurse-knife")) gainGold(state, 1, events);
    if (type === "poison" && state.boons.includes("parasitic-bloom") && roll(state) < 0.1)
      yield* reaction("leechHealth", state, source, lost, events, true);
    if (attack && type === "nature" && state.boons.includes("lucky-clover") && roll(state) < 0.1)
      gainGold(state, lost, events);
    if (attack && type === "light" && state.boons.includes("brass-censer") && roll(state) < 0.2) {
      if (roll(state) < 0.5)
        yield* reaction("hit", state, source, target, damage, "burn", events, { origin: "proc" });
      else yield* reaction("leechHealth", state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
    }
  }
  if (nextPhysical > 0 && source.health > 0)
    yield* reaction("hit", state, source, target, nextPhysical, "physical", events, { origin: "proc" });
  if (direct && alliedSource && !alliedTarget && source.health > 0 && type === "water") {
    if (hasTalent(state, "water.seafoam")) yield* reaction("grantBlock", state, source, 2, events);
    if (hasTalent(state, "water.erosion")) {
      erode(2);
    }
    if (hasTalent(state, "water.cleansing-current") && roll(state) < 0.2)
      yield* reaction("removeEffects", source, "cleanse", 1, events, state);
    if (hasTalent(state, "water.riptide") && roll(state) < 0.2) drawKeyword(state, "water");
  }
  if (policy.buildup && damage > 0 && source.health > 0) {
    const statusResult = yield* reaction("applyHarmfulStatus", state, source, target, damage, type, events, {
      leech,
    });
    depletions.push(...statusResult.depletions);
    if (direct && alliedSource && !alliedTarget && source.health > 0) {
      if (type === "nature" && hasTalent(state, "nature.bramblegrowth") && roll(state) < 0.1)
        yield* reaction("grantStatus", source, "thorns", damage, events, state);
      if (type === "light" && lost > 0 && hasTalent(state, "light.faith-barrier") && roll(state) < 0.1)
        yield* reaction("grantBlock", state, source, lost, events);
    }
    if (direct && alliedSource && !alliedTarget && source.health > 0) {
      const proc = (id: import("./progression").TalentId, chance: number) =>
        source.health > 0 && hasTalent(state, id) && roll(state) < chance;

      if (type === "physical") {
        if (proc("physical.heavy-blows", 0.1))
          yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
        if (proc("physical.lacerate", 0.1))
          yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
        if (proc("armor.iron-guard", 0.1)) yield* reaction("grantArmor", state, source, damage, events);
        if (partingCut && source.health > 0)
          yield* reaction("hit", state, source, target, Math.round(damage / 2), "bleed", events, {
            origin: "proc",
          });
        if (source.health > 0 && critical && hasTalent(state, "physical.rupture") && stats.bleed > 0) {
          const bleed = stats.bleed;
          const payouts = stats.bleedLeech;
          stats.bleed = 0;
          stats.bleedLeech = [];
          delete stats.statusSources.bleed;
          let remaining =
            (yield* reaction("hit", state, source, target, bleed, "bleed", events, { origin: "periodic" })) ??
            0;
          for (const payout of payouts) {
            const owner = [...state.team, ...state.reserves].find((unit) => unit.id === payout.sourceId);
            const paid = Math.min(remaining, payout.amount);
            if (owner) yield* reaction("leechHealth", state, owner, paid, events, true);
            remaining -= paid;
          }
        }
      }
      if (type === "nature") {
        if (proc("nature.thornskin", 0.1)) yield* reaction("grantArmor", state, source, damage, events);
        if (proc("nature.photosynthesis", 0.1))
          yield* reaction("restoreHealth", source, damage, events, false, state);
        if (proc("nature.briar-patch", 0.1))
          yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
        if (proc("nature.toxic-pollen", 0.1))
          yield* reaction("hit", state, source, target, damage, "poison", events, { origin: "proc" });
        if (proc("nature.entangle", 0.1))
          yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
      }
      if (type === "burn" && proc("burn.heat-exhaustion", 0.1))
        yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
      if (type === "poison") {
        if (proc("poison.hemotoxin", 0.1))
          yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
        if (proc("poison.paralytic-venom", 0.1))
          yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
      }
      if (type === "bleed") {
        if (proc("bleed.flay", 0.2)) erode(stats.armor - Math.round(stats.armor / 2));
        if (proc("bleed.tainted-wound", 0.1))
          yield* reaction("hit", state, source, target, Math.round(damage / 2), "poison", events, {
            origin: "proc",
          });
        if (proc("bleed.bloodrush", 0.1)) draw(state, 1);
      }
      if (type === "light") {
        if (proc("light.scorching-light", 0.1))
          yield* reaction("hit", state, source, target, damage, "burn", events, { origin: "proc" });
        if (lost > 0 && proc("light.tithe", 0.1)) gainGold(state, lost, events);
      }
      const chanceLeech =
        (type === "bleed" && proc("bleed.sanguine", 0.1)) ||
        (type === "poison" && proc("leech.virulent-leech", 0.1)) ||
        (type === "nature" && proc("nature.verdant-cycle", 0.1));
      if (chanceLeech && type === "bleed" && !leech) {
        if (!statusResult.suppressed) deferLeech(target, source, damage);
      } else if (chanceLeech && !leech && !blessedLeech)
        yield* reaction("leechHealth", state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
    }
    // Captured damage remains valid even if retaliation later removes the attacker.
    if (direct && lost > 0 && target.health > 0) {
      for (const [status, type] of [
        ["thorns", "nature"],
        ["waterThorns", "water"],
      ] as const) {
        const reflected = stats[status];
        if (reflected <= 0) continue;
        stats[status]--;
        yield* reaction("hit", state, target, source, reflected, type, events, { origin: "retaliation" });
      }
    }
    if ((leech || blessedLeech) && type !== "bleed" && source.health > 0)
      yield* reaction("leechHealth", state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
    if (statusResult.appliedControl && source.health > 0)
      yield* reaction("controlRewards", state, source, target, type, events);
  }
  if (direct && target.health > 0 && source.health > 0) {
    const amount = creaturePassive(alliedTarget ? state : undefined, target.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "poisonRetaliation" ? effect.amount : 0),
      0,
    );
    if (amount > 0)
      yield* reaction("hit", state, target, source, amount, "poison", events, {
        origin: "statusRetaliation",
      });
  }
  // Only direct attacks burst the bubble; derived damage cannot start retaliation chains
  if (direct && depletedBlock && target.health > 0 && source.health > 0) {
    const amount = creaturePassive(alliedTarget ? state : undefined, target.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "blockBreak" ? effect.amount : 0),
      0,
    );
    if (amount > 0)
      yield* reaction("hit", state, target, source, amount, "water", events, { origin: "retaliation" });
  }
  for (const depletion of depletions) yield* reaction("triggerArmorBreak", state, depletion, events);
  return { outcome: "landed", lost };
}
function* tickStatuses(state: GameState, unit: Combatant, events: GameEvent[]): Resolution<void> {
  const stats = combat(unit);
  if (
    !("maxHealth" in unit) &&
    unit.health > 0 &&
    stats.poison > 0 &&
    state.boons.includes("plague-doctors-mask")
  ) {
    const removed = Math.min(2, stats.poison);
    stats.poison -= removed;
    events.push({
      kind: "status",
      targetId: unit.id,
      amount: -removed,
      status: "cleanse",
      affectedStatus: "poison",
      outcome: "remove",
      text: `${unitName(unit)} Cleanses ${removed} Poison.`,
    });
    if (stats.poison === 0) {
      delete stats.statusSources.poison;
      yield* reaction("cleanseRewards", state, unit, 1, events);
    }
    const target = state.battle!.enemies.find((enemy) => enemy.health > 0);
    if (target)
      yield* reaction("hit", state, unit, target, Math.round(removed / 2), "poison", events, {
        origin: "proc",
      });
    if (state.battle!.enemies.every((enemy) => enemy.health <= 0)) return;
  }
  for (const status of ["burn", "poison", "bleed"] as const) {
    if (unit.health <= 0) break;
    const amount = stats[status];
    if (amount <= 0) continue;
    // Ticks bypass Block and do not reapply their own buildup.
    const source =
      [...state.team, ...state.reserves, ...state.battle!.enemies].find(
        (candidate) => candidate.id === stats.statusSources[status],
      ) ?? unit;
    // Cleanse reactions may remove the wound, but cannot revoke healing earned by this tick.
    const payouts = status === "bleed" ? stats.bleedLeech : [];
    const lost =
      (yield* reaction("hit", state, source, unit, amount, status, events, { origin: "periodic" })) ?? 0;
    if (status === "bleed") {
      stats.bleedLeech = [];
      let remaining = lost;
      for (const payout of payouts) {
        const owner = [...state.team, ...state.reserves, ...state.battle!.enemies].find(
          (candidate) => candidate.id === payout.sourceId,
        );
        const paid = Math.min(remaining, payout.amount);
        if (owner) yield* reaction("leechHealth", state, owner, paid, events, true);
        remaining -= paid;
      }
    }
    // Threshold reactions can Cleanse the ticking status; decay must not restore it.
    if (stats[status] === 0) continue;
    stats[status] =
      status === "bleed"
        ? 0
        : status === "burn"
          ? amount <= 1
            ? 0
            : Math.round(amount / 2)
          : Math.max(0, amount - Math.max(1, Math.round(amount * 0.2)));
    if ("maxHealth" in unit && !("maxHealth" in source)) {
      if (status === "burn" && hasTalent(state, "burn.smoldering") && roll(state) < 0.1) stats.burn = amount;
      if (status === "poison") {
        if (stats.controlled === "freeze" && hasTalent(state, "freeze.cryo-preservation"))
          stats.poison = amount;
        if (hasTalent(state, "poison.virulent") && roll(state) < 0.1)
          stats.poison = Math.min(STACK_LIMIT, amount + 1);
      }
    }
    if (stats[status] === 0) delete stats.statusSources[status];
  }
}
/** Called once at the start of the owner's turn, including while in reserve. */
function* startAction(unit: Combatant, events: GameEvent[], state?: GameState): Resolution<boolean> {
  const stats = combat(unit);
  stats.temporaryDodge = 0;
  stats.encoreUsed = false;
  stats.cardsPlayedThisTurn = 0;
  stats.firstAttackUsed = false;
  stats.skipped = !!stats.controlled;
  if (state?.phase === "battle" && state.battle && unit.health > 0) {
    const enemy = "maxHealth" in unit;
    const row = enemy ? state.battle.enemies : state.team;
    // The allied turn number advances after startAction; enemies act on the current number
    const turn = state.battle.turn + Number(!enemy);
    if (turn % 2 === 0 && row.some((deployed) => deployed.id === unit.id)) {
      const amount = creaturePassive(enemy ? undefined : state, unit.species).effects.reduce(
        (sum, effect) => sum + (effect.kind === "tidalRegeneration" ? effect.amount : 0),
        0,
      );
      if (amount > 0) yield* reaction("restoreHealth", unit, amount, events, false, state);
    }
  }
  if (stats.controlled) {
    events.push({
      kind: "status",
      targetId: unit.id,
      status: stats.controlled,
      outcome: "skip",
      text: `${unitName(unit)} skips its ${stats.controlled === "freeze" ? "Frozen" : "Stunned"} turn.`,
    });
    stats.controlTurns = Math.max(0, stats.controlTurns - 1);
    if (stats.controlTurns === 0) {
      if (
        stats.controlled === "freeze" &&
        "maxHealth" in unit &&
        state &&
        hasTalent(state, "freeze.thaw-dividend")
      )
        draw(state, 1);
      stats.controlled = null;
      stats.cooldown = 3;
    }
  } else if (stats.cooldown > 0) stats.cooldown--;
  return !stats.skipped;
}

import { emitStatus } from "../events";
import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { chance as succeeds } from "../chance";
import {
  findLivingBattlefield,
  isEnemy,
  battlefield,
  battlefieldView,
  battlefieldHasId,
  livingBattlefield,
  healingAllies,
  cleanseTargets,
  canSpreadCleanse,
  isDepartedMinion,
  combatantById,
} from "../battlefield";
import { roll } from "../random";
import { draw, controlRecoveryDraw } from "../card-zones";
import { hasTalent, passiveAmount } from "../progression";

import type { DamageType } from "../content";
import type { GameEvent, GameState } from "../types";
import {
  ensureCombat,
  sharedControlImmunity,
  maximumHealth,
  mostInjured,
  unitName,
  harmfulStatuses,
  beneficialStatuses,
  STACK_LIMIT,
  removeArmor,
  grantTemporaryDodge,
  dodgeChance,
  hasBeneficialEffects,
  type ArmorDepletion,
  type Combatant,
} from "./state";

import { reaction, type Resolution } from "./operations";
import { applyResolvedStatus } from "./status-reactions";
import { dodgeResponse } from "./damage-reactions";
import {
  enterControl,
  cleanseControl,
  clearHarmfulStatus,
  clearSelectedStatus,
  addPeriodicStacks,
  deferLeech,
} from "./status-state";

interface StatusResult {
  depletions: ArmorDepletion[];
  appliedControl: boolean;
  suppressed: boolean;
}

export function controlThreshold(
  state: GameState,
  source: Combatant,
  target: Combatant,
  type: "stun" | "freeze",
  withTalentReduction = true,
) {
  const health =
    isEnemy(target) && state.boons.includes("crescent-sextant") ? target.health : maximumHealth(target);
  const reduction =
    withTalentReduction && !isEnemy(source)
      ? type === "stun" && hasTalent(state, "stun.concussive-force")
        ? talentRule("stun.concussive-force").percent
        : type === "freeze" && hasTalent(state, "freeze.bitter-cold")
          ? talentRule("freeze.bitter-cold").percent
          : 0
      : 0;
  return health * (0.5 - reduction / 100);
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
  const target = findLivingBattlefield(state, "enemy", (enemy) => enemy.id === sourceId);
  if (!target) return;
  yield* applyResolvedStatus(
    state,
    unit,
    target,
    turns && (status === "stun" || status === "freeze")
      ? Math.ceil(controlThreshold(state, unit, target, status, false))
      : amount,
    status,
    events,
    { reflected: true, controlTurns: turns },
  );
}

export function* grantStatus(
  unit: Combatant,
  status: "armor" | "thorns" | "dodge",
  amount: number,
  events: GameEvent[],
  state?: GameState,
  sharing = true,
  mossball = true,
): Resolution<void> {
  if (unit.health <= 0) return;
  const stats = ensureCombat(unit);
  if (status === "thorns" && isEnemy(unit) && stats.blind && state && state.boons.includes("apiary-smoker"))
    return;
  const before = stats[status];
  stats[status] = Math.min(status === "dodge" ? 70 : STACK_LIMIT, before + amount);
  const gain = stats[status] - before;
  if (gain)
    events.push({
      kind: "status",
      targetId: unit.id,
      amount: gain,
      status,
      outcome: "gain",
      text: `${unitName(unit)} gains ${gain} ${status}.`,
    });
  if (
    gain > 0 &&
    status === "armor" &&
    state?.phase === "battle" &&
    !isEnemy(unit) &&
    state.boons.includes("wishing-building-block")
  ) {
    const allies = battlefield(state, "player");
    if (allies.some((ally) => ally.id === unit.id))
      for (const ally of allies)
        if (ally.id !== unit.id && ally.health > 0 && ensureCombat(ally).armor > 0)
          yield* reaction("grantBlock", state, ally, boonRule("wishing-building-block").block, events);
  }
  if (
    gain > 0 &&
    status === "thorns" &&
    state?.phase === "battle" &&
    !isEnemy(unit) &&
    mossball &&
    state.boons.includes("mossball")
  ) {
    const allies = battlefield(state, "player");
    if (allies.some((ally) => ally.id === unit.id)) {
      let recipient: Combatant | undefined;
      let lowest = Infinity;
      for (const ally of allies) {
        if (ally.id === unit.id || ally.health <= 0) continue;
        const thorns = ensureCombat(ally).thorns;
        if (!recipient || thorns < lowest) {
          recipient = ally;
          lowest = thorns;
        }
      }
      if (recipient)
        yield* reaction(
          "grantStatus",
          recipient,
          "thorns",
          boonRule("mossball").thorns,
          events,
          state,
          true,
          false,
        );
    }
  }
  if (status === "thorns" && state && sharing)
    yield* reaction("shareProtection", state, unit, status, gain, events, mossball);
}
export function* triggerArmorBreak(
  state: GameState,
  depletion: ArmorDepletion | null,
  events: GameEvent[],
): Resolution<void> {
  if (!depletion || depletion.delivered) return;
  depletion.delivered = true;
  const { unit } = depletion;
  if (state.phase !== "battle" || !state.battle) return;
  const allied = !isEnemy(unit);
  if (allied && state.boons.includes("beeswax-crown") && battlefieldHasId(state, "player", unit.id))
    for (const ally of battlefield(state, "player"))
      if (ally.health > 0)
        yield* reaction("grantStatus", ally, "thorns", boonRule("beeswax-crown").thorns, events, state);
  if (unit.health <= 0) return;
  if (allied && hasTalent(state, "armor.reactive-guard"))
    yield* reaction("grantBlock", state, unit, talentRule("armor.reactive-guard").amount, events);
  if (!battlefieldHasId(state, allied ? "player" : "enemy", unit.id)) return;
  if (allied && state.boons.includes("eclipse-rivet"))
    for (const other of battlefield(state, "player"))
      if (other.id !== unit.id && other.health > 0)
        yield* reaction("grantArmor", state, other, boonRule("eclipse-rivet").armor, events);
  const amount = passiveAmount(allied ? state : undefined, unit.species, "armorBreak");
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
  spread = true,
): Resolution<void> {
  if (spread && canSpreadCleanse(state, unit)) {
    const targets = cleanseTargets(state, unit);
    if (targets.length > 1) {
      for (const target of targets) {
        if (unit.health <= 0) break;
        yield* reaction("removeControlBuildup", state, target, status, events, false);
      }
      return;
    }
  }
  const stats = ensureCombat(unit);
  if (stats[status] <= 0) return;
  const amount = stats[status];
  const sourceId = stats.statusSources[status];
  clearSelectedStatus(unit, status);
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
  onlyStatus?: (typeof harmfulStatuses)[number] | (typeof beneficialStatuses)[number] | "block",
  source?: Combatant,
  spread = true,
  linked = false,
  steal = false,
): Resolution<number> {
  if (state && isDepartedMinion(state, unit)) return 0;
  if (kind === "cleanse" && spread && canSpreadCleanse(state, unit)) {
    const targets = cleanseTargets(state, unit);
    if (targets.length > 1) {
      let removed = 0;
      const actor = source ?? unit;
      for (const target of targets) {
        if (actor.health <= 0) break;
        removed += yield* reaction(
          "removeEffects",
          target,
          kind,
          count,
          events,
          state,
          onlyStatus,
          source,
          false,
        );
      }
      return removed;
    }
  }
  const playerPurge = state && kind === "purge" && source && !isEnemy(source) && isEnemy(unit);
  const enemyPurge = state && kind === "purge" && source && isEnemy(source) && !isEnemy(unit);
  const stats = ensureCombat(unit);
  const frozenBefore = stats.controlled === "freeze";
  const thornsBefore = stats.thorns;
  const pearlSieve = state && state.boons.includes("pearl-sieve");
  const moltenPaperweight = state && state.boons.includes("molten-paperweight");
  let purgedArmor = 0;
  let purgedBlock = 0;
  let depletion: ArmorDepletion | null = null;
  let cleansed = 0;
  const hadFreezeBuildup = stats.freeze > 0;
  const removedStatuses: NonNullable<import("../types").StatusEvent["affectedStatus"]>[] = [];
  const purgedKinds: ((typeof beneficialStatuses)[number] | "block")[] = [];
  const stolen: {
    status: (typeof beneficialStatuses)[number] | "block";
    amount: number;
    temporary?: number;
  }[] = [];
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
  const statuses =
    onlyStatus === "block"
      ? []
      : onlyStatus
        ? [onlyStatus]
        : kind === "cleanse"
          ? harmfulStatuses
          : beneficialStatuses;
  if (
    kind === "purge" &&
    state &&
    !isEnemy(unit) &&
    stats.nullify &&
    state.boons.includes("coronation-cloche")
  )
    count = 0;
  if (kind === "purge" && state && !isEnemy(unit) && state.boons.includes("basalt-glass-bookmark")) {
    let remaining = Number(unit.block > 0);
    for (const status of beneficialStatuses)
      if (Number(stats[status]) > 0 || (status === "dodge" && stats.temporaryDodge > 0)) remaining++;
    count = Math.min(count, Math.max(0, remaining - 1));
  }
  if (
    enemyPurge &&
    count > 0 &&
    source.health > 0 &&
    unit.health > 0 &&
    state.boons.includes("vanishing-hat") &&
    !(unit.block > 0 && onlyStatus && onlyStatus !== "block" && state.boons.includes("shelter-lantern")) &&
    (onlyStatus === "block"
      ? unit.block > 0
      : onlyStatus
        ? Number(stats[onlyStatus]) > 0 || (onlyStatus === "dodge" && stats.temporaryDodge > 0)
        : hasBeneficialEffects(unit)) &&
    succeeds(state, dodgeChance(state, unit) / 100, false, events)
  ) {
    yield* dodgeResponse({ state, source, target: unit, type: "physical", events }, false);
    return 0;
  }
  if (
    enemyPurge &&
    count > 0 &&
    source.health > 0 &&
    unit.health > 0 &&
    state.boons.includes("star-hoop") &&
    (onlyStatus === "block"
      ? unit.block > 0
      : onlyStatus
        ? Number(stats[onlyStatus]) > 0 || (onlyStatus === "dodge" && stats.temporaryDodge > 0)
        : hasBeneficialEffects(unit)) &&
    (stats.reflect ||
      succeeds(state, passiveAmount(state, unit.species, "statusReflection") / 100, false, events))
  ) {
    stats.reflect = false;
    events.push({
      kind: "status",
      status: "reflect",
      outcome: "apply",
      actorId: unit.id,
      targetId: source.id,
      text: `${unitName(unit)} reflects Purge to ${unitName(source)}`,
    });
    yield* reaction(
      "removeEffects",
      source,
      "purge",
      count,
      events,
      state,
      onlyStatus,
      unit,
      true,
      false,
      steal,
    );
    return 0;
  }
  const shelter =
    kind === "purge" && state && !isEnemy(unit) && unit.block > 0 && state.boons.includes("shelter-lantern");
  if (shelter && onlyStatus && onlyStatus !== "block") count = 0;
  if (kind === "purge" && (!onlyStatus || onlyStatus === "block") && unit.block > 0 && count > 0) {
    purgedBlock = unit.block;
    if (steal) stolen.push({ status: "block", amount: unit.block });
    unit.block = 0;
    removedStatuses.push("block");
    purgedKinds.push("block");
    if (!pearlSieve || !isEnemy(unit) || (source && isEnemy(source))) count--;
    if (shelter) count = 0;
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
    if (state) controlRecoveryDraw(state, unit.id, events);
    cleansed++;
    count--;
  }
  for (const status of statuses) {
    if (!(count > 0)) break;
    if (
      !(kind === "cleanse" && status === "burn" && isEnemy(unit) && unit.block > 0 && moltenPaperweight) &&
      !(
        kind === "cleanse" &&
        status === "poison" &&
        isEnemy(unit) &&
        frozenBefore &&
        state &&
        state.boons.includes("herbarium-press")
      ) &&
      (Number(stats[status]) > 0 || (status === "dodge" && stats.temporaryDodge > 0))
    ) {
      if (steal && kind === "purge")
        stolen.push({
          status: status as (typeof beneficialStatuses)[number],
          amount: Number(stats[status]),
          temporary: status === "dodge" ? stats.temporaryDodge : undefined,
        });
      if (kind === "cleanse" && harmfulStatuses.includes(status as (typeof harmfulStatuses)[number]))
        remember(status as (typeof harmfulStatuses)[number]);
      const removal = clearSelectedStatus(unit, status);
      if (removal) {
        depletion = removal.depletion;
        purgedArmor = removal.removed;
      }
      if (kind === "cleanse") {
        cleansed++;
        delete stats.statusSources[status as (typeof harmfulStatuses)[number]];
      }
      count--;
      if (kind === "purge") purgedKinds.push(status as (typeof beneficialStatuses)[number]);
      removedStatuses.push(
        status === "reflectBurn" ? "reflect" : status === "nullifyFreeze" ? "nullify" : status,
      );
    }
  }
  if (
    kind === "cleanse" &&
    state &&
    !isEnemy(unit) &&
    stats.blind &&
    removedStatuses.includes("burn") &&
    state.boons.includes("soot-brush")
  ) {
    remember("blind");
    clearSelectedStatus(unit, "blind");
    delete stats.statusSources.blind;
    removedStatuses.push("blind");
    cleansed++;
  }
  const distinctRemovedStatuses = removedStatuses.length > 1 ? new Set(removedStatuses) : removedStatuses;
  for (const affectedStatus of distinctRemovedStatuses)
    emitStatus(events, unit.id, kind, "remove", {
      affectedStatus,
      text: `${unitName(unit)}: ${kind === "cleanse" ? "Cleanse" : "Purge"} ${affectedStatus}.`,
    });
  if (removedStatuses.length === 0)
    emitStatus(events, unit.id, kind, "remove", {
      amount: 0,
      text: `${unitName(unit)}: ${kind === "cleanse" ? "Cleanse" : "Purge"} removes no effects.`,
    });
  // Typed wards spend separate Purge categories; Cleanse coalesces control and buildup.
  const removedCount =
    kind === "purge" || Array.isArray(distinctRemovedStatuses)
      ? removedStatuses.length
      : distinctRemovedStatuses.size;
  if (!state) return removedCount;
  if (steal && source && source.health > 0) {
    for (const effect of stolen) {
      if (source.health <= 0) break;
      if (effect.status === "block") yield* reaction("grantBlock", state, source, effect.amount, events);
      else if (effect.status === "armor") {
        yield* reaction("grantArmor", state, source, effect.amount, events);
        yield* reaction("armorStealRewards", state, source, effect.amount, events);
      } else if (effect.status === "thorns" || effect.status === "dodge") {
        if (effect.amount > 0)
          yield* reaction("grantStatus", source, effect.status, effect.amount, events, state);
        if (effect.status === "dodge" && effect.temporary)
          grantTemporaryDodge(source, effect.temporary, events);
      } else {
        const sourceStats = ensureCombat(source);
        sourceStats[effect.status] = true;
        emitStatus(
          events,
          source.id,
          effect.status === "reflectBurn"
            ? "reflect"
            : effect.status === "nullifyFreeze"
              ? "nullify"
              : effect.status,
          "apply",
          {
            actorId: source.id,
            text: `${unitName(source)} steals ${effect.status}`,
          },
        );
      }
    }
  }
  if (cleansed > 0)
    yield* reaction(
      "cleanseRewards",
      state,
      unit,
      cleansed,
      events,
      hadFreezeBuildup && stats.freeze === 0 && removedStatuses.includes("freeze"),
    );
  if (
    kind === "cleanse" &&
    !isEnemy(unit) &&
    unit.health > 0 &&
    removedStatuses.includes("bleed") &&
    state.boons.includes("sail-needle")
  )
    yield* reaction("grantArmor", state, unit, boonRule("sail-needle").armor, events);
  if (
    playerPurge &&
    !steal &&
    source.health > 0 &&
    thornsBefore > stats.thorns &&
    state.boons.includes("pruning-crescent")
  )
    yield* reaction("grantStatus", source, "thorns", thornsBefore - stats.thorns, events, state);
  yield* cleanseThorns(
    state,
    unit,
    returned.reduce(
      (sum, effect) => sum + (effect.status === "poison" || effect.status === "bleed" ? effect.amount : 0),
      0,
    ),
    events,
  );
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
  if (!isEnemy(unit) && unit.health > 0 && state.boons.includes("pumice-glass-inkwell")) {
    const burn = returned.find((effect) => effect.status === "burn");
    const enemy =
      burn && findLivingBattlefield(state, "enemy", (candidate) => candidate.id === burn.sourceId);
    if (enemy) yield* reaction("applyBlind", state, unit, enemy, events);
  }
  for (const effect of returned)
    if (effect.status === "poison") yield* reaction("poisonCleanseMana", state, unit, effect.amount, events);
  if (kind === "purge" && !isEnemy(unit) && purgedArmor > 0 && state.boons.includes("comet-crucible"))
    yield* reaction("grantBlock", state, unit, purgedArmor, events);
  yield* reaction("triggerArmorBreak", state, depletion, events);
  if (
    kind === "purge" &&
    removedStatuses.length > 0 &&
    isEnemy(unit) &&
    source &&
    !isEnemy(source) &&
    unit.health > 0 &&
    stats.poison > 0 &&
    state.boons.includes("meadow-mortar")
  ) {
    const poisonSource = combatantById(state, stats.statusSources.poison) ?? source;
    yield* reaction("resolveHit", state, poisonSource, unit, stats.poison, "poison", events, {
      origin: "periodic",
    });
  }
  if (
    isEnemy(unit) &&
    source &&
    !isEnemy(source) &&
    source.health > 0 &&
    purgedBlock > 0 &&
    state.boons.includes("honey-press")
  ) {
    const recipient = mostInjured(healingAllies(state));
    if (recipient)
      yield* reaction(
        "restoreHealth",
        recipient,
        Math.round(purgedBlock / boonRule("honey-press").divisor),
        events,
        false,
        state,
      );
  }
  if (
    playerPurge &&
    source.health > 0 &&
    unit.health > 0 &&
    purgedArmor > 0 &&
    state.boons.includes("prism-chisel")
  )
    yield* reaction("hit", state, source, unit, purgedArmor, "light", events, { origin: "derived" });
  if (playerPurge && source.health > 0 && !linked) {
    // Linked removals retain ordinary reactions, but cannot fan out again.
    if (state.boons.includes("pattern-reel"))
      for (const status of purgedKinds)
        for (const other of battlefield(state, "enemy")) {
          if (source.health <= 0) break;
          if (other.id !== unit.id && other.health > 0)
            yield* reaction("removeEffects", other, "purge", 1, events, state, status, source, false, true);
        }
    if (spread && count > 0 && state.boons.includes("winnowing-sieve"))
      for (const other of battlefield(state, "enemy")) {
        if (count <= 0 || source.health <= 0) break;
        if (other.id === unit.id || other.health <= 0) continue;
        const blockBefore = other.block;
        const removed = yield* reaction(
          "removeEffects",
          other,
          "purge",
          count,
          events,
          state,
          onlyStatus,
          source,
          false,
        );
        const freeBlock =
          pearlSieve && blockBefore > 0 && other.block === 0 && (!onlyStatus || onlyStatus === "block")
            ? 1
            : 0;
        count = Math.max(0, count - Math.max(0, removed - freeBlock));
      }
  }
  return removedCount;
}
export function* poisonCleanseMana(
  state: GameState,
  unit: Combatant,
  removed: number,
  events: GameEvent[],
): Resolution<void> {
  if (
    state.phase === "battle" &&
    unit.health > 0 &&
    !isEnemy(unit) &&
    removed > 0 &&
    state.boons.includes("blooming-still")
  )
    yield* reaction("gainMana", state, boonRule("blooming-still").mana, events);
}
export function* cleanseThorns(
  state: GameState,
  unit: Combatant,
  removed: number,
  events: GameEvent[],
): Resolution<void> {
  if (
    state.phase === "battle" &&
    !isEnemy(unit) &&
    unit.health > 0 &&
    removed > 0 &&
    state.boons.includes("thistle-sieve")
  )
    yield* reaction(
      "grantStatus",
      unit,
      "thorns",
      Math.round(removed / boonRule("thistle-sieve").divisor),
      events,
      state,
    );
}
export function* cleanseRewards(
  state: GameState,
  unit: Combatant,
  cleansed: number,
  events: GameEvent[],
  freezeBuildupRemoved = false,
  partial = false,
): Resolution<void> {
  const stats = ensureCombat(unit);
  if (
    (cleansed > 0 || partial) &&
    unit.health > 0 &&
    !isEnemy(unit) &&
    state.phase === "battle" &&
    state.boons.includes("dandelion-poultice")
  )
    for (const enemy of battlefield(state, "enemy"))
      if (enemy.health > 0 && unit.health > 0)
        yield* reaction("hit", state, unit, enemy, boonRule("dandelion-poultice").damage, "nature", events, {
          origin: "derived",
        });
  if (cleansed <= 0) return;
  if (
    cleansed > 0 &&
    unit.health > 0 &&
    !isEnemy(unit) &&
    !stats.controlled &&
    state.boons.includes("calendula-soap") &&
    !harmfulStatuses.some((status) => Number(stats[status]) > 0)
  ) {
    stats.nullify = true;
    emitStatus(events, unit.id, "nullify", "gain", { text: `${unitName(unit)} gains Nullify` });
  }
  if (freezeBuildupRemoved && unit.health > 0) {
    const allied = !isEnemy(unit);
    const row = battlefieldView(state, allied ? "player" : "enemy");
    const healing = row.some((ally) => ally.id === unit.id)
      ? row.reduce(
          (total, ally) =>
            total +
            (ally.health > 0 ? passiveAmount(allied ? state : undefined, ally.species, "sunthaw") : 0),
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
export function* puzzleEffect(
  state: GameState,
  source: Combatant,
  target: Combatant,
  status: (typeof harmfulStatuses)[number],
  events: GameEvent[],
): Resolution<void> {
  if (
    state.phase !== "battle" ||
    isEnemy(source) ||
    !isEnemy(target) ||
    source.health <= 0 ||
    target.health <= 0 ||
    !state.boons.includes("story-puzzle-cube")
  )
    return;
  const progress = state.battle.puzzleProgress;
  if (progress.includes(status)) return;
  const next = [...progress, status];
  if (next.length < boonRule("story-puzzle-cube").effects) state.battle.puzzleProgress = next;
  else {
    // Clear before Purge reactions so a fresh trio cannot reuse the completed set
    state.battle.puzzleProgress = [];
    yield* reaction(
      "removeEffects",
      target,
      "purge",
      boonRule("story-puzzle-cube").purge,
      events,
      state,
      undefined,
      source,
    );
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
  if (damage <= 0 || source.health <= 0) return { depletions: [], appliedControl: false, suppressed: false };
  const stats = ensureCombat(target);
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target);
  const playerHit = alliedSource && !alliedTarget;
  let appliedControl = false;
  let applied = false;
  const depletions: ArmorDepletion[] = [];
  const storesControl = playerHit && state.boons.includes("sleepers-urn");
  const immune =
    (type === "stun" || type === "freeze") &&
    (stats.controlled ||
      stats.skipped ||
      (stats.cooldown > 0 && !storesControl) ||
      sharedControlImmunity(state, target) > 0 ||
      (type === "freeze" && alliedTarget && stats.armor > 0 && state.boons.includes("folded-mountain")) ||
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
    const retained = !isEnemy(target) && target.block > 0 && state.boons.includes("reef-casket");
    stats.nullify = retained;
    events.push({
      kind: "status",
      targetId: target.id,
      status: "nullify",
      affectedStatus: type,
      outcome: retained ? "immune" : "remove",
      text: `${unitName(target)} nullifies ${type}`,
    });
    if (!isEnemy(target) && state.boons.includes("peace-knot")) {
      const allies = battlefield(state, "player");
      if (allies.some((ally) => ally.id === target.id))
        for (const ally of allies)
          if (ally.id !== target.id && ally.health > 0)
            yield* reaction("grantBlock", state, ally, boonRule("peace-knot").block, events);
    }
    return { depletions: [], appliedControl: false, suppressed: true };
  }
  if (
    target.health > 0 &&
    !options.reflected &&
    !immune &&
    Number(stats[type]) < (type === "blind" ? 1 : STACK_LIMIT)
  ) {
    const chance = passiveAmount(alliedTarget ? state : undefined, target.species, "statusReflection");
    const burnReflection = type === "burn" && stats.reflectBurn;
    const enemies =
      burnReflection || stats.reflect || chance > 0
        ? livingBattlefield(state, alliedTarget ? "enemy" : "player")
        : [];
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
      yield* applyResolvedStatus(state, target, recipient, damage, type, events, {
        reflected: true,
      });
      if (alliedTarget && type === "blind" && state.boons.includes("wonder-kaleidoscope"))
        for (const other of enemies)
          if (target.health > 0 && other.health > 0 && other.id !== recipient.id)
            yield* applyResolvedStatus(state, target, other, damage, type, events, { reflected: true });
      return { depletions: [], appliedControl: false, suppressed: true };
    }
  }
  if (type === "blind" && target.health > 0 && !stats.blind) {
    stats.blind = true;
    applied = true;
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
    applied = gained > 0;
    if (type === "bleed" && options.leech) deferLeech(stats, source.id, gained);
    emitStatus(events, target.id, type, "gain", {
      amount: gained,
      text: `${unitName(target)} gains ${gained} ${type}.`,
    });
  }
  if ((type === "stun" || type === "freeze") && target.health > 0 && immune)
    emitStatus(events, target.id, type, "immune", {
      text: `${unitName(target)} is immune to ${type} buildup.`,
    });
  if ((type === "stun" || type === "freeze") && source.health > 0 && target.health > 0 && !immune) {
    const beforeStacks = stats[type];
    stats[type] = Math.min(STACK_LIMIT, stats[type] + damage);
    applied = stats[type] > beforeStacks;
    if (applied) stats.statusSources[type] = source.id;
    emitStatus(events, target.id, type, "gain", {
      amount: stats[type] - beforeStacks,
      text: `${unitName(target)} gains ${stats[type] - beforeStacks} ${type} buildup.`,
    });
    const threshold = controlThreshold(state, source, target, type);
    let reachesThreshold = stats[type] >= threshold;
    let controlTotal = stats[type];
    if (playerHit && state.boons.includes("undertow-castanets")) {
      const other = type === "stun" ? "freeze" : "stun";
      const otherThreshold = controlThreshold(state, source, target, other);
      reachesThreshold = stats[type] / threshold + stats[other] / otherThreshold >= 1;
      controlTotal += (stats[other] * threshold) / otherThreshold;
    }
    if (reachesThreshold && stats.cooldown === 0) {
      const excess = Math.max(0, Math.floor(controlTotal - threshold));
      const turns =
        type === "stun" && alliedSource && hasTalent(state, "stun.extended-stun")
          ? 1 + talentRule("stun.extended-stun").amount
          : type === "freeze" && playerHit && state.boons.includes("frozen-pocketwatch")
            ? 1 + boonRule("frozen-pocketwatch").turns
            : 1;
      enterControl(stats, type, options.controlTurns ?? turns);
      if (type === "stun" && alliedTarget && state.boons.includes("dawn-gong"))
        for (const ally of battlefield(state, "player"))
          if (ally.id !== target.id && ally.health > 0)
            yield* reaction("removeEffects", ally, "cleanse", 1, events, state, "stun", undefined, false);

      if (playerHit && state.boons.includes("undertow-castanets")) {
        const other = type === "stun" ? "freeze" : "stun";
        clearHarmfulStatus(stats, other);
      }
      appliedControl = true;
      if (playerHit) {
        if (type === "freeze" && hasTalent(state, "freeze.icebound")) target.block = 0;
        if (type === "freeze" && hasTalent(state, "freeze.brittle-armor")) {
          const { depletion } = removeArmor(target, stats.armor);
          if (depletion) depletions.push(depletion);
        }
        if (type === "stun" && hasTalent(state, "stun.free-follow-up"))
          ensureCombat(source)[talentRule("stun.free-follow-up").state] = true;
        if (type === "stun" && hasTalent(state, "stun.stun-insight")) draw(state, 1, events);
        if (type === "stun" && state.battle?.mana === 0 && hasTalent(state, "stun.stun-surge"))
          yield* reaction("gainMana", state, talentRule("stun.stun-surge").amount, events);
        if (type === "freeze" && hasTalent(state, "freeze.glacial-barrier"))
          yield* reaction("grantBlock", state, source, talentRule("freeze.glacial-barrier").amount, events);
        if (type === "stun" && source.block === 0 && hasTalent(state, "stun.guarded-counter"))
          yield* reaction("grantBlock", state, source, talentRule("stun.guarded-counter").amount, events);
        if (type === "stun" && hasTalent(state, "stun.shatter-guard")) {
          const { depletion } = removeArmor(target, stats.armor);
          if (depletion) depletions.push(depletion);
        }
      }
      emitStatus(events, target.id, type, "apply", {
        text: `${unitName(target)} is ${type === "stun" ? "Stunned" : "Frozen"}.`,
      });
      if (excess > 0 && playerHit && source.health > 0 && state.boons.includes("wonder-ball-maze")) {
        // Successful control spends this pool; each new control removes another recipient from the route.
        const recipient = findLivingBattlefield(
          state,
          "enemy",
          (unit) =>
            unit.id !== target.id &&
            !ensureCombat(unit).controlled &&
            !ensureCombat(unit).skipped &&
            (ensureCombat(unit).cooldown === 0 || state.boons.includes("sleepers-urn")),
        );
        if (recipient) {
          yield* applyResolvedStatus(state, source, recipient, excess, type, events);
        }
      }
    }
  }
  if (applied) yield* puzzleEffect(state, source, target, type, events);
  return { depletions, appliedControl, suppressed: false };
}
export function* controlRewards(
  state: GameState,
  source: Combatant,
  target: Combatant,
  type: DamageType,
  events: GameEvent[],
): Resolution<void> {
  if (source.health <= 0) return;
  if (type === "freeze" && isEnemy(source) !== isEnemy(target)) {
    const side = isEnemy(source) ? "enemy" : "player";
    if (battlefieldHasId(state, side, source.id)) {
      for (const guide of livingBattlefield(state, side)) {
        if (source.health <= 0) break;
        const amount = passiveAmount(side === "player" ? state : undefined, guide.species, "wintersReprieve");
        if (!amount) continue;
        for (const ally of healingAllies(state, side)) {
          if (source.health <= 0 || guide.health <= 0 || !battlefieldHasId(state, side, guide.id)) break;
          if (ally.health > 0 && !isDepartedMinion(state, ally))
            yield* reaction("restoreHealth", ally, amount, events, false, state, false, guide);
        }
      }
    }
  }
  if (source.health <= 0) return;
  if (!isEnemy(source) && isEnemy(target)) {
    if (type === "stun" && source.health > 0 && state.boons.includes("thunder-conch"))
      for (const enemy of battlefield(state, "enemy")) {
        if (source.health <= 0) break;
        if (enemy.id !== target.id && enemy.health > 0)
          yield* reaction("applyBlind", state, source, enemy, events);
      }
    if (source.health <= 0) return;
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

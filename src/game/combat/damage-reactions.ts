import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { chance as succeeds, talentChance } from "../chance";
import {
  findLivingBattlefield,
  battlefieldView,
  battlefieldHasId,
  livingBattlefield,
  healingAllies,
  isEnemy,
  combatantById,
} from "../battlefield";
import { roll } from "../random";
import { draw, drawKeyword, recoverBrokenGuard } from "../card-zones";
import { hasTalent, passiveAmount } from "../progression";
import type { DamageType } from "../content";
import type { GameEvent, GameState } from "../types";
import {
  ensureCombat,
  unitName,
  STACK_LIMIT,
  gainGold,
  removeArmor,
  grantTemporaryDodge,
  type Combatant,
} from "./state";
import type { packetPolicy, DamagePacket } from "./policy";
import { reaction, type Resolution } from "./operations";
import { applyResolvedStatus } from "./status-reactions";
import { reducePeriodicStacks, deferLeech, detonateBleedStacks, bleedPayments } from "./status-state";

const periodicStatuses = ["burn", "poison", "bleed"] as const;

export interface HitContext {
  state: GameState;
  source: Combatant;
  target: Combatant;
  type: DamageType;
  events: GameEvent[];
  frozenAtStart?: boolean;
}
export interface HitPayment {
  /** Mitigated damage before Block, used by hit effects and buildup. */
  readonly damage: number;
  readonly lost: number;
  /** Absorbed damage plus actual Health lost, capped by mitigated damage for Leech. */
  readonly dealt: number;
  readonly blocked: number;
  readonly blockSpent: number;
  readonly depletedBlock: boolean;
  readonly critical: boolean;
}
export function* dodgeResponse(
  { state, source, target, events }: HitContext,
  retaliate = true,
): Resolution<void> {
  const stats = ensureCombat(target),
    alliedTarget = !isEnemy(target);
  events.push({
    kind: "status",
    targetId: target.id,
    status: "dodge",
    outcome: "dodge",
    text: `${unitName(target)} Dodges.`,
  });
  // The Dodge is committed even if its first follow-up causes a knockout.
  if (alliedTarget) state.battleXP.dodge = Math.min(STACK_LIMIT, (state.battleXP.dodge ?? 0) + 1);
  if (alliedTarget && state.boons.includes("echo-ocarina")) {
    const allies = battlefieldView(state, "player");
    if (allies.some((ally) => ally.id === target.id))
      for (const ally of allies)
        if (ally.id !== target.id && ally.health > 0)
          grantTemporaryDodge(ally, boonRule("echo-ocarina").dodge, events);
  }
  if (alliedTarget && hasTalent(state, "dodge.catch-breath"))
    yield* reaction("restoreHealth", target, talentRule("dodge.catch-breath").amount, events, false, state);
  if (alliedTarget) {
    if (
      retaliate &&
      isEnemy(source) &&
      source.health > 0 &&
      target.health > 0 &&
      state.boons.includes("leafwing-shuttlecock")
    )
      yield* reaction("hit", state, target, source, boonRule("leafwing-shuttlecock").damage, "stun", events, {
        origin: "boon",
      });
    if (
      retaliate &&
      target.health > 0 &&
      source.health > 0 &&
      isEnemy(source) &&
      state.boons.includes("fern-fencing-foil")
    )
      yield* reaction(
        "removeEffects",
        source,
        "purge",
        boonRule("fern-fencing-foil").purge,
        events,
        state,
        undefined,
        target,
      );
    if (target.health <= 0) return;
    if (retaliate && state.boons.includes("briar-racquet") && stats.thorns > 0 && target.health > 0) {
      const damage = Math.round(stats.thorns / boonRule("briar-racquet").divisor);
      if (
        !(source.combat?.bleed && state.boons.includes("thornheart-ring")) &&
        !(state.boons.includes("tidecrest-hairpin") && stats.thorns <= boonRule("tidecrest-hairpin").minimum)
      )
        stats.thorns--;
      yield* reaction("hit", state, target, source, damage, "nature", events, {
        origin: "retaliation",
        thorns: true,
      });
    }
    if (target.health <= 0) return;
    stats[talentRule("dodge.finding-rhythm").state] = 0;
    if (hasTalent(state, "dodge.thornstep"))
      yield* reaction("grantStatus", target, "thorns", talentRule("dodge.thornstep").amount, events, state);
    if (hasTalent(state, "dodge.clean-getaway")) {
      for (const status of periodicStatuses)
        reducePeriodicStacks(stats, status, talentRule("dodge.clean-getaway").amount);
    }
    if (hasTalent(state, "dodge.open-flank")) stats.nextPhysical = talentRule("dodge.open-flank").amount;
    if (hasTalent(state, "dodge.unburdened")) {
      yield* reaction("removeControlBuildup", state, target, "stun", events);
      if (target.health <= 0) return;
      yield* reaction("removeControlBuildup", state, target, "freeze", events);
    }
    if (target.health <= 0) return;
    if (hasTalent(state, "dodge.tailwind")) draw(state, 1, events);
    if (hasTalent(state, "dodge.perfect-timing") && stats.armor === 0)
      yield* reaction("grantArmor", state, target, talentRule("dodge.perfect-timing").amount, events);
    if (target.health <= 0) return;
    if (hasTalent(state, "block.footwork"))
      yield* reaction("grantBlock", state, target, talentRule("block.footwork").amount, events);
    if (hasTalent(state, "bleed.parting-cut")) stats[talentRule("bleed.parting-cut").state] = true;
    if (hasTalent(state, "physical.riposte")) stats[talentRule("physical.riposte").state] = true;
    if (hasTalent(state, "nature.windstep")) stats[talentRule("nature.windstep").state] = true;
    if (retaliate && hasTalent(state, "burn.smoke-screen") && ensureCombat(source).burn > 0)
      yield* reaction("hit", state, target, source, talentRule("burn.smoke-screen").amount, "burn", events, {
        origin: "proc",
      });
  }
  const petals = passiveAmount(alliedTarget ? state : undefined, target.species, "petalwake");
  if (petals > 0 && target.health > 0) {
    const side = alliedTarget ? "player" : "enemy";
    if (battlefieldHasId(state, side, target.id))
      for (const ally of healingAllies(state, side)) {
        if (target.health <= 0) break;
        if (ally.health > 0)
          yield* reaction("restoreHealth", ally, petals, events, false, state, false, target);
      }
  }
  if (retaliate) {
    const cinderstep = passiveAmount(alliedTarget ? state : undefined, target.species, "dodgeBurn");
    if (cinderstep)
      yield* reaction("hit", state, target, source, cinderstep, "burn", events, {
        origin: "statusRetaliation",
      });
  }
}
export function* blockDepletionRewards(
  { state, source, target, events }: HitContext,
  { depletedBlock, blockSpent }: HitPayment,
  attack: boolean,
): Resolution<void> {
  const alliedTarget = !isEnemy(target);
  if (alliedTarget && depletedBlock) recoverBrokenGuard(state, target.id, events);
  if (
    alliedTarget &&
    depletedBlock &&
    state.boons.includes("coral-music-box") &&
    battlefieldHasId(state, "player", target.id)
  )
    drawKeyword(state, "water", events);
  if (!alliedTarget && !isEnemy(source) && depletedBlock && state.boons.includes("grain-flail")) {
    const { removed, depletion } = removeArmor(target, ensureCombat(target).armor);
    if (removed > 0)
      events.push({
        kind: "status",
        actorId: source.id,
        targetId: target.id,
        status: "armor",
        outcome: "remove",
        amount: removed,
        text: `${unitName(target)} loses ${removed} Armor to Grain Flail`,
      });
    yield* reaction("triggerArmorBreak", state, depletion, events);
  }
  if (alliedTarget && depletedBlock && attack && hasTalent(state, "block.sun-struck-shield"))
    yield* reaction(
      "hit",
      state,
      target,
      source,
      Math.round(blockSpent * (talentRule("block.sun-struck-shield").percent / 100)),
      "light",
      events,
      {
        origin: "derived",
      },
    );
  // Depletion rewards use the original block payment, not any newly granted Block.
  if (alliedTarget && depletedBlock && hasTalent(state, "block.second-wind"))
    yield* reaction("restoreHealth", target, talentRule("block.second-wind").amount, events, false, state);
}
export function* faultline({ state, target, events }: HitContext, depletedBlock: boolean): Resolution<void> {
  const allied = !isEnemy(target);
  if (!depletedBlock || target.health <= 0) return;
  const armor = passiveAmount(allied ? state : undefined, target.species, "faultline");
  if (armor && battlefieldHasId(state, allied ? "player" : "enemy", target.id))
    yield* reaction("grantArmor", state, target, armor, events);
}
export function publishHit(
  { source, target, type, events }: HitContext,
  { blocked, lost, critical }: HitPayment,
  options: DamagePacket,
) {
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
}
export function* passingFlame({ state, source, target, events }: HitContext): Resolution<void> {
  if (target.health > 0 || source.health <= 0 || isEnemy(source) === isEnemy(target)) return;
  const allied = !isEnemy(source);
  if (!battlefieldHasId(state, allied ? "player" : "enemy", source.id)) return;
  const percent = passiveAmount(allied ? state : undefined, source.species, "passingFlame");
  const total = Math.round((ensureCombat(target).burn * percent) / 100);
  if (total <= 0) return;
  const recipients = livingBattlefield(state, allied ? "enemy" : "player");
  if (!recipients.length) return;
  const share = Math.floor(total / recipients.length);
  const remainder = total % recipients.length;
  // Preserve the rounded total; ties for indivisible stacks retain battlefield order.
  for (const [index, recipient] of recipients.entries()) {
    if (source.health <= 0) break;
    const amount = share + Number(index < remainder);
    if (amount > 0) yield* reaction("applyHarmfulStatus", state, source, recipient, amount, "burn", events);
  }
}

export function* damageRewards(
  { state, source, target, type, events }: HitContext,
  { damage, lost, dealt }: HitPayment,
  policy: ReturnType<typeof packetPolicy>,
): Resolution<void> {
  yield* passingFlame({ state, source, target, type, events });
  const { attack } = policy;
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target),
    stats = ensureCombat(target);
  if (
    lost > 0 &&
    target.health === 0 &&
    !alliedTarget &&
    stats.bleed > 0 &&
    state.boons.includes("harvest-shears")
  ) {
    const original = combatantById(state, stats.statusSources.bleed);
    const bearer =
      original && !isEnemy(original) && original.health > 0
        ? original
        : findLivingBattlefield(state, "player");
    const recipient = findLivingBattlefield(state, "enemy", (enemy) => enemy.id !== target.id);
    if (bearer && recipient)
      yield* reaction("applyHarmfulStatus", state, bearer, recipient, stats.bleed, "bleed", events);
  }
  if (
    policy.attack &&
    alliedSource &&
    !alliedTarget &&
    type === "water" &&
    stats.blind &&
    source.health > 0 &&
    state.boons.includes("reef-incense-tile")
  ) {
    const other = findLivingBattlefield(
      state,
      "enemy",
      (unit) => unit.id !== target.id && !ensureCombat(unit).blind,
    );
    if (other) yield* reaction("applyBlind", state, source, other, events);
  }
  if (
    policy.attack &&
    alliedSource &&
    !alliedTarget &&
    source.health > 0 &&
    target.health > 0 &&
    type === "light" &&
    stats.burn > 0 &&
    state.boons.includes("furnace-prism")
  )
    yield* reaction("applyBlind", state, source, target, events);
  if (
    target.health === 0 &&
    !alliedTarget &&
    alliedSource &&
    stats.poison > 0 &&
    hasTalent(state, "poison.toxic-profit")
  )
    gainGold(state, talentRule("poison.toxic-profit").amount, events);
  if (target.health === 0 && !alliedTarget && alliedSource && state.boons.includes("bone-charm"))
    yield* reaction("restoreHealth", source, boonRule("bone-charm").healing, events, false, state);
  if (alliedSource && !alliedTarget && dealt > 0 && (source.health > 0 || policy.deadSource)) {
    if (type === "bleed" && state.boons.includes("cutpurse-knife"))
      gainGold(state, boonRule("cutpurse-knife").gold, events);
    if (
      type === "poison" &&
      policy.leechRewards &&
      state.boons.includes("parasitic-bloom") &&
      succeeds(state, boonRule("parasitic-bloom").chance, false, events)
    )
      yield* reaction("leechHealth", state, source, dealt, events, true, target);
    // Poison ticks and triggered damage carry the same Leech talent as direct Poison hits.
    if (
      !policy.direct &&
      policy.leechRewards &&
      source.health > 0 &&
      type === "poison" &&
      talentChance(state, "leech.virulent-leech", events)
    )
      yield* reaction("leechHealth", state, source, dealt, events, true, target);
    if (
      attack &&
      type === "nature" &&
      lost > 0 &&
      state.boons.includes("lucky-clover") &&
      succeeds(state, boonRule("lucky-clover").chance, false, events)
    )
      gainGold(state, lost, events);
    if (
      attack &&
      type === "light" &&
      state.boons.includes("brass-censer") &&
      succeeds(state, boonRule("brass-censer").chance, false, events)
    ) {
      if (
        roll(state, { kind: "chance", threshold: boonRule("brass-censer").burnChance }) <
        boonRule("brass-censer").burnChance
      )
        yield* reaction("hit", state, source, target, damage, "burn", events, { origin: "proc" });
      else
        yield* reaction(
          "leechHealth",
          state,
          source,
          dealt,
          events,
          stats.poison > 0 || stats.bleed > 0,
          target,
        );
    }
  }
}
export function* poisonStun(
  { state, source, target, type, events }: HitContext,
  damage: number,
): Resolution<void> {
  if (
    type !== "poison" ||
    isEnemy(source) ||
    !isEnemy(target) ||
    source.health <= 0 ||
    target.health <= 0 ||
    !state.boons.includes("poppy-seed-grinder")
  )
    return;
  const amount = Math.round(damage / boonRule("poppy-seed-grinder").divisor);
  if (amount <= 0) return;
  yield* applyResolvedStatus(state, source, target, amount, "stun", events);
}
export function* waterFollowups(
  { state, source, events }: HitContext,
  erode: (amount: number) => void,
): Resolution<void> {
  if (hasTalent(state, "water.seafoam"))
    yield* reaction("grantBlock", state, source, talentRule("water.seafoam").amount, events);
  if (hasTalent(state, "water.erosion")) {
    erode(talentRule("water.erosion").amount);
  }
  if (talentChance(state, "water.cleansing-current", events))
    yield* reaction(
      "removeEffects",
      source,
      "cleanse",
      talentRule("water.cleansing-current").amount,
      events,
      state,
    );
  if (source.health > 0 && talentChance(state, "water.riptide", events)) drawKeyword(state, "water", events);
}
export function* attackProcs(
  { state, source, target, type, events }: HitContext,
  { damage, lost, dealt, critical }: HitPayment,
  {
    partingCut,
    bleedBefore,
    leech,
    blessedLeech,
    suppressed,
  }: {
    partingCut: boolean;
    bleedBefore: number;
    leech: boolean;
    blessedLeech: boolean;
    suppressed: boolean;
  },
  erode: (amount: number) => void,
): Resolution<void> {
  const stats = ensureCombat(target);
  if (source.health > 0) {
    if (type === "nature" && talentChance(state, "nature.bramblegrowth", events))
      yield* reaction("grantStatus", source, "thorns", damage, events, state);
    if (type === "light" && lost > 0 && talentChance(state, "light.faith-barrier", events))
      yield* reaction("grantBlock", state, source, lost, events);
  }
  if (source.health > 0) {
    const proc = (id: Parameters<typeof talentChance>[1]) =>
      source.health > 0 && talentChance(state, id, events);

    if (type === "physical") {
      if (proc("physical.heavy-blows"))
        yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
      if (proc("physical.lacerate"))
        yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
      if (proc("armor.iron-guard")) yield* reaction("grantArmor", state, source, damage, events);
      if (partingCut && source.health > 0)
        yield* reaction("hit", state, source, target, Math.round(damage / 2), "bleed", events, {
          origin: "proc",
        });
      if (source.health > 0 && critical && hasTalent(state, "physical.rupture"))
        yield* detonateBleed(state, source, target, events);
    }
    if (type === "nature") {
      if (proc("nature.thornskin")) yield* reaction("grantArmor", state, source, damage, events);
      if (proc("nature.photosynthesis"))
        yield* reaction("restoreHealth", source, damage, events, false, state);
      if (proc("nature.briar-patch"))
        yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
      if (proc("nature.toxic-pollen"))
        yield* reaction("hit", state, source, target, damage, "poison", events, { origin: "proc" });
      if (proc("nature.entangle"))
        yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
    }
    if (type === "burn" && proc("burn.heat-exhaustion"))
      yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
    if (type === "poison") {
      if (proc("poison.hemotoxin"))
        yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
      if (proc("poison.paralytic-venom"))
        yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
    }
    if (type === "bleed") {
      if (proc("bleed.flay")) erode(stats.armor - Math.round(stats.armor / 2));
      if (proc("bleed.tainted-wound"))
        yield* reaction("hit", state, source, target, Math.round(damage / 2), "poison", events, {
          origin: "proc",
        });
      if (proc("bleed.bloodrush")) draw(state, 1, events);
    }
    if (type === "light") {
      if (proc("light.scorching-light"))
        yield* reaction("hit", state, source, target, damage, "burn", events, { origin: "proc" });
      if (lost > 0 && proc("light.tithe")) gainGold(state, lost, events);
    }
    const chanceLeech =
      (type === "bleed" && proc("bleed.sanguine")) ||
      (type === "poison" && proc("leech.virulent-leech")) ||
      (type === "nature" && proc("nature.verdant-cycle"));
    if (chanceLeech && type === "bleed" && !leech) {
      if (!suppressed) deferLeech(stats, source.id, Math.max(0, stats.bleed - bleedBefore));
    } else if (chanceLeech && !leech && !blessedLeech)
      yield* reaction(
        "leechHealth",
        state,
        source,
        dealt,
        events,
        stats.poison > 0 || stats.bleed > 0,
        target,
      );
  }
}
export function* thornRetaliation({
  state,
  source,
  target,
  events,
  type: attackType,
  frozenAtStart,
}: Pick<HitContext, "state" | "source" | "target" | "events" | "frozenAtStart"> & {
  type?: DamageType;
}): Resolution<void> {
  const stats = ensureCombat(target);
  const reflected = stats.thorns;
  if (source.health <= 0 || reflected <= 0) return;
  if (
    isEnemy(target) &&
    !isEnemy(source) &&
    (frozenAtStart ?? stats.controlled === "freeze") &&
    state.boons.includes("snowbell")
  )
    return;
  if (
    !(source.combat?.bleed && !isEnemy(target) && state.boons.includes("thornheart-ring")) &&
    !(
      !isEnemy(target) &&
      state.boons.includes("tidecrest-hairpin") &&
      reflected <= boonRule("tidecrest-hairpin").minimum
    )
  )
    stats.thorns--;
  if (!isEnemy(source) && isEnemy(target) && attackType === "water" && state.boons.includes("moonboat-toy"))
    return;
  yield* reaction("hit", state, target, source, reflected, "nature", events, {
    origin: "retaliation",
    thorns: true,
  });
}
export function* passiveRetaliation(
  { state, source, target, events }: HitContext,
  depletedBlock: boolean,
): Resolution<void> {
  const alliedTarget = !isEnemy(target);
  if (target.health > 0 && source.health > 0) {
    const amount = passiveAmount(alliedTarget ? state : undefined, target.species, "poisonRetaliation");
    if (amount > 0)
      yield* reaction("hit", state, target, source, amount, "poison", events, {
        origin: "statusRetaliation",
      });
  }
  // Only direct attacks burst the bubble; derived damage cannot start retaliation chains
  if (depletedBlock && target.health > 0 && source.health > 0) {
    const amount = passiveAmount(alliedTarget ? state : undefined, target.species, "blockBreak");
    if (amount > 0)
      yield* reaction("hit", state, target, source, amount, "water", events, { origin: "retaliation" });
  }
}
export function* detonateBleed(
  state: GameState,
  source: Combatant,
  target: Combatant,
  events: GameEvent[],
): Resolution<void> {
  const stats = ensureCombat(target);
  if (stats.bleed <= 0) return;
  const { amount, payouts } = detonateBleedStacks(stats);
  const payment = yield* reaction("resolveHit", state, source, target, amount, "bleed", events, {
    origin: "periodic",
  });
  yield* settleBleedLeech(state, target, payouts, payment.outcome === "landed" ? payment.dealt : 0, events);
}

/** Both ticks and detonations pay captured obligations in order, even after Cleanse. */
export function* settleBleedLeech(
  state: GameState,
  target: Combatant,
  payouts: Parameters<typeof bleedPayments>[0],
  dealt: number,
  events: GameEvent[],
): Resolution<void> {
  for (const payout of bleedPayments(payouts, dealt)) {
    const owner = combatantById(state, payout.sourceId);
    if (owner) yield* reaction("leechHealth", state, owner, payout.amount, events, true, target);
  }
}

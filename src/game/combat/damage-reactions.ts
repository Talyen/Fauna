import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { chance as succeeds } from "../chance";
import { isEnemy } from "../battlefield";
import { roll } from "../random";
import { draw, drawKeyword } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";
import type { DamageType } from "../content";
import type { GameEvent, GameState } from "../types";
import { ensureCombat, unitName, STACK_LIMIT, gainGold, type Combatant } from "./state";
import type { packetPolicy, DamagePacket } from "./policy";
import { reaction, type Resolution } from "./operations";
import { reducePeriodicStacks, deferLeech, detonateBleedStacks, bleedPayments } from "./status-state";

export interface HitContext {
  state: GameState;
  source: Combatant;
  target: Combatant;
  type: DamageType;
  events: GameEvent[];
}
export interface HitPayment {
  readonly damage: number;
  readonly lost: number;
  readonly blocked: number;
  readonly blockSpent: number;
  readonly depletedBlock: boolean;
  readonly critical: boolean;
}
export function* dodgeResponse({ state, source, target, events }: HitContext): Resolution<void> {
  const stats = ensureCombat(target),
    alliedTarget = !isEnemy(target);
  events.push({
    kind: "status",
    targetId: target.id,
    status: "dodge",
    outcome: "dodge",
    text: `${unitName(target)} Dodges.`,
  });
  if (alliedTarget && hasTalent(state, "dodge.catch-breath"))
    yield* reaction("restoreHealth", target, talentRule("dodge.catch-breath").amount, events, false, state);
  if (alliedTarget) {
    stats[talentRule("dodge.finding-rhythm").state] = 0;
    if (hasTalent(state, "dodge.thornstep"))
      yield* reaction("grantStatus", target, "thorns", talentRule("dodge.thornstep").amount, events, state);
    if (hasTalent(state, "dodge.clean-getaway")) {
      for (const status of ["burn", "poison", "bleed"] as const)
        reducePeriodicStacks(stats, status, talentRule("dodge.clean-getaway").amount);
    }
    if (hasTalent(state, "dodge.open-flank")) stats.nextPhysical = talentRule("dodge.open-flank").amount;
    if (hasTalent(state, "dodge.unburdened")) {
      yield* reaction("removeControlBuildup", state, target, "stun", events);
      yield* reaction("removeControlBuildup", state, target, "freeze", events);
    }
    if (hasTalent(state, "dodge.tailwind")) draw(state, 1, events);
    if (hasTalent(state, "dodge.perfect-timing") && stats.armor === 0)
      yield* reaction("grantArmor", state, target, talentRule("dodge.perfect-timing").amount, events);
    if (hasTalent(state, "block.footwork"))
      yield* reaction("grantBlock", state, target, talentRule("block.footwork").amount, events);
    if (hasTalent(state, "bleed.parting-cut")) stats[talentRule("bleed.parting-cut").state] = true;
    if (hasTalent(state, "physical.riposte")) stats[talentRule("physical.riposte").state] = true;
    if (hasTalent(state, "nature.windstep")) stats[talentRule("nature.windstep").state] = true;
    if (hasTalent(state, "burn.smoke-screen") && ensureCombat(source).burn > 0)
      yield* reaction("hit", state, target, source, talentRule("burn.smoke-screen").amount, "burn", events, {
        origin: "proc",
      });
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
}
export function* blockDepletionRewards(
  { state, source, target, events }: HitContext,
  { depletedBlock, blockSpent }: HitPayment,
  attack: boolean,
): Resolution<void> {
  const alliedTarget = !isEnemy(target);
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
export function* damageRewards(
  { state, source, target, type, events }: HitContext,
  { damage, lost }: HitPayment,
  policy: ReturnType<typeof packetPolicy>,
): Resolution<void> {
  const { attack } = policy;
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target),
    stats = ensureCombat(target);
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
  if (alliedSource && !alliedTarget && lost > 0 && (source.health > 0 || policy.deadSource)) {
    if (type === "bleed" && state.boons.includes("cutpurse-knife"))
      gainGold(state, boonRule("cutpurse-knife").gold, events);
    if (
      type === "poison" &&
      state.boons.includes("parasitic-bloom") &&
      succeeds(state, boonRule("parasitic-bloom").chance, false, events)
    )
      yield* reaction("leechHealth", state, source, lost, events, true);
    // Poison ticks and triggered damage carry the same Leech talent as direct Poison hits.
    if (
      !policy.direct &&
      source.health > 0 &&
      type === "poison" &&
      hasTalent(state, "leech.virulent-leech") &&
      succeeds(state, talentRule("leech.virulent-leech").percent / 100, false, events)
    )
      yield* reaction("leechHealth", state, source, lost, events, true);
    if (
      attack &&
      type === "nature" &&
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
      else yield* reaction("leechHealth", state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
    }
  }
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
  if (
    hasTalent(state, "water.cleansing-current") &&
    succeeds(state, talentRule("water.cleansing-current").percent / 100, false, events)
  )
    yield* reaction(
      "removeEffects",
      source,
      "cleanse",
      talentRule("water.cleansing-current").amount,
      events,
      state,
    );
  if (
    hasTalent(state, "water.riptide") &&
    succeeds(state, talentRule("water.riptide").percent / 100, false, events)
  )
    drawKeyword(state, "water", events);
}
export function* attackProcs(
  { state, source, target, type, events }: HitContext,
  { damage, lost, critical }: HitPayment,
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
    if (
      type === "nature" &&
      hasTalent(state, "nature.bramblegrowth") &&
      succeeds(state, talentRule("nature.bramblegrowth").percent / 100, false, events)
    )
      yield* reaction("grantStatus", source, "thorns", damage, events, state);
    if (
      type === "light" &&
      lost > 0 &&
      hasTalent(state, "light.faith-barrier") &&
      succeeds(state, talentRule("light.faith-barrier").percent / 100, false, events)
    )
      yield* reaction("grantBlock", state, source, lost, events);
  }
  if (source.health > 0) {
    const proc = (id: import("../content").TalentId, chance: number) =>
      source.health > 0 && hasTalent(state, id) && succeeds(state, chance, false, events);

    if (type === "physical") {
      if (proc("physical.heavy-blows", talentRule("physical.heavy-blows").percent / 100))
        yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
      if (proc("physical.lacerate", talentRule("physical.lacerate").percent / 100))
        yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
      if (proc("armor.iron-guard", talentRule("armor.iron-guard").percent / 100))
        yield* reaction("grantArmor", state, source, damage, events);
      if (partingCut && source.health > 0)
        yield* reaction("hit", state, source, target, Math.round(damage / 2), "bleed", events, {
          origin: "proc",
        });
      if (source.health > 0 && critical && hasTalent(state, "physical.rupture"))
        yield* detonateBleed(state, source, target, events);
    }
    if (type === "nature") {
      if (proc("nature.thornskin", talentRule("nature.thornskin").percent / 100))
        yield* reaction("grantArmor", state, source, damage, events);
      if (proc("nature.photosynthesis", talentRule("nature.photosynthesis").percent / 100))
        yield* reaction("restoreHealth", source, damage, events, false, state);
      if (proc("nature.briar-patch", talentRule("nature.briar-patch").percent / 100))
        yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
      if (proc("nature.toxic-pollen", talentRule("nature.toxic-pollen").percent / 100))
        yield* reaction("hit", state, source, target, damage, "poison", events, { origin: "proc" });
      if (proc("nature.entangle", talentRule("nature.entangle").percent / 100))
        yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
    }
    if (type === "burn" && proc("burn.heat-exhaustion", talentRule("burn.heat-exhaustion").percent / 100))
      yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
    if (type === "poison") {
      if (proc("poison.hemotoxin", talentRule("poison.hemotoxin").percent / 100))
        yield* reaction("hit", state, source, target, damage, "bleed", events, { origin: "proc" });
      if (proc("poison.paralytic-venom", talentRule("poison.paralytic-venom").percent / 100))
        yield* reaction("hit", state, source, target, damage, "stun", events, { origin: "proc" });
    }
    if (type === "bleed") {
      if (proc("bleed.flay", talentRule("bleed.flay").percent / 100))
        erode(stats.armor - Math.round(stats.armor / 2));
      if (proc("bleed.tainted-wound", talentRule("bleed.tainted-wound").percent / 100))
        yield* reaction("hit", state, source, target, Math.round(damage / 2), "poison", events, {
          origin: "proc",
        });
      if (proc("bleed.bloodrush", talentRule("bleed.bloodrush").percent / 100)) draw(state, 1, events);
    }
    if (type === "light") {
      if (proc("light.scorching-light", talentRule("light.scorching-light").percent / 100))
        yield* reaction("hit", state, source, target, damage, "burn", events, { origin: "proc" });
      if (lost > 0 && proc("light.tithe", talentRule("light.tithe").percent / 100))
        gainGold(state, lost, events);
    }
    const chanceLeech =
      (type === "bleed" && proc("bleed.sanguine", talentRule("bleed.sanguine").percent / 100)) ||
      (type === "poison" && proc("leech.virulent-leech", talentRule("leech.virulent-leech").percent / 100)) ||
      (type === "nature" && proc("nature.verdant-cycle", talentRule("nature.verdant-cycle").percent / 100));
    if (chanceLeech && type === "bleed" && !leech) {
      if (!suppressed) deferLeech(stats, source.id, Math.max(0, stats.bleed - bleedBefore));
    } else if (chanceLeech && !leech && !blessedLeech)
      yield* reaction("leechHealth", state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
  }
}
export function* thornRetaliation({
  state,
  source,
  target,
  events,
}: Pick<HitContext, "state" | "source" | "target" | "events">): Resolution<void> {
  const stats = ensureCombat(target);
  for (const [status, type] of [
    ["thorns", "nature"],
    ["waterThorns", "water"],
  ] as const) {
    if (source.health <= 0) break;
    const reflected = stats[status];
    if (reflected <= 0) continue;
    stats[status]--;
    yield* reaction("hit", state, target, source, reflected, type, events, { origin: "retaliation" });
  }
}
export function* passiveRetaliation(
  { state, source, target, events }: HitContext,
  depletedBlock: boolean,
): Resolution<void> {
  const alliedTarget = !isEnemy(target);
  if (target.health > 0 && source.health > 0) {
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
  if (depletedBlock && target.health > 0 && source.health > 0) {
    const amount = creaturePassive(alliedTarget ? state : undefined, target.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "blockBreak" ? effect.amount : 0),
      0,
    );
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
  const lost =
    (yield* reaction("hit", state, source, target, amount, "bleed", events, { origin: "periodic" })) ?? 0;
  for (const payout of bleedPayments(payouts, lost)) {
    const owner = [...state.team, ...state.reserves].find((unit) => unit.id === payout.sourceId);
    if (owner) yield* reaction("leechHealth", state, owner, payout.amount, events, true);
  }
}

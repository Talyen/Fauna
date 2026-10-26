import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { takeAttackReflection, publishAttackReflection } from "./attack-reflection";
import { interceptAttack } from "./interception";
import { chance as succeeds } from "../chance";
import { isEnemy, battlefield, healingAllies } from "../battlefield";
import { packetPolicy, type DamagePacket, type AttackPacket } from "./policy";
import { roll } from "../random";
import { hasTalent, creaturePassive } from "../progression";
import type { DamageType } from "../content";
import type { GameEvent, GameState } from "../types";
import {
  ensureCombat,
  maximumHealth,
  unitName,
  mostInjured,
  loseHealth,
  dodgeChance,
  beginAttack,
  removeArmor,
  type ArmorDepletion,
  type Combatant,
} from "./state";
import { reaction, type Resolution } from "./operations";
import { modifiedDamage, blockPayment, blockEfficiency, armoredDamage, armorApplies } from "./damage-values";
import {
  dodgeResponse,
  blockDepletionRewards,
  publishHit,
  damageRewards,
  waterFollowups,
  attackProcs,
  thornRetaliation,
  passiveRetaliation,
  detonateBleed,
  type HitPayment,
} from "./damage-reactions";

/** Consumed once per incoming attack, before its target's defenses or harmful follow-ups. */
export function* negateAttack(
  state: GameState,
  source: Combatant,
  target: Combatant,
  events: GameEvent[],
  allowReflection = true,
): Resolution<false | "negated" | "reflected"> {
  if (source.health <= 0 || target.health <= 0 || !ensureCombat(target).negate) return false;
  ensureCombat(target).negate = false;
  events.push({
    kind: "status",
    actorId: source.id,
    targetId: target.id,
    status: "negate",
    outcome: "immune",
    text: `${unitName(target)} negates the attack; Thorns still retaliate`,
  });
  yield* thornRetaliation({ state, source, target, events });
  if (
    allowReflection &&
    source.health > 0 &&
    target.health > 0 &&
    isEnemy(source) &&
    !isEnemy(target) &&
    state.boons.includes("echo-lens") &&
    succeeds(state, boonRule("echo-lens").chance, false, events)
  ) {
    publishAttackReflection(source, target, events);
    return "reflected";
  }
  return "negated";
}

type HitResult = { outcome: "ignored" | "miss" } | { outcome: "landed"; lost: number; dealt: number };

export function* bounce(
  state: GameState,
  source: Combatant,
  first: Combatant,
  action:
    | { effect: "heal"; amount: number; events: GameEvent[]; cardHealing: boolean }
    | { effect: "light"; amount: number; events: GameEvent[]; packet: AttackPacket },
): Resolution<void> {
  if (!state.battle) return;
  const { effect } = action;
  const allied = !isEnemy(source);
  let pool: Combatant[] | undefined;
  let visited: Set<string> | undefined;
  for (const entry of creaturePassive(allied ? state : undefined, source.species).effects) {
    if (entry.kind !== "bounce" || entry.effect !== effect) continue;
    // Ordinary hits and heals need no bounce snapshot or visited-target tracking.
    pool ??=
      effect === "heal"
        ? healingAllies(state, allied ? "player" : "enemy")
        : battlefield(state, allied ? "enemy" : "player");
    visited ??= new Set([first.id]);
    const visitedTargets = visited;
    for (let i = 0; i < entry.amount; i++) {
      const eligible = pool.filter(
        (unit) =>
          unit.health > 0 &&
          !visitedTargets.has(unit.id) &&
          (effect !== "heal" || unit.health < maximumHealth(unit)),
      );
      if (source.health <= 0 || !eligible.length) return;
      if (entry.chance !== undefined && !succeeds(state, entry.chance, !allied, action.events)) return;
      const target =
        effect === "heal"
          ? mostInjured(eligible)!
          : eligible[Math.floor(roll(state, { kind: "index", size: eligible.length }) * eligible.length)]!;
      visitedTargets.add(target.id);
      if (action.effect === "heal")
        yield* reaction(
          "restoreHealth",
          target,
          action.amount,
          action.events,
          false,
          state,
          action.cardHealing,
          source,
          { bounce: false },
        );
      else
        yield* reaction("hit", state, source, target, action.amount, "light", action.events, {
          ...action.packet,
          delivery: "bounce",
        });
    }
  }
}
export function* hit(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  events: GameEvent[],
  options: DamagePacket = { origin: "ability" },
): Resolution<number | undefined> {
  if (
    value > 0 &&
    source.health > 0 &&
    target.health > 0 &&
    options.origin === "ability" &&
    !options.delivery
  ) {
    options = { ...options, blindMiss: options.blindMiss ?? beginAttack(state, source, events) };
    if (!options.interceptionChecked && !options.blindMiss)
      target = interceptAttack(state, source, target, events);
  }
  const negation =
    value > 0 && options.origin === "ability" && !options.blindMiss
      ? yield* reaction("negateAttack", state, source, target, events, options.delivery !== "reflection")
      : false;
  if (negation === "negated") return undefined;
  if (
    value > 0 &&
    options.origin === "ability" &&
    !options.blindMiss &&
    options.delivery !== "reflection" &&
    (negation === "reflected" || takeAttackReflection(source, target, events))
  ) {
    return yield* reaction("hit", state, target, source, value, type, events, {
      ...options,
      delivery: "reflection",
      interceptionChecked: true,
      blindMiss: false,
    });
  }
  const policy = packetPolicy(options);
  const wrongFoot =
    target.combat?.blind && policy.wrongFoot
      ? creaturePassive(isEnemy(source) ? undefined : state, source.species).effects.reduce(
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
    result.outcome === "landed" &&
    result.dealt > 0 &&
    type === "stun" &&
    source.health > 0 &&
    target.health > 0 &&
    policy.resonance
  ) {
    const chance = creaturePassive(isEnemy(source) ? undefined : state, source.species).effects.reduce(
      (total, effect) => total + (effect.kind === "resonance" ? effect.amount : 0),
      0,
    );
    if (succeeds(state, chance / 100, isEnemy(source), events)) {
      events.push({
        kind: "action",
        actionType: "support",
        actorId: source.id,
        targetId: target.id,
        text: `${unitName(source)} repeats Stun damage with Resonance`,
      });
      // Repeat the packet once, retaining Stun buildup but suppressing attack proc chains.
      yield* reaction("hit", state, source, target, value, type, events, {
        ...options,
        origin: "resonance",
        delivery: "delivery" in options && options.delivery === "bounce" ? "bounce" : undefined,
      });
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
export function* resolveHit(
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
  const context = { state, source, target, type, events };
  const leech = "leech" in options && options.leech;
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target);
  const stats = ensureCombat(target),
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
    direct &&
    ((options.origin === "ability" ? options.blindMiss : undefined) ?? beginAttack(state, source, events));
  if (
    direct &&
    (blindMiss ||
      (dodgeChance(state, target) > 0 &&
        succeeds(state, dodgeChance(state, target) / 100, !alliedTarget, events)))
  ) {
    if (alliedSource && !alliedTarget && state.boons.includes("coral-net-weight") && target.block > 0) {
      const payment = blockPayment(
        modifiedDamage(state, source, target, value, type, options, attack),
        target.block,
        blockEfficiency(state, target, type),
      );
      target.block -= payment.spent;
      if (payment.spent > 0) {
        events.push({
          kind: "block",
          actorId: source.id,
          targetId: target.id,
          amount: -payment.absorbed,
          text: `${unitName(target)} loses ${payment.spent} Block to Coral Net Weight`,
        });
        yield* blockDepletionRewards(
          context,
          {
            damage: 0,
            lost: 0,
            dealt: 0,
            blocked: payment.absorbed,
            blockSpent: payment.spent,
            depletedBlock: target.block === 0,
            critical: false,
          },
          false,
        );
      }
    }
    yield* dodgeResponse(context);
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
    return { outcome: "landed", lost: 0, dealt: 0 };
  }
  const nextPhysical =
    direct && alliedSource ? ensureCombat(source)[talentRule("dodge.open-flank").state] : 0;
  if (nextPhysical) ensureCombat(source)[talentRule("dodge.open-flank").state] = 0;
  let damage = value;
  if (
    direct &&
    alliedSource &&
    type === "burn" &&
    state.battle &&
    state.boons.includes("meteorite") &&
    !state.battle.meteoriteUsed
  ) {
    state.battle.meteoriteUsed = true;
    damage *= boonRule("meteorite").multiplier;
  }
  // Chain strength is the original absorbed amount, not a second application of attack bonuses
  if (options.origin !== "chain")
    damage = modifiedDamage(state, source, target, damage, type, options, attack);
  const riposte =
    direct &&
    alliedSource &&
    type === "physical" &&
    ensureCombat(source)[talentRule("physical.riposte").state];
  const criticalProtected = alliedTarget && stats.armor > 0 && state.boons.includes("honeycomb-frame");
  const criticalChance = criticalProtected
    ? 0
    : 0.05 + ((options.origin === "ability" ? options.criticalBonus : undefined) ?? 0) / 100;
  const critical =
    direct &&
    !criticalProtected &&
    (riposte || (criticalChance > 0 && succeeds(state, criticalChance, !alliedSource, events)));
  if (riposte) ensureCombat(source)[talentRule("physical.riposte").state] = false;
  const partingCut =
    direct &&
    alliedSource &&
    type === "physical" &&
    ensureCombat(source)[talentRule("bleed.parting-cut").state];
  if (partingCut) ensureCombat(source)[talentRule("bleed.parting-cut").state] = false;
  if (critical) damage *= 2;
  const blockRatio = blockEfficiency(state, target, type);
  const payment = blockPayment(damage, target.block, blockRatio);
  const blocked = payment.absorbed,
    blockSpent = payment.spent;
  target.block -= blockSpent;
  const depletedBlock = blocked > 0 && target.block === 0;
  damage = payment.remaining;
  if (
    attack &&
    alliedSource &&
    !alliedTarget &&
    state.boons.includes("sundering-charm") &&
    (type === "physical" || type === "stun")
  )
    erode(boonRule("sundering-charm").armor);
  // Other mechanics use the hit before Block; Armor still mitigates their damage.
  const effectDamage = armorApplies(state, target, type, source)
    ? armoredDamage(damage + blocked, stats.armor)
    : damage + blocked;
  if (armorApplies(state, target, type, source)) damage = armoredDamage(damage, stats.armor);
  if (direct && alliedSource && !alliedTarget && critical && state.boons.includes("crater-punch"))
    damage += Math.round(blocked / boonRule("crater-punch").divisor);
  const lost = loseHealth(state, target, damage, events);
  const dealt = Math.min(effectDamage, blocked + lost);
  if (effectDamage > 0) {
    if (!(alliedTarget && type === "water" && state.boons.includes("rain-cape"))) erode(1);
    if (alliedSource && type === "poison" && hasTalent(state, "poison.caustic")) erode(effectDamage);
    if (alliedSource && type === "burn" && hasTalent(state, "burn.melting-point")) erode(effectDamage);
  }
  if (lost > 0) yield* reaction("healthThresholds", state, target, before, events);
  if (alliedTarget && lost > 0 && hasTalent(state, "dodge.finding-rhythm"))
    stats.rhythm = Math.min(
      talentRule("dodge.finding-rhythm").maximum,
      stats.rhythm + talentRule("dodge.finding-rhythm").amount,
    );
  const facts: HitPayment = {
    damage: effectDamage,
    lost,
    dealt,
    blocked,
    blockSpent,
    depletedBlock,
    critical,
  };
  yield* blockDepletionRewards(context, facts, attack);
  publishHit(context, facts, options);
  yield* damageRewards(context, facts, policy);
  if (nextPhysical > 0 && source.health > 0)
    yield* reaction("hit", state, source, target, nextPhysical, "physical", events, { origin: "proc" });
  if (direct && alliedSource && !alliedTarget && source.health > 0 && type === "water") {
    yield* waterFollowups(context, erode);
  }
  if (policy.buildup && effectDamage > 0 && source.health > 0) {
    const bleedBefore = stats.bleed;
    const statusResult = yield* reaction(
      "applyHarmfulStatus",
      state,
      source,
      target,
      effectDamage,
      type,
      events,
      {
        leech,
        blocked: blocked > 0,
      },
    );
    depletions.push(...statusResult.depletions);
    if (direct && alliedSource && !alliedTarget && source.health > 0)
      yield* attackProcs(
        context,
        facts,
        {
          partingCut: !!partingCut,
          bleedBefore,
          leech: !!leech,
          blessedLeech,
          suppressed: statusResult.suppressed,
        },
        erode,
      );
    // Captured damage remains valid even if retaliation later removes the attacker.
    if (direct && target.health > 0) yield* thornRetaliation(context);
    if ((leech || blessedLeech) && type !== "bleed" && source.health > 0)
      yield* reaction("leechHealth", state, source, dealt, events, stats.poison > 0 || stats.bleed > 0);
    if (statusResult.appliedControl && source.health > 0)
      yield* reaction("controlRewards", state, source, target, type, events);
  }
  // Absorbed critical hits still land; only damage-based procs require positive damage.
  if (
    effectDamage === 0 &&
    direct &&
    alliedSource &&
    !alliedTarget &&
    type === "physical" &&
    critical &&
    source.health > 0 &&
    hasTalent(state, "physical.rupture")
  )
    yield* detonateBleed(state, source, target, events);
  if (effectDamage === 0 && direct && target.health > 0) yield* thornRetaliation(context);
  if (direct) yield* passiveRetaliation(context, depletedBlock);
  for (const depletion of depletions) yield* reaction("triggerArmorBreak", state, depletion, events);
  if (
    (direct || options.origin === "overkill") &&
    alliedSource &&
    !alliedTarget &&
    target.health === 0 &&
    damage > before &&
    state.boons.includes("wonder-domino")
  ) {
    const recipient = battlefield(state, "enemy").find((enemy) => enemy.health > 0);
    if (recipient)
      yield* reaction("hit", state, source, recipient, damage - before, type, events, { origin: "overkill" });
  }
  if (
    blocked > 0 &&
    type === "water" &&
    alliedSource &&
    !alliedTarget &&
    options.origin !== "chain" &&
    state.boons.includes("brookskip-disc")
  ) {
    const recipient = battlefield(state, "enemy").find((enemy) => enemy.id !== target.id && enemy.health > 0);
    if (recipient)
      yield* reaction("hit", state, source, recipient, blocked, "water", events, { origin: "chain" });
  }
  if (
    blockSpent > 0 &&
    direct &&
    !alliedSource &&
    alliedTarget &&
    target.health > 0 &&
    source.health > 0 &&
    state.boons.includes("fallingstar-anvil")
  ) {
    const result = yield* reaction(
      "applyHarmfulStatus",
      state,
      target,
      source,
      Math.round(blockSpent / boonRule("fallingstar-anvil").divisor),
      "stun",
      events,
    );
    if (result.appliedControl) yield* reaction("controlRewards", state, target, source, "stun", events);
    for (const depletion of result.depletions) yield* reaction("triggerArmorBreak", state, depletion, events);
  }
  return { outcome: "landed", lost, dealt };
}

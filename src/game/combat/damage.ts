import { emitSupport, emitStatus } from "../events";
import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { takeAttackReflection, publishAttackReflection } from "./attack-reflection";
import { interceptAttack } from "./interception";
import { chance as succeeds } from "../chance";
import {
  findLivingBattlefield,
  isEnemy,
  battlefield,
  healingAllies,
  isDepartedMinion,
  enemyReflectionRecipients,
} from "../battlefield";
import { packetPolicyView, type DamagePacket, type AttackPacket, type SharedNegate } from "./policy";
import { roll } from "../random";
import { hasTalent, creaturePassiveTier, passiveAmount } from "../progression";
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
import { applyResolvedStatus } from "./status-reactions";
import { modifiedDamage, blockPayment, blockEfficiency, armoredDamage, armorApplies } from "./damage-values";
import {
  dodgeResponse,
  blockDepletionRewards,
  publishHit,
  damageRewards,
  poisonStun,
  waterFollowups,
  attackProcs,
  thornRetaliation,
  passiveRetaliation,
  detonateBleed,
  type HitPayment,
} from "./damage-reactions";

/** Resolve the shelter before any recipient takes damage, so lineup order cannot change it. */
export function shareDodge(
  state: GameState,
  source: Combatant,
  targets: Combatant[],
  events: GameEvent[],
  blindMiss: boolean,
  sharedNegate?: SharedNegate,
): boolean | undefined {
  if (!isEnemy(source) || targets.length < 2 || !state.boons.includes("sandfold-parasol")) return;
  if (blindMiss) return true;
  const checked = targets.length > 2 ? new Set<string>() : undefined;
  let firstId: string | undefined;
  for (const target of targets) {
    if (checked ? checked.has(target.id) : target.id === firstId) continue;
    if (checked) checked.add(target.id);
    else firstId = target.id;
    const stats = ensureCombat(target);
    if (stats.negate || stats.attackReflection || target.id === sharedNegate?.recipientId) continue;
    const dodge = dodgeChance(state, target);
    if (dodge > 0 && succeeds(state, dodge / 100, false, events)) return true;
  }
  return false;
}

/** A transient pair belongs to this attack only, independent of recipient delivery order. */
export function shareNegate(
  state: GameState,
  source: Combatant,
  targets: Combatant[],
  blindMiss: boolean,
): SharedNegate | undefined {
  if (blindMiss || !isEnemy(source) || !state.boons.includes("devotion-clasp")) return;
  const bearer = targets.find((unit) => unit.health > 0 && !isEnemy(unit) && ensureCombat(unit).negate);
  if (!bearer) return;
  let any: Combatant | undefined;
  let unprotected: Combatant | undefined;
  let anyFraction = Infinity;
  let unprotectedFraction = Infinity;
  for (const unit of targets) {
    if (unit.id === bearer.id || unit.health <= 0 || isEnemy(unit)) continue;
    const protectedByNegate = ensureCombat(unit).negate;
    const fraction = unit.health / maximumHealth(unit);
    if (!any || fraction < anyFraction) {
      any = unit;
      anyFraction = fraction;
    }
    if (!protectedByNegate && (!unprotected || fraction < unprotectedFraction)) {
      unprotected = unit;
      unprotectedFraction = fraction;
    }
  }
  const recipient = unprotected ?? any;
  if (recipient) return { bearer, recipientId: recipient.id, spent: false };
}

/** Consumed once per incoming attack, before its target's defenses or harmful follow-ups. */
export function* negateAttack(
  state: GameState,
  source: Combatant,
  target: Combatant,
  events: GameEvent[],
  allowReflection = true,
  attackType?: DamageType,
  shared?: SharedNegate,
): Resolution<false | "negated" | "reflected"> {
  if (source.health <= 0 || target.health <= 0) return false;
  const pair =
    shared &&
    isEnemy(source) &&
    !isEnemy(target) &&
    shared.bearer.health > 0 &&
    (target.id === shared.bearer.id || target.id === shared.recipientId) &&
    (shared.spent || ensureCombat(shared.bearer).negate)
      ? shared
      : undefined;
  const bearer = pair?.bearer ?? target;
  if (!pair?.spent && !ensureCombat(bearer).negate) return false;
  if (!isEnemy(source) && isEnemy(target) && attackType === "light" && state.boons.includes("dawn-key")) {
    ensureCombat(target).negate = false;
    emitStatus(events, target.id, "negate", "remove", { actorId: source.id, text: "Dawn Key breaks Negate" });
    return false;
  }
  const consumed = !pair?.spent;
  ensureCombat(bearer).negate = false;
  if (pair) pair.spent = true;
  events.push({
    kind: "status",
    actorId: source.id,
    targetId: target.id,
    status: "negate",
    outcome: "immune",
    text:
      pair && target.id !== bearer.id
        ? `${unitName(bearer)} protects ${unitName(target)} with Devotion Clasp`
        : `${unitName(target)} negates the attack`,
  });
  yield* thornRetaliation({ state, source, target, events, type: attackType });
  if (
    consumed &&
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

/** Supplemental hits cannot repeat an attack, start retaliation or retrigger these Boons. */
export function* boonHitFollowups(
  state: GameState,
  source: Combatant,
  target: Combatant,
  type: DamageType,
  events: GameEvent[],
  options: DamagePacket,
  attack: boolean,
): Resolution<void> {
  if (
    isEnemy(source) ||
    !isEnemy(target) ||
    source.health <= 0 ||
    target.health <= 0 ||
    options.origin === "boon"
  )
    return;
  if (type === "freeze" && attack && state.boons.includes("frostglass-die"))
    yield* reaction("hit", state, source, target, boonRule("frostglass-die").damage, "burn", events, {
      origin: "boon",
    });
  if (type === "water" && state.boons.includes("reef-diadem")) {
    const amount = Math.round(ensureCombat(source).thorns / boonRule("reef-diadem").divisor);
    if (amount > 0 && source.health > 0 && target.health > 0)
      yield* reaction("hit", state, source, target, amount, "nature", events, { origin: "boon" });
  }
}

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
  let visited: Set<string> | undefined;
  for (const entry of creaturePassiveTier(allied ? state : undefined, source.species).effects) {
    if (entry.kind !== "bounce" || entry.effect !== effect) continue;
    visited ??= new Set([first.id]);
    const visitedTargets = visited;
    for (let i = 0; i < entry.amount; i++) {
      if (source.health <= 0) return;
      // A previous bounce can remove a summoner and all of its Echoes.
      const eligible =
        effect === "heal"
          ? healingAllies(state, allied ? "player" : "enemy")
          : battlefield(state, allied ? "enemy" : "player");
      let eligibleCount = 0;
      for (const unit of eligible)
        if (
          unit.health > 0 &&
          !visitedTargets.has(unit.id) &&
          (effect !== "heal" || unit.health < maximumHealth(unit))
        )
          eligible[eligibleCount++] = unit;
      eligible.length = eligibleCount;
      if (!eligible.length) return;
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
  if (isDepartedMinion(state, target)) return undefined;
  if (
    value > 0 &&
    source.health > 0 &&
    target.health > 0 &&
    options.origin === "ability" &&
    !options.delivery
  ) {
    const candleLight = !isEnemy(source) && type === "light" && state.boons.includes("vow-candle");
    options = {
      ...options,
      blindMiss: options.blindMiss ?? (candleLight ? false : beginAttack(state, source, events)),
    };
    if (!options.interceptionChecked && !options.blindMiss)
      target = interceptAttack(state, source, target, events);
  }
  const negation =
    value > 0 && options.origin === "ability" && !options.blindMiss && !options.sharedDodge
      ? yield* reaction(
          "negateAttack",
          state,
          source,
          target,
          events,
          options.delivery !== "reflection",
          type,
          options.sharedNegate,
        )
      : false;
  if (negation === "negated") return undefined;
  if (
    value > 0 &&
    options.origin === "ability" &&
    !options.blindMiss &&
    !options.sharedDodge &&
    options.delivery !== "reflection" &&
    (negation === "reflected" || takeAttackReflection(source, target, events))
  ) {
    const recipients =
      isEnemy(source) && !isEnemy(target) && state.boons.includes("ripple-mirror")
        ? enemyReflectionRecipients(state, source)
        : [source];
    let primary: number | undefined;
    for (const recipient of recipients) {
      if (target.health <= 0 || recipient.health <= 0) continue;
      const result = yield* reaction("hit", state, target, recipient, value, type, events, {
        ...options,
        delivery: "reflection",
        interceptionChecked: true,
        blindMiss: false,
        cannotDodge: false,
      });
      if (recipient.id === source.id) primary = result;
    }
    return primary;
  }
  const policy = packetPolicyView(options);
  const wrongFoot =
    target.combat?.blind && policy.wrongFoot
      ? passiveAmount(isEnemy(source) ? undefined : state, source.species, "wrongFoot")
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
    policy.resonance
  ) {
    const recipient =
      target.health > 0
        ? target
        : !isEnemy(source) && state.boons.includes("dream-tangram")
          ? findLivingBattlefield(state, "enemy")
          : undefined;
    const chance = passiveAmount(isEnemy(source) ? undefined : state, source.species, "resonance");
    if (recipient && succeeds(state, chance / 100, isEnemy(source), events)) {
      emitSupport(events, source.id, {
        targetId: recipient.id,
        text: `${unitName(source)} repeats Stun damage with Resonance`,
      });
      // Repeat the packet once, retaining Stun buildup but suppressing attack proc chains.
      yield* reaction("hit", state, source, recipient, value, type, events, {
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
  const policy = packetPolicyView(options);
  if (
    (source.health <= 0 && !policy.deadSource) ||
    target.health <= 0 ||
    value <= 0 ||
    isDepartedMinion(state, target)
  )
    return { outcome: "ignored" };
  const { attack, direct } = policy;
  const context = {
    state,
    source,
    target,
    type,
    events,
    frozenAtStart: target.combat?.controlled === "freeze",
  };
  const leech = "leech" in options && options.leech;
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target);
  if (
    options.origin === "retaliation" &&
    options.thorns &&
    !isEnemy(source) &&
    ensureCombat(source).moonseedReady
  ) {
    ensureCombat(source).moonseedReady = false;
    value *= boonRule("moonseed").multiplier;
  }
  const playerHit = alliedSource && !alliedTarget;
  const playerAttack = attack && playerHit;
  const playerDirect = direct && playerHit;
  const bothAlive = () => source.health > 0 && target.health > 0;
  const stats = ensureCombat(target),
    before = target.health;
  const hadArmor = stats.armor > 0;
  const wasStunned = stats.controlled === "stun";
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
  const candleLight = alliedSource && type === "light" && state.boons.includes("vow-candle");
  const blindMiss =
    direct &&
    ((options.origin === "ability" ? options.blindMiss : undefined) ??
      (candleLight ? false : beginAttack(state, source, events)));
  const thornDodge =
    alliedTarget && "thorns" in options && options.thorns && state.boons.includes("rootvault-pole");
  let dodge: number | undefined;
  if (
    (direct || thornDodge) &&
    (blindMiss ||
      (options.origin === "ability" && options.sharedDodge === true) ||
      (!(options.origin === "ability" && options.sharedDodge === false) &&
        !("cannotDodge" in options && options.cannotDodge) &&
        !(
          playerDirect &&
          type === "freeze" &&
          stats.burn > 0 &&
          state.boons.includes("solstice-concertina")
        ) &&
        (dodge = dodgeChance(state, target)) > 0 &&
        succeeds(state, dodge / 100, !alliedTarget, events)))
  ) {
    if (
      playerHit &&
      target.block > 0 &&
      state.boons.includes("coral-net-weight") &&
      !(type === "bleed" && state.boons.includes("harvest-sickle"))
    ) {
      const payment = blockPayment(
        modifiedDamage(state, source, target, value, type, options, attack),
        target.block,
        blockEfficiency(state, target, type, source),
      );
      target.block -= payment.spent;
      if (payment.spent > 0) {
        const depletedBlock = target.block === 0;
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
            depletedBlock,
            critical: false,
          },
          false,
        );
      }
    }
    yield* dodgeResponse(context, !thornDodge);
    return { outcome: "miss" };
  }
  if (attack && alliedSource && !alliedTarget && type === "light" && state.boons.includes("moonseed"))
    ensureCombat(source).moonseedReady = true;
  if (type === "freeze" && stats.nullifyFreeze) {
    stats.nullifyFreeze = false;
    emitStatus(events, target.id, "nullify", "immune", {
      affectedStatus: "freeze",
      text: `${unitName(target)} nullifies Freeze damage`,
    });
    if (playerAttack && state.boons.includes("frostglass-die"))
      yield* reaction("hit", state, source, target, boonRule("frostglass-die").damage, "burn", events, {
        origin: "boon",
      });
    return { outcome: "landed", lost: 0, dealt: 0 };
  }
  if (playerAttack && type === "physical" && state.boons.includes("gilt-gauntlet")) {
    const { removed, depletion } = removeArmor(target, boonRule("gilt-gauntlet").armor);
    if (removed > 0) {
      events.push({
        kind: "status",
        actorId: source.id,
        targetId: target.id,
        status: "armor",
        outcome: "remove",
        amount: removed,
        text: `${unitName(source)} steals ${removed} Armor from ${unitName(target)}`,
      });
      yield* reaction("grantArmor", state, source, removed, events);
      if (state.boons.includes("orbit-tongs"))
        yield* reaction("armorStealRewards", state, source, removed, events);
      yield* reaction("triggerArmorBreak", state, depletion, events);
      if (source.health <= 0 || target.health <= 0) return { outcome: "landed", lost: 0, dealt: 0 };
    }
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
    !state.battle.meteoriteUsed &&
    state.boons.includes("meteorite")
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
  const ordinaryDamage = damage;
  if (critical) damage *= 2;
  const armorFirst =
    alliedTarget &&
    state.boons.includes("hoard-lockplate") &&
    armorApplies(state, target, type, source, options);
  let armorReducedDamage = false;
  if (armorFirst) {
    const reduced = armoredDamage(damage, stats.armor);
    armorReducedDamage = reduced < damage;
    damage = reduced;
  }
  const blockRatio = blockEfficiency(state, target, type, source);
  const bypassBlock =
    !alliedTarget &&
    ((type === "bleed" && state.boons.includes("harvest-sickle")) ||
      (alliedSource && "thorns" in options && options.thorns && state.boons.includes("comb-uncapping-fork")));
  const payment = blockPayment(damage, bypassBlock ? 0 : target.block, blockRatio);
  const blocked = payment.absorbed,
    blockSpent = payment.spent;
  target.block -= blockSpent;
  const depletedBlock = blocked > 0 && target.block === 0;
  damage = payment.remaining;
  if (playerAttack && (type === "physical" || type === "stun") && state.boons.includes("sundering-charm"))
    erode(boonRule("sundering-charm").armor);
  // Armor cannot change between these calculations; erosion above has already resolved.
  const appliesArmor = (!armorFirst || critical) && armorApplies(state, target, type, source, options);
  // Other mechanics use the hit before Block; Armor still mitigates their damage.
  const effectDamage =
    !armorFirst && appliesArmor ? armoredDamage(damage + blocked, stats.armor) : damage + blocked;
  if (alliedTarget && depletedBlock && damage > 0 && state.boons.includes("glassleaf-shield"))
    damage = Math.round(damage / boonRule("glassleaf-shield").divisor);
  if (!armorFirst && appliesArmor) {
    const reduced = armoredDamage(damage, stats.armor);
    armorReducedDamage = reduced < damage;
    damage = reduced;
  }
  const criticalBonusDamage = critical
    ? Math.max(0, effectDamage - (appliesArmor ? armoredDamage(ordinaryDamage, stats.armor) : ordinaryDamage))
    : 0;
  if (playerDirect && critical && state.boons.includes("crater-punch"))
    damage += Math.round(blocked / boonRule("crater-punch").divisor);
  if (alliedTarget && type === "burn" && state.boons.includes("hearth-coal"))
    damage = Math.min(damage, Math.max(0, target.health - boonRule("hearth-coal").minimum));
  const lost = loseHealth(state, target, damage, events);
  const dealt = Math.min(effectDamage, blocked + lost);
  if (
    armorReducedDamage &&
    !(alliedTarget && type === "poison" && state.boons.includes("nebula-weld-clamp")) &&
    !(alliedTarget && stats.grace > 0 && state.boons.includes("cypress-reliquary"))
  )
    erode(1);
  if (effectDamage > 0) {
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
  if (
    dealt > 0 &&
    playerHit &&
    options.origin === "retaliation" &&
    options.thorns &&
    source.health > 0 &&
    state.boons.includes("rootspool")
  )
    yield* reaction("leechHealth", state, source, dealt, events, stats.poison > 0 || stats.bleed > 0, target);
  if (
    playerAttack &&
    type === "light" &&
    depletedBlock &&
    bothAlive() &&
    state.boons.includes("suncrust-rolling-pin")
  )
    yield* applyResolvedStatus(state, source, target, 1, "blind", events);
  if (
    playerAttack &&
    type === "physical" &&
    hadArmor &&
    bothAlive() &&
    state.boons.includes("stardust-whetstone")
  ) {
    const result = yield* reaction(
      "applyHarmfulStatus",
      state,
      source,
      target,
      boonRule("stardust-whetstone").bleed,
      "bleed",
      events,
    );
    depletions.push(...result.depletions);
  }
  if (
    effectDamage > 0 &&
    playerHit &&
    "thorns" in options &&
    options.thorns &&
    bothAlive() &&
    state.boons.includes("resonance-kalimba")
  ) {
    const result = yield* reaction("applyHarmfulStatus", state, source, target, effectDamage, "stun", events);
    if (result.appliedControl) yield* reaction("controlRewards", state, source, target, "stun", events);
    depletions.push(...result.depletions);
  }
  if (
    effectDamage > 0 &&
    playerHit &&
    "thorns" in options &&
    options.thorns &&
    bothAlive() &&
    state.boons.includes("rosewax-seal")
  )
    yield* applyResolvedStatus(state, source, target, boonRule("rosewax-seal").bleed, "bleed", events);
  if (nextPhysical > 0 && source.health > 0)
    yield* reaction("hit", state, source, target, nextPhysical, "physical", events, { origin: "proc" });
  if (playerDirect && source.health > 0 && type === "water") {
    yield* waterFollowups(context, erode);
  }
  if (policy.buildup && effectDamage > 0 && source.health > 0) {
    const bleedBefore = stats.bleed;
    const statusResult = yield* reaction(
      "applyHarmfulStatus",
      state,
      source,
      target,
      effectDamage *
        (playerAttack && type === "burn" && blocked > 0 && state.boons.includes("chestnut-roaster")
          ? boonRule("chestnut-roaster").multiplier
          : 1),
      type,
      events,
      {
        leech,
        blocked: blocked > 0,
      },
    );
    depletions.push(...statusResult.depletions);
    if (playerAttack && type === "freeze" && state.boons.includes("moonpath-divider")) {
      const other = findLivingBattlefield(state, "enemy", (enemy) => enemy.id !== target.id);
      const amount = Math.round(effectDamage / boonRule("moonpath-divider").divisor);
      if (other && amount > 0) yield* applyResolvedStatus(state, source, other, amount, "freeze", events);
    }
    yield* poisonStun(context, effectDamage);
    if (playerDirect && source.health > 0)
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
      yield* reaction(
        "leechHealth",
        state,
        source,
        dealt,
        events,
        stats.poison > 0 || stats.bleed > 0,
        target,
      );
    if (statusResult.appliedControl && source.health > 0)
      yield* reaction("controlRewards", state, source, target, type, events);
  }
  if (!policy.buildup && effectDamage > 0) yield* poisonStun(context, effectDamage);
  if (playerHit && type === "burn" && dealt > 0 && target.health > 0 && state.boons.includes("ash-bowl")) {
    const removed = Math.min(stats.thorns, boonRule("ash-bowl").thorns);
    stats.thorns -= removed;
    if (removed)
      events.push({
        kind: "status",
        actorId: source.id,
        targetId: target.id,
        status: "thorns",
        outcome: "remove",
        amount: removed,
        text: `${unitName(target)} loses ${removed} Thorns`,
      });
  }
  if (
    playerAttack &&
    type === "burn" &&
    effectDamage > 0 &&
    source.health > 0 &&
    state.boons.includes("ember-platter")
  ) {
    for (const other of battlefield(state, "enemy"))
      if (other.id !== target.id && other.health > 0 && source.health > 0)
        yield* applyResolvedStatus(state, source, other, boonRule("ember-platter").burn, "burn", events);
  }
  if (playerAttack && type === "stun" && source.health > 0) {
    if (target.health > 0 && state.boons.includes("chime-crucible"))
      yield* applyResolvedStatus(state, source, target, boonRule("chime-crucible").burn, "burn", events);
    if (state.boons.includes("crystal-harp")) {
      ensureCombat(source).reflect = true;
      events.push({
        kind: "status",
        actorId: source.id,
        targetId: source.id,
        status: "reflect",
        outcome: "apply",
        text: `${unitName(source)} gains Reflect`,
      });
    }
  }
  yield* boonHitFollowups(state, source, target, type, events, options, attack);
  if (
    playerDirect &&
    type === "stun" &&
    wasStunned &&
    source.health > 0 &&
    state.boons.includes("acorn-skittle")
  ) {
    const other = findLivingBattlefield(state, "enemy", (enemy) => enemy.id !== target.id);
    if (other)
      yield* reaction("hit", state, source, other, boonRule("acorn-skittle").damage, "stun", events, {
        origin: "boon",
      });
  }
  if (criticalBonusDamage > 0 && playerHit && bothAlive() && state.boons.includes("eclipse-protractor")) {
    yield* applyResolvedStatus(state, source, target, criticalBonusDamage, "freeze", events);
  }
  // Absorbed critical hits still land; only damage-based procs require positive damage.
  if (
    effectDamage === 0 &&
    playerDirect &&
    type === "physical" &&
    critical &&
    source.health > 0 &&
    hasTalent(state, "physical.rupture")
  )
    yield* detonateBleed(state, source, target, events);
  if (effectDamage === 0 && direct && target.health > 0) yield* thornRetaliation(context);
  if (direct && alliedTarget && isEnemy(source) && state.boons.includes("pollen-basket")) {
    for (const ally of battlefield(state, "player")) {
      if (source.health <= 0) break;
      if (ally.id !== target.id && ally.health > 0)
        yield* thornRetaliation({ state, source, target: ally, events, type });
    }
  }
  if (direct) yield* passiveRetaliation(context, depletedBlock);
  for (const depletion of depletions) yield* reaction("triggerArmorBreak", state, depletion, events);
  if (
    (direct || options.origin === "overkill") &&
    playerHit &&
    target.health === 0 &&
    damage > before &&
    state.boons.includes("wonder-domino")
  ) {
    const recipient = findLivingBattlefield(state, "enemy");
    if (recipient)
      yield* reaction("hit", state, source, recipient, damage - before, type, events, { origin: "overkill" });
  }
  if (
    blocked > 0 &&
    type === "water" &&
    playerHit &&
    options.origin !== "chain" &&
    state.boons.includes("brookskip-disc")
  ) {
    const recipient = findLivingBattlefield(state, "enemy", (enemy) => enemy.id !== target.id);
    if (recipient)
      yield* reaction("hit", state, source, recipient, blocked, "water", events, { origin: "chain" });
  }
  if (
    blockSpent > 0 &&
    direct &&
    !alliedSource &&
    alliedTarget &&
    bothAlive() &&
    state.boons.includes("fallingstar-anvil")
  ) {
    yield* applyResolvedStatus(
      state,
      target,
      source,
      Math.round(blockSpent / boonRule("fallingstar-anvil").divisor),
      "stun",
      events,
    );
  }
  return { outcome: "landed", lost, dealt };
}

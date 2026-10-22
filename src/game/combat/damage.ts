import { interceptAttack } from "./interception";
import { chance as succeeds } from "../chance";
import { isEnemy, battlefield } from "../battlefield";
import { packetPolicy, type DamagePacket, type AttackPacket } from "./policy";
import { roll } from "../random";
import { draw, drawKeyword } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";
import { physicalBonus } from "../ability-rules";
import type { DamageType } from "../content";
import type { GameEvent, GameState } from "../types";
import {
  combat,
  maximumHealth,
  unitName,
  mostInjured,
  loseHealth,
  deferLeech,
  dodgeChance,
  beginAttack,
  STACK_LIMIT,
  removeArmor,
  gainGold,
  type ArmorDepletion,
  type Combatant,
} from "./state";
import { reaction, type Resolution } from "./operations";

type HitResult = { outcome: "ignored" | "miss" } | { outcome: "landed"; lost: number };

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
      if (entry.chance !== undefined && !succeeds(state, entry.chance, !allied, action.events)) return;
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
    options.origin === "ability" &&
    !options.delivery &&
    !options.interceptionChecked &&
    !options.blindMiss
  )
    target = interceptAttack(state, source, target, events);
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
    lost > 0 &&
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
  const leech = "leech" in options && options.leech;
  const cardLeech = "cardLeech" in options && options.cardLeech;
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target);
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
    direct &&
    ((options.origin === "ability" ? options.blindMiss : undefined) ?? beginAttack(state, source, events));
  if (
    direct &&
    (blindMiss ||
      (dodgeChance(state, target) > 0 &&
        succeeds(state, dodgeChance(state, target) / 100, !alliedTarget, events)))
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
        yield* reaction("removeControlBuildup", state, target, "stun", events);
        yield* reaction("removeControlBuildup", state, target, "freeze", events);
      }
      if (hasTalent(state, "dodge.tailwind")) draw(state, 1, events);
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
    direct &&
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
    const protectors = battlefield(state, alliedTarget ? "player" : "enemy");
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
    direct && (riposte || (criticalChance > 0 && succeeds(state, criticalChance, !alliedSource, events)));
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
    if (type === "poison" && state.boons.includes("parasitic-bloom") && succeeds(state, 0.1, false, events))
      yield* reaction("leechHealth", state, source, lost, events, true);
    if (
      attack &&
      type === "nature" &&
      state.boons.includes("lucky-clover") &&
      succeeds(state, 0.1, false, events)
    )
      gainGold(state, lost, events);
    if (
      attack &&
      type === "light" &&
      state.boons.includes("brass-censer") &&
      succeeds(state, 0.2, false, events)
    ) {
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
    if (hasTalent(state, "water.cleansing-current") && succeeds(state, 0.2, false, events))
      yield* reaction("removeEffects", source, "cleanse", 1, events, state);
    if (hasTalent(state, "water.riptide") && succeeds(state, 0.2, false, events))
      drawKeyword(state, "water", events);
  }
  if (policy.buildup && damage > 0 && source.health > 0) {
    const bleedBefore = stats.bleed;
    const statusResult = yield* reaction("applyHarmfulStatus", state, source, target, damage, type, events, {
      leech,
    });
    depletions.push(...statusResult.depletions);
    if (direct && alliedSource && !alliedTarget && source.health > 0) {
      if (
        type === "nature" &&
        hasTalent(state, "nature.bramblegrowth") &&
        succeeds(state, 0.1, false, events)
      )
        yield* reaction("grantStatus", source, "thorns", damage, events, state);
      if (
        type === "light" &&
        lost > 0 &&
        hasTalent(state, "light.faith-barrier") &&
        succeeds(state, 0.1, false, events)
      )
        yield* reaction("grantBlock", state, source, lost, events);
    }
    if (direct && alliedSource && !alliedTarget && source.health > 0) {
      const proc = (id: import("../content").TalentId, chance: number) =>
        source.health > 0 && hasTalent(state, id) && succeeds(state, chance, false, events);

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
        if (proc("bleed.bloodrush", 0.1)) draw(state, 1, events);
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
        if (!statusResult.suppressed) deferLeech(target, source, Math.max(0, stats.bleed - bleedBefore));
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

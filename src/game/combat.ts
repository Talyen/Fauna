import { cardKeywords, hasTalent } from "./progression";
import { physicalBonus } from "./rules";
import { species, type DamageType } from "./content";
import type { CombatState, Creature, Enemy, GameEvent, GameState } from "./types";

export const TURN_MANA = 4;
export const TURN_DRAW = 4;
export const HAND_LIMIT = 7;
const STACK_LIMIT = 1_000_000;
export type Combatant = Creature | Enemy;
export function freshCombat(): CombatState {
  return {
    controlTurns: 0,
    rhythm: 0,
    nextPhysical: 0,
    partingCut: false,
    riposte: false,
    freeNature: false,
    freeLight: false,
    freeCard: false,
    desperateGuardUsed: false,
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
const maximumHealth = (unit: Combatant) =>
  "maxHealth" in unit ? unit.maxHealth : species(unit.species).health;
const unitName = (unit: Combatant) => ("name" in unit ? unit.name : species(unit.species).name);
export const controlled = (unit: Combatant) => !!unit.combat?.controlled || !!unit.combat?.skipped;
export function restoreHealth(
  unit: Combatant,
  amount: number,
  events: GameEvent[],
  revive = false,
  state?: GameState,
  cardHealing = false,
) {
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
    if (hasTalent(state, "health.overflow")) grantBlock(state, unit, Math.round(excess * 0.25), events);
    if (hasTalent(state, "health.clean-slate")) removeEffects(unit, "cleanse", 1, events, state);
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
      grantStatus(unit, "thorns", 1, events);
  }
}
export function grantBlock(state: GameState, unit: Combatant, amount: number, events: GameEvent[]) {
  if (unit.health <= 0 || amount <= 0) return;
  const gained = Math.min(STACK_LIMIT - unit.block, Math.round(amount));
  unit.block += gained;
  events.push({
    kind: "block",
    targetId: unit.id,
    amount: gained,
    text: `${unitName(unit)} gains ${gained} Block.`,
  });
  if (!gained) return;
  if (!("maxHealth" in unit) && hasTalent(state, "light.radiant-guard") && roll(state) < 0.1)
    drawKeyword(state, "light");
  if (!("maxHealth" in unit) && state.boons.includes("ironwood-buckler"))
    grantStatus(unit, "thorns", 1, events);
}
export function gainMana(state: GameState, amount: number, events: GameEvent[]) {
  if (!state.battle || amount <= 0) return;
  const gained = Math.min(amount, state.battle.maxMana - state.battle.mana);
  state.battle.mana += gained;
  if (gained > 0) {
    events.push({ kind: "status", amount: gained, text: `Gain ${gained} Mana.` });
    if (hasTalent(state, "mana.arcane-mending"))
      for (const unit of state.team) restoreHealth(unit, gained, events, false, state);
  }
}
function gainGold(state: GameState, amount: number, events: GameEvent[]) {
  if (!state.battle) return;
  const gained = Math.min(Math.max(0, Math.round(amount)), STACK_LIMIT - state.currency);
  state.currency += gained;
  state.battle.earnedGold += gained;
  if (state.journey) state.journey.currency = Math.min(STACK_LIMIT, state.journey.currency + gained);
  if (gained) events.push({ kind: "reward", amount: gained, text: `Gain ${gained} Gold.` });
}
export function drawKeyword(state: GameState, keyword: "light" | "nature") {
  const battle = state.battle;
  if (!battle) return;
  fillHand(state);
  const eligible = (id: string) => {
    const card = state.cards.find((c) => c.id === id)!;
    return (
      state.team.some((c) => c.id === card.ownerId && c.health > 0) && cardKeywords(card).includes(keyword)
    );
  };
  if (!battle.draw.some(eligible)) {
    const available = battle.discard.filter(eligible);
    battle.discard = battle.discard.filter((id) => !eligible(id));
    battle.draw.push(...shuffle(state, available));
  }
  let index = battle.draw.length - 1;
  while (index >= 0 && !eligible(battle.draw[index]!)) index--;
  if (index >= 0) {
    const id = battle.draw.splice(index, 1)[0]!;
    (battle.hand.length < HAND_LIMIT ? battle.hand : battle.buffer).push(id);
  }
}
export function grantArmor(state: GameState, unit: Combatant, amount: number, events: GameEvent[]) {
  if (unit.health <= 0 || amount <= 0) return;
  const allied = !("maxHealth" in unit),
    before = combat(unit).armor;
  if (allied) {
    if (hasTalent(state, "armor.last-stand") && unit.health < maximumHealth(unit) / 2) amount *= 1.25;
    if (hasTalent(state, "armor.reinforced") && roll(state) < 0.1) amount *= 2;
  }
  grantStatus(unit, "armor", Math.round(amount), events);
  if (allied && combat(unit).armor > before && hasTalent(state, "armor.purification") && roll(state) < 0.1)
    removeEffects(unit, "cleanse", 1, events, state);
}
function leechHealth(
  state: GameState,
  unit: Combatant,
  lost: number,
  events: GameEvent[],
  afflicted = false,
) {
  if (lost <= 0) return;
  let amount = Math.round(lost / 2);
  if (!("maxHealth" in unit)) {
    if (afflicted && hasTalent(state, "leech.affliction-siphon")) amount *= 1.1;
    if (hasTalent(state, "leech.deep-siphon")) amount++;
    if (hasTalent(state, "leech.desperate-siphon") && unit.health < maximumHealth(unit) / 2) amount *= 2;
  }
  const before = unit.health;
  restoreHealth(unit, amount, events, false, state);
  const restored = unit.health - before;
  if (!("maxHealth" in unit) && restored > 0) {
    if (hasTalent(state, "leech.blood-debt") && roll(state) < 0.1) gainGold(state, restored, events);
    if (
      hasTalent(state, "leech.sanguine-overflow") &&
      before < maximumHealth(unit) &&
      unit.health === maximumHealth(unit)
    )
      gainMana(state, 1, events);
    if (hasTalent(state, "leech.bloodletting") && roll(state) < 0.1)
      removeEffects(unit, "cleanse", 1, events, state);
    if (hasTalent(state, "leech.mana-siphon") && roll(state) < 0.1) gainMana(state, 1, events);
  }
}
function loseHealth(state: GameState, unit: Combatant, amount: number, events: GameEvent[]) {
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
      stats.grace = hasTalent(state, "health.will-to-live") ? 3 : 2;
      events.push({
        kind: "status",
        targetId: unit.id,
        status: "deathDoor",
        outcome: "apply",
        text: `${unitName(unit)} reaches Death's Door: ${stats.grace} grace turns.`,
      });
    }
    unit.health = 1;
  }
  const lost = before - unit.health;
  return lost;
}
function healthThresholds(state: GameState, unit: Combatant, before: number, events: GameEvent[]) {
  const stats = combat(unit);
  if (!("maxHealth" in unit) && unit.health > 0) {
    if (before >= maximumHealth(unit) / 2 && unit.health < maximumHealth(unit) / 2) {
      if (hasTalent(state, "armor.steadfast")) grantArmor(state, unit, 3, events);
      if (hasTalent(state, "health.desperate-guard") && !stats.desperateGuardUsed) {
        stats.desperateGuardUsed = true;
        grantBlock(state, unit, 6, events);
      }
    }
    if (
      before >= maximumHealth(unit) / 4 &&
      unit.health < maximumHealth(unit) / 4 &&
      hasTalent(state, "health.last-resort")
    )
      removeEffects(unit, "cleanse", 6, events, state);
  }
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
      status,
      outcome: "gain",
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
  const removedStatuses: NonNullable<GameEvent["affectedStatus"]>[] = [];
  const statuses =
    kind === "cleanse"
      ? (["burn", "poison", "bleed", "stun", "freeze"] as const)
      : (["armor", "thorns", "dodge"] as const);
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
    if (count > 0 && stats[status] > 0) {
      stats[status] = 0;
      if (kind === "cleanse") {
        cleansed++;
        delete stats.statusSources[status as "burn" | "poison" | "bleed"];
      }
      if (status === "bleed") stats.bleedLeech = [];
      count--;
      removedStatuses.push(status);
    }
  for (const affectedStatus of new Set(removedStatuses))
    events.push({
      kind: "status",
      targetId: unit.id,
      status: kind,
      outcome: "remove",
      affectedStatus,
      text: `${unitName(unit)}: ${kind === "cleanse" ? "Cleanse" : "Purge"} ${affectedStatus}.`,
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
  if (cleansed > 0 && state) cleanseRewards(state, unit, cleansed, events);
}
function cleanseRewards(state: GameState, unit: Combatant, cleansed: number, events: GameEvent[]) {
  const stats = combat(unit);
  if (!("maxHealth" in unit)) {
    if (hasTalent(state, "light.divine-favor")) stats.freeLight = true;
    const healing =
      Number(hasTalent(state, "health.renewal")) * 2 + (state.boons.includes("sin-eaters-lantern") ? 6 : 0);
    if (healing) restoreHealth(unit, healing * cleansed, events, false, state);
  }
}
function deferLeech(target: Combatant, source: Combatant, amount: number) {
  const stats = combat(target);
  const entry = stats.bleedLeech.find((payout) => payout.sourceId === source.id);
  const available = Math.max(0, stats.bleed - stats.bleedLeech.reduce((sum, row) => sum + row.amount, 0));
  const gained = Math.min(amount, available);
  if (entry) entry.amount += gained;
  else if (gained) stats.bleedLeech.push({ sourceId: source.id, amount: gained });
}
/** One attack packet. Periodic and retaliation packets never dodge, crit, build statuses, or retaliate. */
export function hit(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  events: GameEvent[],
  options: {
    periodic?: boolean;
    retaliation?: boolean;
    derived?: boolean;
    leech?: boolean;
    cardLeech?: boolean;
    proc?: boolean;
  } = {},
) {
  if ((source.health <= 0 && !options.periodic && !options.derived) || target.health <= 0 || value <= 0)
    return;
  const attack = !options.periodic && !options.retaliation && !options.derived;
  const direct = attack && !options.proc;
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
    direct &&
    !stats.controlled &&
    !(!alliedTarget && stats.poison > 0 && hasTalent(state, "poison.torpor")) &&
    roll(state) <
      Math.min(
        75,
        5 +
          stats.dodge +
          (alliedTarget
            ? stats.rhythm +
              (hasTalent(state, "dodge.lightfoot") ? 5 : 0) +
              (hasTalent(state, "health.last-gasp") && target.health < maximumHealth(target) / 2 ? 10 : 0)
            : 0),
      ) /
        100
  ) {
    events.push({
      kind: "status",
      targetId: target.id,
      status: "dodge",
      outcome: "dodge",
      text: `${unitName(target)} Dodges.`,
    });
    if (alliedTarget && hasTalent(state, "dodge.catch-breath"))
      restoreHealth(target, 1, events, false, state);
    if (alliedTarget) {
      stats.rhythm = 0;
      if (hasTalent(state, "dodge.thornstep")) grantStatus(target, "thorns", 1, events);
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
      if (hasTalent(state, "dodge.perfect-timing") && stats.armor === 0) grantArmor(state, target, 2, events);
      if (hasTalent(state, "block.footwork")) grantBlock(state, target, 2, events);
      if (hasTalent(state, "bleed.parting-cut")) stats.partingCut = true;
      if (hasTalent(state, "physical.riposte")) stats.riposte = true;
      if (hasTalent(state, "nature.windstep")) stats.freeNature = true;
      if (hasTalent(state, "burn.smoke-screen") && combat(source).burn > 0)
        hit(state, target, source, 2, "burn", events, { proc: true });
    }
    if (alliedTarget) state.battleXP.dodge = Math.min(STACK_LIMIT, (state.battleXP.dodge ?? 0) + 1);
    return;
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
    if (
      options.cardLeech &&
      target.health < maximumHealth(target) / 2 &&
      hasTalent(state, "leech.cull-the-weak")
    )
      damage *= 1.25;
    if (type === "bleed" && stats.bleed === 0 && hasTalent(state, "bleed.first-blood")) damage *= 1.25;
  }
  if (alliedSource && !alliedTarget && !options.retaliation) {
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
  damage = Math.round(damage);
  const riposte = direct && alliedSource && type === "physical" && combat(source).riposte;
  const critical = direct && alliedSource && (riposte || roll(state) < 0.05);
  if (riposte) combat(source).riposte = false;
  const partingCut = direct && alliedSource && type === "physical" && combat(source).partingCut;
  if (partingCut) combat(source).partingCut = false;
  if (critical) damage *= 2;
  const blockRatio = alliedTarget && type === "physical" && hasTalent(state, "block.reinforce") ? 1.1 : 1;
  const blocked = options.periodic ? 0 : Math.min(Math.round(target.block * blockRatio), damage);
  target.block -= Math.min(target.block, Math.ceil(blocked / blockRatio));
  const depletedBlock = blocked > 0 && target.block === 0;
  damage -= blocked;
  if (
    attack &&
    alliedSource &&
    !alliedTarget &&
    state.boons.includes("sundering-charm") &&
    (type === "physical" || type === "stun")
  )
    stats.armor = Math.max(0, stats.armor - 2);
  if (
    type === "physical" ||
    type === "stun" ||
    (alliedTarget &&
      ((type === "burn" && hasTalent(state, "armor.fireward")) ||
        (type === "bleed" && hasTalent(state, "armor.thick-hide"))))
  )
    damage = Math.max(0, damage - stats.armor);
  const armorBefore = stats.armor;
  const lost = loseHealth(state, target, damage, events);
  if (damage > 0) {
    stats.armor = Math.max(0, stats.armor - 1);
    if (alliedSource && type === "poison" && hasTalent(state, "poison.caustic"))
      stats.armor = Math.max(0, stats.armor - damage);
    if (alliedSource && type === "burn" && hasTalent(state, "burn.melting-point"))
      stats.armor = Math.max(0, stats.armor - damage);
    if (alliedTarget && armorBefore > 0 && stats.armor === 0 && hasTalent(state, "armor.reactive-guard"))
      grantBlock(state, target, 3, events);
  }
  if (lost > 0) healthThresholds(state, target, before, events);
  if (alliedTarget && lost > 0 && hasTalent(state, "dodge.finding-rhythm"))
    stats.rhythm = Math.min(70, stats.rhythm + 5);
  if (alliedTarget && depletedBlock && attack && hasTalent(state, "block.sun-struck-shield"))
    hit(state, target, source, Math.round(blocked * 0.3), "light", events, { derived: true });
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
    critical,
    periodic: options.periodic === true,
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
    restoreHealth(source, 3, events, false, state);
  if (alliedSource && !alliedTarget && lost > 0) {
    if (type === "bleed" && state.boons.includes("cutpurse-knife")) gainGold(state, 1, events);
    if (type === "poison" && state.boons.includes("parasitic-bloom") && roll(state) < 0.1)
      leechHealth(state, source, lost, events, true);
    if (attack && type === "nature" && state.boons.includes("lucky-clover") && roll(state) < 0.1)
      gainGold(state, lost, events);
    if (attack && type === "light" && state.boons.includes("brass-censer") && roll(state) < 0.2) {
      if (roll(state) < 0.5) hit(state, source, target, damage, "burn", events, { proc: true });
      else leechHealth(state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
    }
  }
  if (nextPhysical > 0 && source.health > 0)
    hit(state, source, target, nextPhysical, "physical", events, { proc: true });
  if (attack && damage > 0) {
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
        ("maxHealth" in target ? before : maximumHealth(target)) *
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
          if (type === "freeze" && hasTalent(state, "freeze.brittle-armor")) stats.armor = 0;
          if (type === "stun" && hasTalent(state, "stun.free-follow-up")) combat(source).freeCard = true;
          if (type === "stun" && hasTalent(state, "stun.stun-insight")) draw(state, 1);
          if (type === "stun" && hasTalent(state, "stun.stun-surge") && state.battle?.mana === 0)
            gainMana(state, 1, events);
          if (type === "freeze" && hasTalent(state, "freeze.glacial-barrier"))
            grantBlock(state, source, 3, events);
          if (type === "stun" && hasTalent(state, "stun.guarded-counter") && source.block === 0)
            grantBlock(state, source, 4, events);
          if (type === "stun" && hasTalent(state, "stun.shatter-guard")) stats.armor = 0;
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
    if (direct && alliedSource && !alliedTarget && source.health > 0) {
      if (type === "nature" && hasTalent(state, "nature.bramblegrowth") && roll(state) < 0.1)
        grantStatus(source, "thorns", damage, events);
      if (type === "light" && lost > 0 && hasTalent(state, "light.faith-barrier") && roll(state) < 0.1)
        grantBlock(state, source, lost, events);
    }
    if (direct && alliedSource && !alliedTarget && source.health > 0) {
      const proc = (id: import("./progression").TalentId, chance: number) =>
        hasTalent(state, id) && roll(state) < chance;
      const extra = (kind: DamageType, amount = damage) =>
        hit(state, source, target, amount, kind, events, { proc: true });
      if (type === "physical") {
        if (proc("physical.heavy-blows", 0.1)) extra("stun");
        if (proc("physical.lacerate", 0.1)) extra("bleed");
        if (proc("armor.iron-guard", 0.1)) grantArmor(state, source, damage, events);
        if (partingCut) extra("bleed", Math.round(damage / 2));
        if (critical && hasTalent(state, "physical.rupture") && stats.bleed > 0) {
          const bleed = stats.bleed;
          const payouts = stats.bleedLeech;
          stats.bleed = 0;
          stats.bleedLeech = [];
          delete stats.statusSources.bleed;
          let remaining = hit(state, source, target, bleed, "bleed", events, { periodic: true }) ?? 0;
          for (const payout of payouts) {
            const owner = [...state.team, ...state.reserves].find((unit) => unit.id === payout.sourceId);
            const paid = Math.min(remaining, payout.amount);
            if (owner) leechHealth(state, owner, paid, events, true);
            remaining -= paid;
          }
        }
      }
      if (type === "nature") {
        if (proc("nature.thornskin", 0.1)) grantArmor(state, source, damage, events);
        if (proc("nature.photosynthesis", 0.1)) restoreHealth(source, damage, events, false, state);
        if (proc("nature.briar-patch", 0.1)) extra("bleed");
        if (proc("nature.toxic-pollen", 0.1)) extra("poison");
        if (proc("nature.entangle", 0.1)) extra("stun");
      }
      if (type === "burn" && proc("burn.heat-exhaustion", 0.1)) extra("stun");
      if (type === "poison") {
        if (proc("poison.hemotoxin", 0.1)) extra("bleed");
        if (proc("poison.paralytic-venom", 0.1)) extra("stun");
      }
      if (type === "bleed") {
        if (proc("bleed.flay", 0.2)) stats.armor = Math.round(stats.armor / 2);
        if (proc("bleed.tainted-wound", 0.1)) extra("poison", Math.round(damage / 2));
        if (proc("bleed.bloodrush", 0.1)) draw(state, 1);
      }
      if (type === "light") {
        if (proc("light.scorching-light", 0.1)) extra("burn");
        if (lost > 0 && proc("light.tithe", 0.1)) gainGold(state, lost, events);
      }
      const chanceLeech =
        (type === "bleed" && proc("bleed.sanguine", 0.1)) ||
        (type === "poison" && proc("leech.virulent-leech", 0.1)) ||
        (type === "nature" && proc("nature.verdant-cycle", 0.1));
      if (chanceLeech && type === "bleed" && !options.leech) deferLeech(target, source, damage);
      else if (chanceLeech && !options.leech && !blessedLeech)
        leechHealth(state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
    }
    // Captured damage remains valid even if retaliation later removes the attacker.
    if (direct && lost > 0 && stats.thorns > 0 && target.health > 0) {
      const reflected = stats.thorns;
      stats.thorns--;
      hit(state, target, source, reflected, "nature", events, { retaliation: true });
    }
    if ((options.leech || blessedLeech) && type !== "bleed" && source.health > 0)
      leechHealth(state, source, lost, events, stats.poison > 0 || stats.bleed > 0);
    if (appliedControl && alliedSource && !alliedTarget) {
      if (type === "freeze" && state.boons.includes("icy-heart"))
        hit(state, source, target, 6, "physical", events, { derived: true });
      if (type === "stun" && state.boons.includes("thunderstone"))
        hit(state, source, target, 6, "nature", events, { derived: true });
    }
  }
  return lost;
}
export function tickStatuses(state: GameState, unit: Combatant, events: GameEvent[]) {
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
      cleanseRewards(state, unit, 1, events);
    }
    const target = state.battle!.enemies.find((enemy) => enemy.health > 0);
    if (target) hit(state, unit, target, Math.round(removed / 2), "poison", events, { proc: true });
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
    const lost = hit(state, source, unit, amount, status, events, { periodic: true }) ?? 0;
    stats[status] =
      status === "bleed"
        ? 0
        : status === "burn"
          ? amount <= 1
            ? 0
            : Math.round(amount / 2)
          : Math.max(0, amount - Math.max(1, Math.round(amount * 0.2)));
    if (status === "bleed") {
      let remaining = lost;
      for (const payout of stats.bleedLeech) {
        const source = [...state.team, ...state.reserves, ...state.battle!.enemies].find(
          (c) => c.id === payout.sourceId,
        );
        const paid = Math.min(remaining, payout.amount);
        if (source) leechHealth(state, source, paid, events, true);
        remaining -= paid;
      }
      stats.bleedLeech = [];
    }
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
export function startAction(unit: Combatant, events: GameEvent[], state?: GameState) {
  const stats = combat(unit);
  stats.skipped = !!stats.controlled;
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

export function shuffle<T>(state: GameState, cards: T[]): T[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(roll(state) * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}
export function fillHand(state: GameState) {
  const battle = state.battle!;
  while (battle.hand.length < HAND_LIMIT && battle.buffer.length) battle.hand.push(battle.buffer.shift()!);
}
export function draw(state: GameState, count: number) {
  fillHand(state);
  const b = state.battle!;
  // Knocked-out owners retain inert slots, so replacing them cannot refresh spent cards.
  const alive = state.team.filter((c) => c.health > 0);
  const eligible = (id: string) =>
    !alive.length || alive.some((c) => c.id === state.cards.find((card) => card.id === id)?.ownerId);
  for (let i = 0; i < count; i++) {
    if (!b.draw.some(eligible)) {
      const available = b.discard.filter(eligible);
      b.discard = b.discard.filter((id) => !eligible(id));
      b.draw.push(...shuffle(state, available));
    }
    let index = b.draw.length - 1;
    while (index >= 0 && !eligible(b.draw[index]!)) index--;
    if (index < 0) break;
    const card = b.draw.splice(index, 1)[0]!;
    if (b.hand.length < HAND_LIMIT) b.hand.push(card);
    else b.buffer.push(card);
  }
}

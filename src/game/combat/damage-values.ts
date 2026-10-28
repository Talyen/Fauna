import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { isEnemy, battlefieldView } from "../battlefield";
import { hasTalent, creaturePassiveTier } from "../progression";
import { physicalBonus } from "../ability-rules";
import type { DamageType } from "../content";
import type { GameState } from "../types";
import type { DamagePacket } from "./policy";
import { maximumHealth, harmfulStatuses, type Combatant } from "./state";

/** Current attack facts only; no RNG, flag consumption, events or child reactions. */
export function modifiedDamage(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  options: DamagePacket,
  attack: boolean,
) {
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target);
  const stats = target.combat!;
  const cardLeech = "cardLeech" in options && options.cardLeech;
  let damage = value;
  if (
    options.origin === "ability" &&
    alliedSource &&
    !alliedTarget &&
    state.boons.includes("chromatic-viol")
  ) {
    let count = 0;
    for (const status of harmfulStatuses)
      if (stats.controlled === status || Number(stats[status]) > 0) count++;
    damage += count * boonRule("chromatic-viol").damage;
  }
  if (attack && alliedSource) {
    if (type === "water") {
      if (hasTalent(state, "water.pressure")) damage += talentRule("water.pressure").amount;
      if (source.block > 0 && hasTalent(state, "water.high-tide"))
        damage *= 1 + talentRule("water.high-tide").percent / 100;
    }
    if (type === "physical") damage += physicalBonus(source, state);
    if (type === "physical" && hasTalent(state, "block.weighted-guard"))
      damage += source.block * (talentRule("block.weighted-guard").percent / 100);
    if (type === "light" && hasTalent(state, "block.sacred-shield"))
      damage += source.block * (talentRule("block.sacred-shield").percent / 100);
    if (type === "stun" && hasTalent(state, "block.impact-guard"))
      damage += source.block * (talentRule("block.impact-guard").percent / 100);
    if (
      type === "physical" &&
      hasTalent(state, "physical.finish-him") &&
      target.health < maximumHealth(target) / (100 / talentRule("physical.finish-him").percent)
    )
      damage *= 2;
    if (
      type === "physical" &&
      hasTalent(state, "physical.unrelenting") &&
      source.health < maximumHealth(source) / 2
    )
      damage *= 2;
    if (
      type === "bleed" &&
      hasTalent(state, "bleed.bleeding-out") &&
      source.health < maximumHealth(source) / 2
    )
      damage *= 1 + talentRule("bleed.bleeding-out").percent / 100;
    if (type === "burn" && hasTalent(state, "mana.manaburn"))
      damage += (state.battle?.mana ?? 0) * (talentRule("mana.manaburn").percent / 100);
    if (type === "freeze" && hasTalent(state, "mana.arcane-frost"))
      damage += (state.battle?.mana ?? 0) * (talentRule("mana.arcane-frost").percent / 100);
    if (type === "light" && hasTalent(state, "light.prosperity"))
      damage += state.currency * (talentRule("light.prosperity").percent / 100);
    if (type === "light" && stats.burn > 0 && hasTalent(state, "light.purge"))
      damage *= 1 + talentRule("light.purge").percent / 100;
    if (cardLeech && hasTalent(state, "leech.cull-the-weak") && target.health < maximumHealth(target) / 2)
      damage *= 1 + talentRule("leech.cull-the-weak").percent / 100;
    if (type === "bleed" && stats.bleed === 0 && hasTalent(state, "bleed.first-blood"))
      damage *= 1 + talentRule("bleed.first-blood").percent / 100;
  }
  if (
    alliedSource &&
    !alliedTarget &&
    options.origin !== "overkill" &&
    options.origin !== "retaliation" &&
    options.origin !== "statusRetaliation"
  ) {
    if (stats.poison > 0 && hasTalent(state, "poison.corrosive"))
      damage += talentRule("poison.corrosive").amount;
    if (stats.controlled === "freeze" && hasTalent(state, "freeze.brittle-ice"))
      damage += talentRule("freeze.brittle-ice").amount;
    if (stats.controlled === "stun" && hasTalent(state, "stun.exploit-weakness")) damage *= 2;
    if (type === "poison" && stats.bleed > 0 && hasTalent(state, "bleed.septic-shock"))
      damage *= 1 + talentRule("bleed.septic-shock").percent / 100;
  }
  if (alliedTarget) {
    if (
      stats.nullify &&
      state.boons.includes("paper-lotus") &&
      (type === "burn" || type === "poison" || type === "bleed")
    )
      damage /= boonRule("paper-lotus").divisor;
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
    const protectors = battlefieldView(state, alliedTarget ? "player" : "enemy");
    // Use the strongest deployed protection; swaps and knockouts change it immediately.
    const deployed = protectors.some((unit) => unit.id === target.id);
    const resistanceKind = type === "burn" ? "teamBurnResistance" : "teamFreezeResistance";
    let resistance = 0;
    if (deployed) {
      for (const unit of protectors) {
        if (unit.health <= 0) continue;
        for (const effect of creaturePassiveTier(alliedTarget ? state : undefined, unit.species).effects)
          if (effect.kind === resistanceKind) resistance = Math.max(resistance, effect.amount);
      }
      damage *= 1 - Math.min(100, resistance) / 100;
    }
  }
  damage = Math.round(damage);
  return damage;
}

export function blockPayment(damage: number, block: number, ratio = 1) {
  const absorbed = Math.min(Math.round(block * ratio), damage);
  return { absorbed, spent: Math.min(block, Math.ceil(absorbed / ratio)), remaining: damage - absorbed };
}
export const armoredDamage = (damage: number, armor: number) => Math.max(0, damage - armor);
export function blockEfficiency(state: GameState, target: Combatant, type: DamageType, source?: Combatant) {
  if (
    isEnemy(target) &&
    source &&
    !isEnemy(source) &&
    type === "stun" &&
    state.boons.includes("asteroid-hammer")
  )
    return boonRule("asteroid-hammer").multiplier;
  if (!isEnemy(target)) {
    if (type === "burn" && state.boons.includes("moss-oven-mitt"))
      return boonRule("moss-oven-mitt").multiplier;
    if (type === "water" && state.boons.includes("rain-cape")) return boonRule("rain-cape").multiplier;
    if (type === "physical" && hasTalent(state, "block.reinforce"))
      return 1 + talentRule("block.reinforce").percent / 100;
  }
  return 1;
}
export function armorApplies(
  state: GameState,
  target: Combatant,
  type: DamageType,
  source?: Combatant,
  packet?: DamagePacket,
) {
  if (
    !isEnemy(target) &&
    packet &&
    "thorns" in packet &&
    packet.thorns &&
    state.boons.includes("gemmed-scabbard")
  )
    return true;
  if (
    type === "physical" &&
    source &&
    !isEnemy(source) &&
    isEnemy(target) &&
    (target.combat?.stun ?? 0) > 0 &&
    state.boons.includes("tuning-fork-charm")
  )
    return false;
  return (
    type === "physical" ||
    type === "stun" ||
    (!isEnemy(target) &&
      ((type === "poison" && state.boons.includes("nebula-weld-clamp")) ||
        (type === "burn" && hasTalent(state, "armor.fireward")) ||
        (type === "bleed" && hasTalent(state, "armor.thick-hide"))))
  );
}

import { isEnemy, battlefield } from "../battlefield";
import { hasTalent, creaturePassive } from "../progression";
import { physicalBonus } from "../ability-rules";
import type { DamageType } from "../content";
import type { GameState } from "../types";
import type { DamagePacket } from "./policy";
import { packetPolicy } from "./policy";
import { maximumHealth, type Combatant } from "./state";

/** Current attack facts only; no RNG, flag consumption, events or child reactions. */
export function modifiedDamage(
  state: GameState,
  source: Combatant,
  target: Combatant,
  value: number,
  type: DamageType,
  options: DamagePacket,
) {
  const { attack } = packetPolicy(options);
  const alliedSource = !isEnemy(source),
    alliedTarget = !isEnemy(target);
  const stats = target.combat!;
  const cardLeech = "cardLeech" in options && options.cardLeech;
  let damage = value;
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
  return damage;
}

export function blockPayment(damage: number, block: number, ratio = 1, bypass = false) {
  const absorbed = bypass ? 0 : Math.min(Math.round(block * ratio), damage);
  return { absorbed, spent: Math.min(block, Math.ceil(absorbed / ratio)), remaining: damage - absorbed };
}
export const armoredDamage = (damage: number, armor: number) => Math.max(0, damage - armor);
export function armorApplies(state: GameState, target: Combatant, type: DamageType) {
  return (
    type === "physical" ||
    type === "stun" ||
    (!isEnemy(target) &&
      ((type === "burn" && hasTalent(state, "armor.fireward")) ||
        (type === "bleed" && hasTalent(state, "armor.thick-hide"))))
  );
}

import { boonRule } from "./rules/boons";
import { supplementalRule } from "./rules/supplemental";
import type { CardDefinition } from "./content/types";
import type { BattleState, Creature, Enemy } from "./types";
import { hasTalent } from "./progression";
import { hasHarmfulEffects, STACK_LIMIT } from "./combat/state";
import { physicalBonus } from "./ability-rules";
import { armoredDamage, blockPayment, armorApplies } from "./combat/damage-values";
import { healingValue, restoration, overflowBlock } from "./combat/healing-values";

export interface OrdinaryHit {
  readonly negated: boolean;
  readonly lost: number;
  readonly blocked: number;
  readonly eroded: number;
  readonly health: number;
  readonly main: boolean;
  readonly lethal: boolean;
  readonly usefulExtras: boolean;
}
export function healingBenefit(
  state: BattleState,
  ally: Creature,
  value: number,
  effects: CardDefinition["effects"],
) {
  const { gain, excess } = restoration(ally, healingValue(state, ally, value));
  const overflow = hasTalent(state, "health.overflow")
    ? Math.min(overflowBlock(excess), STACK_LIMIT - ally.block)
    : 0;
  const cleanses =
    hasHarmfulEffects(ally) &&
    ((excess > 0 && hasTalent(state, "health.clean-slate")) ||
      !!effects?.some((effect) => effect.kind === "cleanse" && effect.target === "recipient"));
  return { restored: gain, utility: overflow + Number(cleanses) };
}

/** Ordinary primary-hit approximation only: excludes chance effects, extras and most talent reactions.
 * Reads visible facts without choosing targets, sampling RNG or advancing combat. */
export function ordinaryAttackFacts(
  state: BattleState,
  actor: Creature,
  def: Extract<CardDefinition, { effect: "attack" }>,
  value: number,
  enemy: Enemy,
): OrdinaryHit[] {
  const negated = enemy.combat.negate || enemy.combat.attackReflection;
  const lastCardCritical = def.criticalWhenLastCard && state.battle.hand.length === 1;
  const erosion = state.boons.includes("sundering-charm") ? boonRule("sundering-charm").armor : 0;
  const usefulExtras = !!def.effects?.some((effect) => supplementalRule(effect.kind).ordinaryAttackUtility);
  return [def.damageType, ...(def.alternateDamageType ? [def.alternateDamageType] : [])].map((type) => {
    // Ordinary primary packets omit chance effects and most talent reactions deliberately.
    const baseDamage = Math.round(
      value * (def.doubleAgainstHealthier && enemy.health > actor.health ? 2 : 1) +
        (type === "physical" ? physicalBonus(actor, state) : 0),
    );
    const damage = baseDamage * (lastCardCritical ? 2 : 1);
    const armored = armorApplies(state, enemy, type, actor);
    const armor = armored ? Math.max(0, enemy.combat.armor - erosion) : 0;
    const payment = blockPayment(damage, enemy.block);
    const piercing =
      type === "physical" && lastCardCritical && state.boons.includes("crater-punch")
        ? Math.round(payment.absorbed / boonRule("crater-punch").divisor)
        : 0;
    const prevented = negated || (type === "freeze" && enemy.combat.nullifyFreeze);
    const lost = prevented ? 0 : armoredDamage(payment.remaining, armor) + piercing;
    const eroded = !negated && armored ? Math.min(erosion, enemy.combat.armor) : 0;
    return {
      negated,
      lost,
      blocked: prevented ? 0 : payment.absorbed,
      eroded,
      health: enemy.health,
      main: !enemy.minion,
      lethal: lost >= enemy.health,
      usefulExtras,
    };
  });
}

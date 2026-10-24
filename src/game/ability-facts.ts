import { boonRule } from "./rules/boons";
import { supplementalRule } from "./rules/supplemental";
import type { CardDefinition } from "./content/types";
import type { BattleState, Creature, Enemy } from "./types";
import { hasTalent } from "./progression";
import { hasHarmfulEffects, STACK_LIMIT } from "./combat/state";
import { physicalBonus } from "./ability-rules";
import { armoredDamage, blockPayment } from "./combat/damage-values";
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
  return [def.damageType, ...(def.alternateDamageType ? [def.alternateDamageType] : [])].map((type) => {
    // Ordinary primary packets omit chance effects and most talent reactions deliberately.
    const damage =
      value * (def.doubleAgainstHealthier && enemy.health > actor.health ? 2 : 1) +
      (type === "physical" ? physicalBonus(actor, state) : 0);
    const armored = type === "physical" || type === "stun";
    const armor = armored
      ? Math.max(
          0,
          enemy.combat.armor -
            (state.boons.includes("sundering-charm") ? boonRule("sundering-charm").armor : 0),
        )
      : 0;
    const payment = blockPayment(damage, enemy.block);
    const lost =
      enemy.combat.negate ||
      enemy.combat.attackReflection ||
      (type === "freeze" && enemy.combat.nullifyFreeze)
        ? 0
        : armoredDamage(payment.remaining, armor);
    const eroded =
      !enemy.combat.negate &&
      !enemy.combat.attackReflection &&
      armored &&
      state.boons.includes("sundering-charm")
        ? Math.min(boonRule("sundering-charm").armor, enemy.combat.armor)
        : 0;
    return {
      negated: enemy.combat.negate || enemy.combat.attackReflection,
      lost,
      blocked: enemy.combat.negate || enemy.combat.attackReflection ? 0 : payment.absorbed,
      eroded,
      health: enemy.health,
      main: !enemy.minion,
      lethal: lost >= enemy.health,
      usefulExtras: !!def.effects?.some((effect) => supplementalRule(effect.kind).ordinaryAttackUtility),
    };
  });
}

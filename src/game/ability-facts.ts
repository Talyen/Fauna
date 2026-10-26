import { boonRule } from "./rules/boons";
import { supplementalRule } from "./rules/supplemental";
import type { CardDefinition } from "./content/types";
import type { BattleState, Creature, Enemy } from "./types";
import { hasTalent } from "./progression";
import { hasHarmfulEffects, STACK_LIMIT, type Combatant } from "./combat/state";
import { armoredDamage, blockPayment, armorApplies, modifiedDamage } from "./combat/damage-values";
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
  ally: Combatant,
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
  manaCost: number = def.cost,
): OrdinaryHit[] {
  // The engine pays before damage modifiers read Mana; free grants retain the full pool.
  const paid = manaCost
    ? { ...state, battle: { ...state.battle, mana: state.battle.mana - manaCost } }
    : state;
  const negated = enemy.combat.negate || enemy.combat.attackReflection;
  const lastCardCritical = def.criticalWhenLastCard && state.battle.hand.length === 1;
  const erosion = state.boons.includes("sundering-charm") ? boonRule("sundering-charm").armor : 0;
  const usefulExtras = !!def.effects?.some((effect) => supplementalRule(effect.kind).ordinaryAttackUtility);
  return [def.damageType, ...(def.alternateDamageType ? [def.alternateDamageType] : [])].map((type) => {
    // Ordinary primary packets omit chance effects and most talent reactions deliberately.
    const baseDamage = modifiedDamage(
      paid,
      actor,
      enemy,
      value * (def.doubleAgainstHealthier && enemy.health > actor.health ? 2 : 1),
      type,
      {
        origin: "ability",
        cardLeech: def.leech || def.effects?.some((effect) => effect.kind === "damage" && effect.leech),
      },
      true,
    );
    const damage = baseDamage * (lastCardCritical ? 2 : 1);
    const armored = armorApplies(state, enemy, type, actor);
    const armor = armored ? Math.max(0, enemy.combat.armor - erosion) : 0;
    const payment = blockPayment(damage, enemy.block);
    const piercing =
      lastCardCritical && state.boons.includes("crater-punch")
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

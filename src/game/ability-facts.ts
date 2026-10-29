import { boonRule } from "./rules/boons";
import { supplementalRule } from "./rules/supplemental";
import type { CardDefinition } from "./content/types";
import type { BattleState, Creature, Enemy } from "./types";
import { isEnemy } from "./battlefield";
import { hasTalent } from "./progression";
import { glassCutterAmount } from "./combat/glass-cutter";
import {
  dodgeChance,
  hasHarmfulEffects,
  maximumHealth,
  mostInjured,
  STACK_LIMIT,
  type Combatant,
} from "./combat/state";
import {
  armoredDamage,
  blockPayment,
  blockEfficiency,
  armorApplies,
  modifiedDamage,
} from "./combat/damage-values";
import {
  healingValue,
  scoopBonus,
  restoration,
  overflowBlock,
  overflowRecipients,
  overflowCupRecipient,
} from "./combat/healing-values";

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
/** Estimate the temporary protection Food will actually add without advancing combat. */
export function foodDodgeBenefit(state: BattleState, card: CardDefinition, ally: Combatant) {
  if (
    card.species !== null ||
    !state.boons.includes("velvet-whisk") ||
    (ally.combat?.temporaryDodge ?? 0) === 70
  )
    return 0;
  const currentDodge = dodgeChance(state, ally);
  if (currentDodge === 0) return 0;
  return Math.max(
    0,
    Math.min(boonRule("velvet-whisk").dodge, 70 - (ally.combat?.temporaryDodge ?? 0), 75 - currentDodge),
  );
}
/** Approximate the Food's extra Healing after its ordinary effect, using visible facts. */
export function foodWaffleBenefit(state: BattleState, card: CardDefinition, ally: Combatant, value: number) {
  if (
    card.species !== null ||
    !state.boons.includes("crown-waffle-iron") ||
    (card.effect !== "heal" && card.effect !== "guard")
  )
    return 0;
  const missing = maximumHealth(ally) - ally.health;
  const firstHealing =
    card.effect === "heal" ? Math.min(missing, Math.round(healingValue(state, ally, value))) : 0;
  const block = Math.min(STACK_LIMIT, ally.block + (card.effect === "guard" ? value : 0));
  const amount = block * (state.boons.includes("nectar-dipper") ? 2 : 1);
  return Math.min(missing - firstHealing, Math.round(healingValue(state, ally, amount)));
}
export function healingBenefit(
  state: BattleState,
  ally: Combatant,
  value: number,
  effects: CardDefinition["effects"],
) {
  const { gain, excess } = restoration(ally, healingValue(state, ally, value));
  const overflow =
    excess > 0 && hasTalent(state, "health.overflow")
      ? Math.min(overflowBlock(excess), STACK_LIMIT - ally.block)
      : 0;
  const cleanses =
    ((gain > 0 && (ally.combat?.bleed ?? 0) > 0 && state.boons.includes("yarrow-salve-tin")) ||
      (excess > 0 && hasTalent(state, "health.clean-slate")) ||
      !!effects?.some((effect) => effect.kind === "cleanse" && effect.target === "recipient")) &&
    hasHarmfulEffects(ally);
  const cupTarget =
    excess > 0 && !isEnemy(ally) && state.boons.includes("overflow-cup")
      ? overflowCupRecipient(state, ally)
      : undefined;
  let cup = 0;
  if (cupTarget) {
    const cupAmount = Math.round(excess / boonRule("overflow-cup").divisor);
    cup = restoration(cupTarget, cupAmount + scoopBonus(state, cupTarget, cupAmount)).gain;
  }
  let shared = 0;
  if (excess > 0 && !isEnemy(ally) && state.boons.includes("last-threshold")) {
    // Cup resolves first and can fill or change the ordering of Threshold recipients.
    const recipients: Combatant[] = [];
    for (const recipient of overflowRecipients(state, ally)) {
      const health = recipient.health + (recipient.id === cupTarget?.id ? cup : 0);
      if (health < maximumHealth(recipient)) recipients.push({ ...recipient, health });
    }
    let remaining = excess;
    while (remaining > 0) {
      const recipient = mostInjured(recipients);
      if (!recipient) break;
      recipients.splice(recipients.indexOf(recipient), 1);
      const amount = Math.min(remaining, maximumHealth(recipient) - recipient.health);
      remaining -= amount;
      shared += restoration(recipient, amount + scoopBonus(state, recipient, amount)).gain;
    }
  }
  return { restored: gain + shared + cup, utility: overflow + Number(cleanses) };
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
  return ordinaryAttackEvaluator(state, actor, def, value, manaCost)(enemy);
}

/** Reuse play-wide facts only while scoring the same unmodified battle state. */
export function ordinaryAttackEvaluator(
  state: BattleState,
  actor: Creature,
  def: Extract<CardDefinition, { effect: "attack" }>,
  value: number,
  manaCost: number = def.cost,
) {
  // The engine pays before damage modifiers read Mana; free grants retain the full pool.
  const paid = manaCost
    ? { ...state, battle: { ...state.battle, mana: state.battle.mana - manaCost } }
    : state;
  const lastCardCritical = def.criticalWhenLastCard && state.battle.hand.length === 1;
  const erosion = state.boons.includes("sundering-charm") ? boonRule("sundering-charm").armor : 0;
  const usefulExtras = !!def.effects?.some((effect) => supplementalRule(effect.kind).ordinaryAttackUtility);
  const craterPunch = lastCardCritical && state.boons.includes("crater-punch");
  let packet: { origin: "ability"; cardLeech: boolean } | undefined;
  return (enemy: Enemy): OrdinaryHit[] => {
    const magnitude = value * (def.doubleAgainstHealthier && enemy.health > actor.health ? 2 : 1);
    const outcomes: OrdinaryHit[] = [];
    const count = def.alternateDamageType ? 2 : 1;
    for (let index = 0; index < count; index++) {
      const type = index === 0 ? def.damageType : def.alternateDamageType!;
      const negated =
        enemy.combat.attackReflection ||
        (enemy.combat.negate && !(type === "light" && state.boons.includes("dawn-key")));
      if (negated) {
        outcomes.push({
          negated,
          lost: 0,
          blocked: 0,
          eroded: 0,
          health: enemy.health,
          main: !enemy.minion,
          lethal: 0 >= enemy.health,
          usefulExtras,
        });
        continue;
      }
      packet ??= {
        origin: "ability",
        cardLeech: !!(def.leech || def.effects?.some((effect) => effect.kind === "damage" && effect.leech)),
      };
      // Ordinary primary packets omit chance effects and most talent reactions deliberately.
      const baseDamage = modifiedDamage(paid, actor, enemy, magnitude, type, packet, true);
      const damage = baseDamage * (lastCardCritical ? 2 : 1);
      const stolenBlock = type === "light" ? Math.min(enemy.block, glassCutterAmount(state, actor)) : 0;
      const armored = armorApplies(state, enemy, type, actor);
      const armor = armored ? Math.max(0, enemy.combat.armor - erosion) : 0;
      const payment = blockPayment(
        damage,
        type === "bleed" && state.boons.includes("harvest-sickle") ? 0 : enemy.block - stolenBlock,
        blockEfficiency(state, enemy, type, actor),
      );
      const piercing = craterPunch ? Math.round(payment.absorbed / boonRule("crater-punch").divisor) : 0;
      const prevented = negated || (type === "freeze" && enemy.combat.nullifyFreeze);
      const lost = prevented ? 0 : armoredDamage(payment.remaining, armor) + piercing;
      const eroded = !negated && armored ? Math.min(erosion, enemy.combat.armor) : 0;
      outcomes.push({
        negated,
        lost,
        blocked: prevented ? 0 : payment.absorbed,
        eroded,
        health: enemy.health,
        main: !enemy.minion,
        lethal: lost >= enemy.health,
        usefulExtras,
      });
    }
    return outcomes;
  };
}

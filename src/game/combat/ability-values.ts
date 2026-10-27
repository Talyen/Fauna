import { CARDS, type CardDefinition } from "../content";
import { abilityRule } from "../rules/abilities";
import { supplementalRule } from "../rules/supplemental";
import { scalePower } from "../rules/contracts";
export { scalePower } from "../rules/contracts";

export function primaryAbilityValue(card: CardDefinition, value: number, power = 1): number {
  const policy = abilityRule(card.effect).scaling;
  switch (policy) {
    case "authored":
      return card.value;
    case "power":
      return scalePower(value, power);
    case "level":
      return value;
    default: {
      const unhandled: never = policy;
      throw new Error(`Unhandled scaling: ${unhandled}`);
    }
  }
}
const NO_EXTRAS: NonNullable<CardDefinition["effects"]> = Object.freeze([]);
const authoredCards = new WeakSet<object>(CARDS);
const unchangedAtUnitPower = new WeakSet<object>();
/** Copy only amounts changed by room power; preserve authored order and sharing. */
export function abilityExtras(card: CardDefinition, power = 1): NonNullable<CardDefinition["effects"]> {
  const effects = card.effects ?? NO_EXTRAS;
  if (!effects.length) return effects;
  if (power === 1 && unchangedAtUnitPower.has(card)) return effects;
  let scaled: (typeof effects)[number][] | undefined;
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index]!;
    if (supplementalRule(effect.kind).scaling !== "power") continue;
    const amount = scalePower(effect.amount, power);
    if (!Object.is(amount, effect.amount)) {
      scaled ??= effects.slice();
      scaled[index] = { ...effect, amount };
    }
  }
  if (power === 1 && !scaled && authoredCards.has(card)) unchangedAtUnitPower.add(card);
  return scaled ?? effects;
}

import { primaryAbilityValue } from "../../../game/combat/ability-values";
import { abilityRule, guardSelfRule } from "../../../game/rules/abilities";
import type { CardDefinition } from "../../../game/content";

/** Only the complete pilot form is migrated; changed effects retain the English adapter. */
export function structuredCardRule(
  card: CardDefinition,
  level: number,
  value: number | undefined,
  power: number,
  text: string,
) {
  if (card.id !== "ravelland-rainward" || card.effect !== "guard" || card.target !== "self") return undefined;
  const amount =
    value ?? primaryAbilityValue(card, card.value + level * 2, power, abilityRule(card.effect).scaling);
  const message = guardSelfRule(amount);
  if (message.source !== text) return undefined;
  return { id: "content.card.ravelland-rainward.vadb3e758e4125447.rule", message };
}

import { cardRuleVariantId } from "./rule-key.mjs";
import { ruleMessage } from "./rule-message";
import { cardText, foodForAllies } from "../../../game/card-rules";
import { structuredCardRule } from "./structured-card-rule";
import { cornucopiaHealing } from "../../../game/rules/boons";
import type { CardDefinition } from "../../../game/content";
import type { GameState } from "../../../game/types";

/** Food rules have a distinct complete message when a Boon changes their recipient. */
export function cardRuleId(card: CardDefinition, state?: Pick<GameState, "boons">, text?: string) {
  if (card.species !== null)
    return text === undefined ? undefined : cardRuleVariantId(card.id, ruleMessage(text).template);
  if (card.id === "food-mana-berries" && cornucopiaHealing(state))
    return `content.card.${card.id}.cornucopia.rule`;
  return `content.card.${card.id}.${foodForAllies(card, state) ? "all." : ""}rule`;
}

/** Use the same rule and catalog identity for visible text and accessible names. */
export function cardRulePresentation(
  card: CardDefinition,
  level: number,
  value: number | undefined,
  power: number,
  state?: Pick<GameState, "boons">,
) {
  const text = cardText(card, level, value, power, state);
  const structured = structuredCardRule(card, level, value, power, text);
  return { text, id: structured?.id ?? cardRuleId(card, state, text), message: structured?.message };
}

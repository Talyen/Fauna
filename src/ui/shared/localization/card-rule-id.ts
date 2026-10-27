import { cardRuleVariantId } from "./rule-key.mjs";
import { ruleMessage } from "./rule-message";
import { foodForAllies } from "../../../game/card-rules";
import type { CardDefinition } from "../../../game/content";
import type { GameState } from "../../../game/types";

/** Food rules have a distinct complete message when a Boon changes their recipient. */
export function cardRuleId(card: CardDefinition, state?: Pick<GameState, "boons">, text?: string) {
  if (card.species !== null)
    return text === undefined ? undefined : cardRuleVariantId(card.id, ruleMessage(text).template);
  return `content.card.${card.id}.${foodForAllies(card, state) ? "all." : ""}rule`;
}

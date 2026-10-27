import { foodForAllies } from "../../../game/card-rules";
import type { CardDefinition } from "../../../game/content";
import type { GameState } from "../../../game/types";

/** Food rules have a distinct complete message when a Boon changes their recipient. */
export function cardRuleId(card: CardDefinition, state?: Pick<GameState, "boons">) {
  if (card.species !== null) return undefined;
  return `content.card.${card.id}.${foodForAllies(card, state) ? "all." : ""}rule`;
}

import type { Card, GameState } from "./types";

export const CORNUCOPIA_CARD_ID = "boon:cornucopia:mana-berries";

/** Journey-owned cards survive formation changes and are replenished after combat. */
function cornucopiaCard(): Card {
  return { id: CORNUCOPIA_CARD_ID, definitionId: "food-mana-berries", ownerId: null, level: 0 };
}

export function replenishJourneyCards(state: GameState) {
  if (state.boons.includes("cornucopia") && !state.cards.some((card) => card.id === CORNUCOPIA_CARD_ID))
    state.cards.push(cornucopiaCard());
}

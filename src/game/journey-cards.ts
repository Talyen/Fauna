import type { Card, GameState } from "./types";

export const CORNUCOPIA_CARD_ID = "boon:cornucopia:mana-berries";
export const TOADSTOOL_BREADBOX_CARD_ID = "boon:toadstool-breadbox:trail-bread";

/** Journey-owned cards survive formation changes and are replenished after combat. */
function cornucopiaCard(): Card {
  return { id: CORNUCOPIA_CARD_ID, definitionId: "food-mana-berries", ownerId: null, level: 0 };
}

function toadstoolBreadboxCard(): Card {
  return { id: TOADSTOOL_BREADBOX_CARD_ID, definitionId: "food-trail-bread", ownerId: null, level: 0 };
}

export function replenishJourneyCards(state: GameState) {
  if (state.boons.includes("cornucopia") && !state.cards.some((card) => card.id === CORNUCOPIA_CARD_ID))
    state.cards.push(cornucopiaCard());
  if (
    state.boons.includes("toadstool-breadbox") &&
    !state.cards.some((card) => card.id === TOADSTOOL_BREADBOX_CARD_ID)
  )
    state.cards.push(toadstoolBreadboxCard());
}

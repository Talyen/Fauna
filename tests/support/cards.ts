import { dispatch } from "../../src/game/engine";
import type { GameState } from "../../src/game/types";

/** Arrange complete player piles without changing card identity, catalog order or RNG. */
export function setBattleCards(state: GameState, hand: string[], discard: string[] = []) {
  if (!state.battle) throw new Error("Card arrangement requires a battle");
  state.battle.hand = hand;
  state.battle.discard = discard;
  state.battle.buffer = [];
  state.battle.draw = state.cards
    .filter((card) => !hand.includes(card.id) && !discard.includes(card.id))
    .map((card) => card.id);
}

/** Resolve the first owned copy, matching authored-kit fixtures with duplicate cards. */
export function cardId(state: Pick<GameState, "cards">, definitionId: string) {
  return state.cards.find((card) => card.definitionId === definitionId)!.id;
}

export function setHand(state: GameState, definitions: readonly string[]) {
  setBattleCards(
    state,
    definitions.map((id) => cardId(state, id)),
  );
}

/** Exercise a single command without implicitly advancing the enemy turn. */
export function playCard(state: GameState, definitionId: string, targetId?: string) {
  return dispatch(state, { type: "play", cardId: cardId(state, definitionId), targetId, autoEndTurn: false });
}

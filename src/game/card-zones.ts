import type { GameState } from "./types";
import { shuffle } from "./random";
import { cardKeywords } from "./progression";

export const MAX_HAND_SIZE = 7;

export function fillHand(state: GameState) {
  const battle = state.battle!;
  while (battle.hand.length < MAX_HAND_SIZE && battle.buffer.length) battle.hand.push(battle.buffer.shift()!);
}
export function draw(state: GameState, count: number) {
  fillHand(state);
  const b = state.battle!;
  // Knocked-out owners retain inert slots, so replacing them cannot refresh spent cards.
  const alive = state.team.filter((c) => c.health > 0);
  const eligible = (id: string) =>
    !alive.length || alive.some((c) => c.id === state.cards.find((card) => card.id === id)?.ownerId);
  for (let i = 0; i < count; i++) {
    if (!b.draw.some(eligible)) {
      const available = b.discard.filter(eligible);
      b.discard = b.discard.filter((id) => !eligible(id));
      b.draw.push(...shuffle(state, available));
    }
    let index = b.draw.length - 1;
    while (index >= 0 && !eligible(b.draw[index]!)) index--;
    if (index < 0) break;
    const card = b.draw.splice(index, 1)[0]!;
    if (b.hand.length < MAX_HAND_SIZE) b.hand.push(card);
    else b.buffer.push(card);
  }
}

export function drawKeyword(state: GameState, keyword: "light" | "nature" | "water") {
  const battle = state.battle;
  if (!battle) return;
  fillHand(state);
  const eligible = (id: string) => {
    const card = state.cards.find((c) => c.id === id)!;
    return (
      state.team.some((c) => c.id === card.ownerId && c.health > 0) && cardKeywords(card).includes(keyword)
    );
  };
  if (!battle.draw.some(eligible)) {
    const available = battle.discard.filter(eligible);
    battle.discard = battle.discard.filter((id) => !eligible(id));
    battle.draw.push(...shuffle(state, available));
  }
  let index = battle.draw.length - 1;
  while (index >= 0 && !eligible(battle.draw[index]!)) index--;
  if (index >= 0) {
    const id = battle.draw.splice(index, 1)[0]!;
    (battle.hand.length < MAX_HAND_SIZE ? battle.hand : battle.buffer).push(id);
  }
}

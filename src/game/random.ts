import type { GameState } from "./types";

export type RandomDecision = { kind: "chance"; threshold: number } | { kind: "index"; size: number };
export type DecisionSource = ((decision: RandomDecision | undefined) => number) & { step?: () => void };
// A source belongs to one ephemeral Immer draft, never to a saved or published snapshot.
const sources = new WeakMap<GameState, DecisionSource>();
export function observeDecisions(draft: GameState, source: DecisionSource) {
  sources.set(draft, source);
}
export function hiddenDecision(state: GameState) {
  sources.get(state)?.(undefined);
}
export function previewWork(state: GameState) {
  sources.get(state)?.step?.();
}
export function roll(state: GameState, decision?: RandomDecision) {
  const source = sources.get(state);
  if (source) return source(decision);
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}
export function shuffle<T>(state: GameState, cards: T[]): T[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(roll(state) * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

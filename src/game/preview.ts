import { previewCard } from "./engine";
import type { GameState } from "./types";
/** Runs the authoritative pure command without publishing or saving its result. */
export function previewPlay(state: GameState, cardId: string, targetId?: string) {
  return previewCard(state, cardId, targetId);
}

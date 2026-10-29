import { cardTargeting } from "./card-rules";
import { passiveAmount } from "./progression";
import type { CardDefinition } from "./content/types";
import type { GameState } from "./types";

/** A deployed healer can offer its fallen roster allies as alternate healing targets. */
export function mendTheBroken(state: GameState, card: CardDefinition): number {
  if (state.phase !== "battle" || card.effect !== "heal" || card.species === null) return 0;
  const actor = state.team.find((unit) => unit.species === card.species && unit.health > 0);
  return actor ? passiveAmount(state, actor.species, "mendTheBroken") : 0;
}

export function hasMendingTargets(state: GameState, card: CardDefinition): boolean {
  return (
    mendTheBroken(state, card) > 0 && [...state.team, ...state.reserves].some((unit) => unit.health === 0)
  );
}

/** Add the revival choice without changing the authored healing description. */
export function playTargeting(card: CardDefinition, state: GameState) {
  return hasMendingTargets(state, card) ? "ally" : cardTargeting(card, state);
}

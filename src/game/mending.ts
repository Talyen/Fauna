import { cardTargeting } from "./card-rules";
import { passiveAmount } from "./progression";
import type { CardDefinition } from "./content/types";
import type { Creature, GameState } from "./types";

/** A deployed healer can offer its fallen roster allies as alternate healing targets. */
export function mendTheBroken(state: GameState, card: CardDefinition, actor?: Creature): number {
  if (state.phase !== "battle" || card.effect !== "heal" || card.species === null) return 0;
  const acting = actor ?? state.team.find((unit) => unit.species === card.species && unit.health > 0);
  return acting && acting.health > 0 ? passiveAmount(state, acting.species, "mendTheBroken") : 0;
}

export function hasMendingTargets(state: GameState, card: CardDefinition, actor?: Creature): boolean {
  return (
    mendTheBroken(state, card, actor) > 0 &&
    [...state.team, ...state.reserves].some((unit) => unit.health === 0)
  );
}

/** Add the revival choice without changing the authored healing description. */
export function playTargeting(card: CardDefinition, state: GameState, actor?: Creature) {
  return hasMendingTargets(state, card, actor) ? "ally" : cardTargeting(card, state);
}

import { controlled } from "./combat/state";
import { creaturePassive } from "./progression";
import type { Card, Creature, GameState } from "./types";

export function unfinishedJourneyLimit(state: GameState | undefined, unit: Pick<Creature, "species">) {
  return creaturePassive(state, unit.species).effects.reduce(
    (sum, effect) => sum + (effect.kind === "unfinishedJourney" ? effect.amount : 0),
    0,
  );
}

/** Availability never changes card ownership or its position in the ordinary piles. */
export function cardActor(state: GameState, card: Pick<Card, "ownerId">): Creature | undefined {
  // Shared items need a living presenter; their resolver does not inherit creature ability modifiers.
  if (card.ownerId === null) return state.team.find((unit) => unit.health > 0);
  const owner = state.team.find((unit) => unit.id === card.ownerId);
  if (!owner || owner.health > 0 || state.phase !== "battle") return owner;
  const guides = state.team.filter((unit) => unit.health > 0 && unfinishedJourneyLimit(state, unit) > 0);
  return (
    guides.find(
      (unit) =>
        !controlled(unit, state) &&
        (unit.combat?.fallenCardsPlayedThisTurn ?? 0) < unfinishedJourneyLimit(state, unit),
    ) ?? guides[0]
  );
}

/** A spent allowance does not remove fallen cards from drawing or presentation. */
export function drawableOwnerIds(state: GameState): Set<string> {
  const borrowing =
    state.phase === "battle" &&
    state.team.some((unit) => unit.health > 0 && unfinishedJourneyLimit(state, unit) > 0);
  return new Set(state.team.filter((unit) => unit.health > 0 || borrowing).map((unit) => unit.id));
}

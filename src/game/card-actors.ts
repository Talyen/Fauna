import { controlled } from "./combat/state";
import { passiveAmount } from "./progression";
import { definition } from "./content";
import type { Card, Creature, GameState } from "./types";

export function unfinishedJourneyLimit(state: GameState | undefined, unit: Pick<Creature, "species">) {
  return passiveAmount(state, unit.species, "unfinishedJourney");
}

/** Availability never changes card ownership or its position in the ordinary piles. */
export function cardActor(
  state: GameState,
  card: Pick<Card, "ownerId"> & Partial<Pick<Card, "definitionId">>,
): Creature | undefined {
  // Shared items need a living presenter; their resolver does not inherit creature ability modifiers.
  if (card.ownerId === null) return state.team.find((unit) => unit.health > 0);
  const owner = state.team.find((unit) => unit.id === card.ownerId);
  if (!owner || owner.health > 0 || state.phase !== "battle") return owner;
  let fallback: Creature | undefined;
  let cardDefinition: ReturnType<typeof definition> | undefined;
  for (const guide of state.team) {
    if (guide.health <= 0) continue;
    const limit = unfinishedJourneyLimit(state, guide);
    if (limit <= 0) continue;
    fallback ??= guide;
    if (
      !controlled(
        guide,
        state,
        card.definitionId ? (cardDefinition ??= definition(card.definitionId)) : undefined,
      ) &&
      (guide.combat?.fallenCardsPlayedThisTurn ?? 0) < limit
    )
      return guide;
  }
  return fallback;
}

/** A spent allowance does not remove fallen cards from drawing or presentation. */
export function drawableOwnerIds(state: GameState): Set<string> {
  const owners = new Set<string>();
  let fallen = false;
  for (const unit of state.team) {
    if (unit.health > 0) owners.add(unit.id);
    else fallen = true;
  }
  if (
    fallen &&
    state.phase === "battle" &&
    state.team.some((unit) => unit.health > 0 && unfinishedJourneyLimit(state, unit) > 0)
  ) {
    owners.clear();
    for (const unit of state.team) owners.add(unit.id);
  }
  return owners;
}

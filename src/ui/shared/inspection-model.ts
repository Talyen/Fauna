import type { Card, GameState } from "../../game/types";
import { species, speciesCards, type SpeciesId } from "../../game/content";
export type Inspection =
  { card: Card } | { species: SpeciesId; creatureId?: string; speciesKit?: boolean; enemyId?: string };

/** Draft previews and committed decks use the same cards for rendering and inspection shortcuts. */
export function inspectionDeck(game: GameState) {
  const owners =
    game.phase === "draft"
      ? game.selected.map((kind, index) => ({
          id: `draft-${index}`,
          species: kind,
          health: species(kind).health,
          block: 0,
          attacked: false,
        }))
      : game.team;
  const cards =
    game.phase === "draft"
      ? owners.flatMap((owner) =>
          speciesCards(owner.species).map((card) => ({
            id: `${owner.id}:${card.id}`,
            definitionId: card.id,
            ownerId: owner.id,
            level: 0,
          })),
        )
      : game.cards;
  return { owners, cards };
}

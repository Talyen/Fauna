import { PagedItems, useCompactLayout } from "./pagination";

import { EmptyState } from "./empty-state";

import { ActionCard } from "./cards";

import { CARDS, species } from "../../game/content";
import type { Command, GameState } from "../../game/types";
import type { Inspection } from "./inspection-model";

type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function DeckCards({
  game,
  inspect,
  pile,
}: {
  game: GameState;
  inspect?: Props["inspect"];
  pile?: "draw" | "discard";
}) {
  const compact = useCompactLayout();
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
  const deck =
    game.phase === "draft"
      ? owners.flatMap((owner) =>
          CARDS.filter((card) => card.species === owner.species).map((card) => ({
            id: `${owner.id}:${card.id}`,
            definitionId: card.id,
            ownerId: owner.id,
            level: 0,
          })),
        )
      : game.cards;
  const cards = deck
    .filter((card) => !pile || game.battle?.[pile].includes(card.id))
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId) || a.id.localeCompare(b.id));
  return (
    <>
      {cards.length === 0 ? (
        <EmptyState
          label={`${pile === "draw" ? "Draw Pile" : pile === "discard" ? "Discard Pile" : "Deck"} is empty`}
        />
      ) : null}
      <PagedItems items={cards} pageSize={compact ? 3 : 6} className="deck-grid" label="Deck pages">
        {(card) => {
          const owner = owners.find((c) => c.id === card.ownerId)!;
          return (
            <ActionCard
              key={card.id}
              card={card}
              actor={owner}
              modifiers={game}
              ownerName={species(owner.species).name}
              onClick={() => inspect?.({ card })}
              onInspect={inspect ? () => inspect({ card }) : undefined}
            />
          );
        }}
      </PagedItems>
    </>
  );
}

import { useMessages } from "../localization/message-context";
import { PagedItems, useCompactLayout } from "../navigation/pagination";

import { EmptyState } from "../empty-state";

import { ActionCard } from "./cards";

import { cardActor } from "../../../game/card-actors";
import { species, speciesCards } from "../../../game/content";
import type { Command, GameState } from "../../../game/types";
import type { Inspection } from "../inspection-model";

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
  const i18n = useMessages();
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
          speciesCards(owner.species).map((card) => ({
            id: `${owner.id}:${card.id}`,
            definitionId: card.id,
            ownerId: owner.id,
            level: 0,
          })),
        )
      : game.cards;
  const pileIds = pile ? new Set(game.battle?.[pile] ?? []) : undefined;
  const cards = deck
    .filter((card) => !pile || pileIds!.has(card.id))
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId) || a.id.localeCompare(b.id));
  return (
    <>
      {cards.length === 0 ? (
        <EmptyState
          label={
            pile === "draw"
              ? i18n.message("deck.drawEmpty", "Draw Pile is empty")
              : pile === "discard"
                ? i18n.message("deck.discardEmpty", "Discard Pile is empty")
                : i18n.message("deck.empty", "Deck is empty")
          }
        />
      ) : null}
      <PagedItems
        items={cards}
        pageSize={compact ? 3 : 6}
        className="deck-grid"
        label={i18n.message("deck.pages", "Deck pages")}
      >
        {(card) => {
          const owner = cardActor(game, card) ?? owners.find((c) => c.id === card.ownerId)!;
          return (
            <ActionCard
              key={card.id}
              card={card}
              actor={owner}
              modifiers={game}
              ownerName={
                card.ownerId === null
                  ? i18n.content("content.keyword.food.label", "Food")
                  : i18n.content(`content.species.${owner.species}.name`, species(owner.species).name)
              }
              onClick={() => inspect?.({ card })}
              onInspect={inspect ? () => inspect({ card }) : undefined}
            />
          );
        }}
      </PagedItems>
    </>
  );
}

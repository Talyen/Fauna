import { useMessages } from "../localization/message-context";
import { PagedItems, useCompactLayout } from "../navigation/pagination";

import { EmptyState } from "../empty-state";

import { ActionCard } from "./cards";

import { cardActor } from "../../../game/card-actors";
import { definition, species } from "../../../game/content";
import type { Command, GameState } from "../../../game/types";
import { inspectionDeck, type Inspection } from "../inspection-model";
import { useArtwork } from "../artwork";
import { assetUrl } from "../assets";

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
  const { owners, cards: deck } = inspectionDeck(game);
  const pileIds = pile ? new Set(game.battle?.[pile] ?? []) : undefined;
  const cards = (pile ? deck.filter((card) => pileIds!.has(card.id)) : deck.slice()).sort(
    (a, b) =>
      i18n
        .content(`content.card.${a.definitionId}.name`, definition(a.definitionId).name)
        .localeCompare(
          i18n.content(`content.card.${b.definitionId}.name`, definition(b.definitionId).name),
          i18n.locale,
        ) || a.id.localeCompare(b.id),
  );
  useArtwork(
    deck.map((card) => {
      const def = definition(card.definitionId);
      return assetUrl(def.artwork ?? `action.${def.species}`);
    }),
  );
  const renderCard = (card: (typeof deck)[number]) => {
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
  };

  const overflow =
    pile === "draw"
      ? (game.battle?.buffer ?? []).flatMap((id) => {
          const card = deck.find((entry) => entry.id === id);
          return card ? [card] : [];
        })
      : [];
  const draw = (
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
        pageSize={overflow.length > 0 ? 2 : compact ? 3 : 6}
        className="deck-grid"
        label={i18n.message("deck.pages", "Deck pages")}
      >
        {renderCard}
      </PagedItems>
    </>
  );
  return overflow.length ? (
    <div className="deck-pile-sections">
      <div className="deck-pile-draw">{draw}</div>
      <section className="deck-hand-overflow">
        <h2>{i18n.message("deck.handOverflow", "Hand Overflow")}</h2>
        <PagedItems
          items={overflow}
          pageSize={2}
          className="deck-grid"
          label={i18n.message("deck.pages", "Deck pages")}
        >
          {renderCard}
        </PagedItems>
      </section>
    </div>
  ) : (
    draw
  );
}

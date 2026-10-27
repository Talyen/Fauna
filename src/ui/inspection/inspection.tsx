import { useMessages } from "../shared/localization/message-context";
import { localizedCombatantName } from "../shared/localization/combatant-name";
import { EffectScope, EffectBaseline, EffectBackdropHost } from "../shared/effects/effects";
import { creatureKeywords, effectPalette, visualKeywords } from "../shared/effects/palettes";
import { cardActor } from "../../game/card-actors";
import { cardText } from "../../game/card-rules";
import { ShineText } from "../shared/effects/treatments";
import { creaturePassive, creatureStars, MAX_CREATURE_STARS } from "../../game/progression";
import { KeywordText } from "../shared/keyword-text";
import { enemyInspectionValue } from "../../game/ability-rules";
import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { Star } from "lucide-react";
import type { Session } from "../../application/session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { ActionCard } from "../shared/cards/cards";
import { definition, species, speciesCards } from "../../game/content";
import type { Card } from "../../game/types";
import { isAvailableFocusTarget, returnFocus } from "../shared/navigation/focus";
import type { Inspection } from "../shared/inspection-model";
import type { Controls } from "../shared/navigation/input";
export function Inspector({
  item,
  session,
  controls: controlsRef,
  onClose,
}: {
  item: Inspection;
  session: Session;
  controls: Controls;
  onClose: () => void;
}) {
  const i18n = useMessages();
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const game = useStore(session.store, (s) => s.game);
  const rootCard = "card" in item ? item.card : null;
  const kind = "card" in item ? definition(item.card.definitionId).species : item.species;
  const creature = kind === null ? null : species(kind);
  const creatureId = rootCard?.ownerId ?? ("creatureId" in item ? item.creatureId : undefined);
  const ally = creatureId
    ? (game.team.find((c) => c.id === creatureId) ?? game.reserves.find((c) => c.id === creatureId))
    : undefined;
  const enemy = "enemyId" in item ? game.battle?.enemies.find((e) => e.id === item.enemyId) : undefined;
  const speciesKit = "speciesKit" in item && item.speciesKit;
  const actor = enemy || speciesKit ? undefined : rootCard ? (cardActor(game, rootCard) ?? ally) : ally;
  const modifiers = enemy || speciesKit ? undefined : game;
  const rank = enemy || kind === null ? 0 : creatureStars(game, kind);
  const passive = kind === null ? null : creaturePassive(enemy ? undefined : game, kind);
  const cards: Card[] =
    kind === null && rootCard
      ? [rootCard]
      : (kind ? speciesCards(kind) : []).map((def) =>
          rootCard?.definitionId === def.id
            ? rootCard
            : (!enemy &&
                game.cards.find((card) => card.ownerId === actor?.id && card.definitionId === def.id)) || {
                id: `inspect-${def.id}`,
                definitionId: def.id,
                ownerId: actor?.id ?? kind,
                level: 0,
              },
        );
  const [selected, setSelected] = useState<number | null>(() =>
    rootCard ? cards.findIndex((c) => c.definitionId === rootCard.definitionId) : null,
  );
  const thumbnails = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  const previousCard = useRef(selected),
    restore = useRef<number | null>(null);
  const cycle = (direction: number) =>
    setSelected((index) => (index === null ? null : (index + direction + cards.length) % cards.length));
  const back = () => {
    if (rootCard) return false;
    if (selected === null) return false;
    restore.current = selected;
    setSelected(null);
    return true;
  };
  useLayoutEffect(() => {
    if (selected !== null && previousCard.current === null)
      dialog.current?.querySelector<HTMLButtonElement>(".dialog-close")?.focus();
    previousCard.current = selected;
    if (selected === null && restore.current !== null) {
      returnFocus(thumbnails.current?.querySelectorAll<HTMLButtonElement>("button")[restore.current] ?? null);
      restore.current = null;
    }
  }, [selected]);
  useLayoutEffect(() => {
    controlsRef.current = (action) => {
      if (action === "back") return back();
      if (selected !== null && (action === "left" || action === "right")) {
        cycle(action === "left" ? -1 : 1);
        return true;
      }
      if (action === "inspect" && selected === null) {
        const id = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]")
          ?.dataset.cardId;
        const index = cards.findIndex((card) => card.id === id);
        if (index >= 0) {
          setSelected(index);
          return true;
        }
      }
      return false;
    };
    return () => {
      controlsRef.current = null;
    };
  });
  const card = selected === null ? null : cards[selected]!;
  return (
    <EffectScope name="inspection">
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          ref={dialog}
          overlayClassName="inspection-overlay"
          data-nav-layout="rows"
          overlayChildren={<EffectBackdropHost scope="inspection" />}
          onOverlayClick={(event) => {
            // A reopened inspection must close on its first backdrop click, even before Radix dismisses it.
            if (event.target === event.currentTarget) onClose();
          }}
          className={`inspection ${card ? "single-card" : "creature-inspection"}`}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const focused = document.activeElement as HTMLElement | null;
            if (focused !== document.body && isAvailableFocusTarget(focused)) return;
            returnFocus(opener);
          }}
        >
          <EffectBaseline
            priority={1}
            palette={effectPalette(
              card
                ? visualKeywords(cardText(definition(card.definitionId), card.level))
                : kind === null
                  ? []
                  : creatureKeywords(kind, enemy ? undefined : game),
            )}
          />
          {card ? (
            <>
              <DialogTitle className="sr-only">
                {i18n.message("inspection.cardDetails", "{{name}} details", {
                  name: i18n.content(
                    `content.card.${card.definitionId}.name`,
                    definition(card.definitionId).name,
                  ),
                })}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {i18n.message(
                  "inspection.actionHint",
                  "Action artwork. Hover or focus for the name, Mana cost, and final effects.",
                )}
              </DialogDescription>
              <ActionCard
                card={card}
                ownerName={
                  creature
                    ? i18n.content(`content.species.${creature.id}.name`, creature.name)
                    : i18n.content("content.keyword.food.label", "Food")
                }
                actor={actor}
                modifiers={modifiers}
                enemy={!!enemy}
                enemyPower={enemy?.power}
                enemyValue={enemy ? enemyInspectionValue(enemy, definition(card.definitionId)) : undefined}
                onClick={() => {}}
              />
            </>
          ) : creature && passive ? (
            <>
              <header className="inspection-heading">
                <DialogTitle>
                  {enemy
                    ? localizedCombatantName(enemy, i18n)
                    : i18n.content(`content.species.${creature.id}.name`, creature.name)}
                </DialogTitle>
              </header>
              <DialogDescription className="sr-only">
                {i18n.message(
                  "inspection.creatureHint",
                  "Three abilities and current passive rank. Hover or focus abilities for their details.",
                )}
              </DialogDescription>
              <section
                className="inspection-abilities"
                aria-label={i18n.message("inspection.abilities", "Abilities")}
              >
                <div className="inspection-thumbnails" ref={thumbnails} data-nav-row>
                  {cards.map((action, index) => (
                    <ActionCard
                      key={action.id}
                      card={action}
                      ownerName={
                        creature
                          ? i18n.content(`content.species.${creature.id}.name`, creature.name)
                          : i18n.content("content.keyword.food.label", "Food")
                      }
                      actor={actor}
                      modifiers={modifiers}
                      enemy={!!enemy}
                      enemyPower={enemy?.power}
                      enemyValue={
                        enemy ? enemyInspectionValue(enemy, definition(action.definitionId)) : undefined
                      }
                      onClick={() => setSelected(index)}
                      onInspect={() => setSelected(index)}
                    />
                  ))}
                </div>
              </section>
              <section
                className="inspection-active-trait"
                aria-label={i18n.message("inspection.trait", "Trait")}
              >
                <h2>
                  <ShineText keywords={visualKeywords(passive.description)}>
                    {i18n.content(`content.species.${creature.id}.trait`, creature.trait)}
                  </ShineText>
                </h2>
                <span
                  className="inspection-stars"
                  role="img"
                  aria-label={i18n.message("inspection.stars", "{{rank}} of {{maximum}} stars", {
                    rank,
                    maximum: MAX_CREATURE_STARS,
                  })}
                >
                  {Array.from({ length: MAX_CREATURE_STARS }, (_, index) => (
                    <Star key={index} aria-hidden="true" data-earned={index < rank} />
                  ))}
                </span>
                <p>
                  <KeywordText
                    text={passive.description}
                    id={`content.species.${kind}.passive.${passive.rank}.rule`}
                  />
                </p>
              </section>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </EffectScope>
  );
}

import { EffectScope, EffectBaseline, EffectBackdropHost } from "../shared/effects/effects";
import { creatureKeywords, effectPalette, visualKeywords } from "../shared/effects/palettes";
import { cardText } from "../../game/card-rules";
import { ShineText } from "../shared/effects/treatments";
import { sharedDodgeChance } from "../../game/combat/index";
import { creaturePassive, creatureStars, MAX_CREATURE_STARS } from "../../game/progression";
import { KeywordText } from "../shared/keyword-text";
import { enemyInspectionValue } from "../../game/ability-rules";
import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { ChevronLeft, Star } from "lucide-react";
import type { Session } from "../../application/session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { ActionCard, CreatureCard } from "../shared/cards/cards";
import { CARDS, definition, species } from "../../game/content";
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
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const game = useStore(session.store, (s) => s.game);
  const rootCard = "card" in item ? item.card : null;
  const kind = "card" in item ? definition(item.card.definitionId).species : item.species;
  const creature = species(kind);
  const creatureId = rootCard?.ownerId ?? ("creatureId" in item ? item.creatureId : undefined);
  const ally = creatureId ? [...game.team, ...game.reserves].find((c) => c.id === creatureId) : undefined;
  const enemy = "enemyId" in item ? game.battle?.enemies.find((e) => e.id === item.enemyId) : undefined;
  const speciesKit = "speciesKit" in item && item.speciesKit;
  const actor = enemy || speciesKit ? undefined : ally;
  const modifiers = enemy || speciesKit ? undefined : game;
  const rank = enemy ? 0 : creatureStars(game, kind);
  const passive = creaturePassive(enemy ? undefined : game, kind);
  const cards: Card[] = CARDS.filter((c) => c.species === kind).map((def) =>
    rootCard?.definitionId === def.id
      ? rootCard
      : (game.cards.find((card) => !enemy && card.ownerId === actor?.id && card.definitionId === def.id) ?? {
          id: `inspect-${def.id}`,
          definitionId: def.id,
          ownerId: actor?.id ?? kind,
          level: 0,
        }),
  );
  const [selected, setSelected] = useState<number | null>(() =>
    rootCard ? cards.findIndex((c) => c.definitionId === rootCard.definitionId) : null,
  );
  const thumbnails = useRef<HTMLDivElement>(null),
    backButton = useRef<HTMLButtonElement>(null);
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
    if (selected !== null && previousCard.current === null) backButton.current?.focus();
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
          overlayClassName="inspection-overlay"
          overlayChildren={<EffectBackdropHost scope="inspection" />}
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
                : creatureKeywords(kind, enemy ? undefined : game),
            )}
          />
          <header className="inspection-back" data-nav-row>
            <Button
              ref={backButton}
              size="icon"
              aria-label="Back"
              variant="ghost"
              onClick={() => {
                if (!back()) onClose();
              }}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            {!card ? <DialogTitle>{enemy?.name ?? creature.name}</DialogTitle> : null}
          </header>
          {card ? (
            <>
              <DialogTitle className="sr-only">{definition(card.definitionId).name} details</DialogTitle>
              <DialogDescription className="sr-only">
                Action artwork. Hover or focus for the name, Mana cost, and final effects.
              </DialogDescription>
              <ActionCard
                card={card}
                ownerName={creature.name}
                actor={actor}
                modifiers={modifiers}
                enemy={!!enemy}
                enemyPower={enemy?.power}
                enemyValue={enemy ? enemyInspectionValue(enemy, definition(card.definitionId)) : undefined}
                onClick={() => {}}
              />
            </>
          ) : (
            <>
              <DialogDescription className="sr-only">
                Creature artwork, three abilities and current passive rank. Hover or focus abilities for their
                details.
              </DialogDescription>
              <div className="inspection-creature" data-nav-row>
                <CreatureCard
                  progression={enemy ? undefined : game}
                  kind={kind}
                  name={enemy?.name}
                  health={enemy?.health ?? ally?.health ?? creature.health}
                  maxHealth={enemy?.maxHealth ?? creature.health}
                  block={ally?.block ?? enemy?.block ?? 0}
                  combat={ally?.combat ?? enemy?.combat}
                  sharedDodge={ally || enemy ? sharedDodgeChance(game, (ally ?? enemy)!) : 0}
                  readout={false}
                  speciesKit
                  label={`${enemy?.name ?? creature.name} details`}
                />
              </div>
              <section className="inspection-abilities" aria-label="Abilities">
                <div className="inspection-thumbnails" ref={thumbnails} data-nav-row>
                  {cards.map((action, index) => (
                    <ActionCard
                      key={action.id}
                      card={action}
                      ownerName={creature.name}
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
              <section className="inspection-active-trait" aria-label="Trait">
                <h2>
                  <ShineText keywords={visualKeywords(passive.description)}>{creature.trait}</ShineText>
                </h2>
                <span
                  className="inspection-stars"
                  role="img"
                  aria-label={`${rank} of ${MAX_CREATURE_STARS} stars`}
                >
                  {Array.from({ length: MAX_CREATURE_STARS }, (_, index) => (
                    <Star key={index} aria-hidden="true" data-earned={index < rank} />
                  ))}
                </span>
                <p>
                  <KeywordText text={passive.description} />
                </p>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </EffectScope>
  );
}

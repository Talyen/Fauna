import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Session } from "../application/session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { ArtCard } from "./art-card";
import { ActionCard } from "./cards";
import { ActionDetails } from "./card-details";
import { CARDS, ENCOUNTERS, definition, species } from "../game/content";
import type { Card } from "../game/types";
import { returnFocus } from "./focus";
import type { Inspection, Controls } from "./battle-screen";

export function Inspector({
  item,
  session,
  controls,
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
  const ally = [...game.team, ...game.reserves].find((c) => c.species === kind);
  const enemyIndex =
    "enemyId" in item && item.enemyId?.startsWith("preview-") ? Number(item.enemyId.slice(8)) : -1;
  const preview = ENCOUNTERS[game.encounter]?.enemies[enemyIndex];
  const enemy = preview
    ? { ...preview, maxHealth: preview.health, marks: 0 }
    : "enemyId" in item
      ? game.battle?.enemies.find((e) => e.id === item.enemyId)
      : undefined;
  const actor = enemy ? undefined : ally;
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
    if (rootCard || selected === null) return false;
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
    controls.current = (action) => {
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
      controls.current = null;
    };
  });
  const card = selected === null ? null : cards[selected]!;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`inspection ${card ? "single-card" : "creature-inspection"}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus(opener);
        }}
      >
        {card ? (
          <>
            {!rootCard ? (
              <header className="inspection-back">
                <Button ref={backButton} variant="ghost" onClick={back}>
                  <ChevronLeft aria-hidden="true" />
                  Back
                </Button>
              </header>
            ) : null}
            <DialogTitle className="sr-only">{definition(card.definitionId).name} details</DialogTitle>
            <DialogDescription className="sr-only">
              Action artwork and final effect. Previous and Next browse this species' cards.
            </DialogDescription>
            <ActionCard card={card} ownerName={creature.name} actor={actor} presentation onClick={() => {}} />
            <ActionDetails card={card} ownerName={creature.name} modifiers={game} actor={actor} />
            <nav className="inspection-action-navigation" aria-label="Action cards">
              <Button variant="ghost" size="icon" aria-label="Previous action" onClick={() => cycle(-1)}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next action" onClick={() => cycle(1)}>
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          </>
        ) : (
          <>
            <DialogTitle>{enemy?.name ?? creature.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Creature artwork, current health and effects, passive, and three action cards.
            </DialogDescription>
            <ArtCard
              className="inspection-creature-art"
              aspect="creature"
              artwork={`./art/${kind}.svg`}
              presentation
              aria-label={enemy?.name ?? creature.name}
            />
            <div className="inspection-kit">
              <p className="inspection-health">
                {enemy?.health ?? ally?.health ?? creature.health}/{enemy?.maxHealth ?? creature.health}{" "}
                health
                {enemy?.marks ? ` · ${enemy.marks} marks` : ""}
                {!enemy && ally?.block ? ` · ${ally.block} block` : ""}
              </p>
              {enemy ? <h2 className="inspection-kit-label">Species kit · {creature.name}</h2> : null}
              <div className="inspection-passive">
                <strong>{creature.trait}</strong>
                <p>{creature.description}</p>
              </div>
              <div className="inspection-thumbnails" ref={thumbnails} data-nav-row>
                {cards.map((action, index) => (
                  <ActionCard
                    key={action.id}
                    card={action}
                    ownerName={creature.name}
                    actor={actor}
                    modifiers={game}
                    onClick={() => setSelected(index)}
                    onInspect={() => setSelected(index)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

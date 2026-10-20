import { enemyInspectionValue } from "../game/rules";
import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { ChevronLeft } from "lucide-react";
import type { Session } from "../application/session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { ActionCard, CreatureCard } from "./cards";
import { CARDS, definition, species } from "../game/content";
import { encounterSource, location } from "../game/destinations";
import type { Card } from "../game/types";
import { returnFocus } from "./focus";
import type { Inspection, Controls } from "./battle-screen";

export function Inspector({
  item,
  session,
  controls,
  onClose,
  chooseStarter,
  enterDestination,
}: {
  item: Exclude<Inspection, { support: string }>;
  session: Session;
  controls: Controls;
  onClose: () => void;
  chooseStarter?: () => boolean;
  enterDestination?: (destination: string) => boolean;
}) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const game = useStore(session.store, (s) => s.game);
  const rootCard = "card" in item ? item.card : null;
  const destination = "destination" in item ? item.destination : null;
  const [destinationEnemy, setDestinationEnemy] = useState<number | null>(null);
  const pack = destination ? encounterSource(game, destination) : null;
  const kind =
    "card" in item
      ? definition(item.card.definitionId).species
      : "species" in item
        ? item.species
        : pack!.enemies[destinationEnemy ?? 0]!.species;
  const creature = species(kind);
  const creatureId = rootCard?.ownerId ?? ("creatureId" in item ? item.creatureId : undefined);
  const ally = creatureId ? [...game.team, ...game.reserves].find((c) => c.id === creatureId) : undefined;
  const enemyIndex =
    "enemyId" in item && item.enemyId?.startsWith("preview-") ? Number(item.enemyId.slice(8)) : -1;
  const preview =
    pack && destinationEnemy !== null
      ? pack.enemies[destinationEnemy]
      : enemyIndex >= 0
        ? encounterSource(game).enemies[enemyIndex]
        : undefined;
  const enemy = preview
    ? { ...preview, maxHealth: preview.health }
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
  const packRoot = useRef<HTMLDivElement>(null);
  const previousEnemy = useRef(destinationEnemy);
  useLayoutEffect(() => {
    if (previousEnemy.current !== null && destinationEnemy === null)
      returnFocus(
        packRoot.current?.querySelectorAll<HTMLButtonElement>("button")[previousEnemy.current] ?? null,
      );
    else if (previousEnemy.current === null && destinationEnemy !== null) backButton.current?.focus();
    previousEnemy.current = destinationEnemy;
  }, [destinationEnemy]);
  const previousCard = useRef(selected),
    restore = useRef<number | null>(null);
  const cycle = (direction: number) =>
    setSelected((index) => (index === null ? null : (index + direction + cards.length) % cards.length));
  const back = () => {
    if (rootCard) return false;
    if (selected === null) {
      if (destinationEnemy === null) return false;
      setDestinationEnemy(null);
      return true;
    }
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
      if (action === "inspect" && destination && destinationEnemy === null) {
        const index = Number(
          (document.activeElement as HTMLElement | null)
            ?.closest<HTMLElement>("[data-enemy-id]")
            ?.dataset.enemyId?.slice(8),
        );
        if (Number.isInteger(index) && pack?.enemies[index]) {
          setDestinationEnemy(index);
          return true;
        }
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
        className={`inspection ${destination && destinationEnemy === null ? "destination-inspection" : card ? "single-card" : "creature-inspection"}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus(opener);
        }}
      >
        {destination && destinationEnemy === null ? null : (
          <header className="inspection-back">
            <Button
              ref={backButton}
              variant="ghost"
              onClick={() => {
                if (!back()) onClose();
              }}
            >
              <ChevronLeft aria-hidden="true" />
              Back
            </Button>
          </header>
        )}
        {destination && destinationEnemy === null ? (
          <>
            <DialogTitle>{location(destination)!.name}</DialogTitle>
            <DialogDescription>{game.expedition!.step === 3 ? "Boss" : "Combat"}</DialogDescription>
            <div className="destination-enemies" ref={packRoot} data-nav-row aria-label="Enemy lineup">
              {pack!.enemies.map((entry, index) => (
                <div key={index}>
                  <CreatureCard
                    kind={entry.species}
                    name={entry.name}
                    enemyId={`preview-${index}`}
                    readout={false}
                    health={entry.health}
                    maxHealth={entry.health}
                    label={`Inspect ${entry.name}`}
                    onClick={() => setDestinationEnemy(index)}
                    onInspect={() => setDestinationEnemy(index)}
                  />
                  <h2>{entry.name}</h2>
                </div>
              ))}
            </div>
            <footer className="destination-footer">
              <Button variant="ghost" onClick={onClose}>
                Back
              </Button>
              <Button
                onClick={() => {
                  if (enterDestination?.(destination)) onClose();
                }}
              >
                Begin battle
              </Button>
            </footer>
          </>
        ) : card ? (
          <>
            <DialogTitle className="sr-only">{definition(card.definitionId).name} details</DialogTitle>
            <DialogDescription className="sr-only">
              Action artwork. Hover or focus for the name, Mana cost, and final effects.
            </DialogDescription>
            <ActionCard
              card={card}
              ownerName={creature.name}
              actor={actor}
              modifiers={enemy ? undefined : game}
              enemy={!!enemy}
              enemyValue={enemy ? enemyInspectionValue(enemy, definition(card.definitionId)) : undefined}
              onClick={() => {}}
            />
          </>
        ) : (
          <>
            <DialogTitle className="sr-only">{enemy?.name ?? creature.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Creature artwork and three action cards. Hover or focus for current state, passive, and action
              effects.
            </DialogDescription>
            <CreatureCard
              kind={kind}
              name={enemy?.name}
              health={enemy?.health ?? ally?.health ?? creature.health}
              maxHealth={enemy?.maxHealth ?? creature.health}
              block={ally?.block ?? (enemy && "block" in enemy ? (enemy.block as number) : 0)}
              combat={
                ally?.combat ??
                (enemy && "combat" in enemy
                  ? (enemy.combat as import("../game/types").CombatState)
                  : undefined)
              }
              readout={false}
              speciesKit
              label={`${enemy?.name ?? creature.name} details`}
            />
            <div className="inspection-thumbnails" ref={thumbnails} data-nav-row>
              {cards.map((action, index) => (
                <ActionCard
                  key={action.id}
                  card={action}
                  ownerName={creature.name}
                  actor={actor}
                  modifiers={enemy ? undefined : game}
                  enemy={!!enemy}
                  enemyValue={
                    enemy ? enemyInspectionValue(enemy, definition(action.definitionId)) : undefined
                  }
                  onClick={() => setSelected(index)}
                  onInspect={() => setSelected(index)}
                />
              ))}
            </div>
            {chooseStarter ? (
              <Button
                onClick={() => {
                  if (chooseStarter()) onClose();
                }}
              >
                Choose {creature.name}
              </Button>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

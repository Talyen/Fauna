import { PagedItems } from "./pagination";
import { creaturePassive, creatureStars } from "../game/progression";
import { KeywordText } from "./keyword-text";
import { enemyInspectionValue } from "../game/rules";
import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { ChevronLeft } from "lucide-react";
import type { Session } from "../application/session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { ActionCard, CreatureCard } from "./cards";
import { CARDS, definition, species } from "../game/content";
import type { Card } from "../game/types";
import { isAvailableFocusTarget, returnFocus } from "./focus";
import type { Inspection, Controls } from "./battle-screen";

export function Inspector({
  item,
  session,
  controls,
  onClose,
  chooseStarter,
}: {
  item: Inspection;
  session: Session;
  controls: Controls;
  onClose: () => void;
  chooseStarter?: () => boolean;
}) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const game = useStore(session.store, (s) => s.game);
  const rootCard = "card" in item ? item.card : null;
  const kind = "card" in item ? definition(item.card.definitionId).species : item.species;
  const creature = species(kind);
  const creatureId = rootCard?.ownerId ?? ("creatureId" in item ? item.creatureId : undefined);
  const ally = creatureId ? [...game.team, ...game.reserves].find((c) => c.id === creatureId) : undefined;
  const enemy = "enemyId" in item ? game.battle?.enemies.find((e) => e.id === item.enemyId) : undefined;
  const actor = enemy ? undefined : ally;
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
          const focused = document.activeElement as HTMLElement | null;
          if (focused !== document.body && isAvailableFocusTarget(focused)) return;
          returnFocus(opener);
        }}
      >
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
              progression={enemy ? undefined : game}
              kind={kind}
              name={enemy?.name}
              health={enemy?.health ?? ally?.health ?? creature.health}
              maxHealth={enemy?.maxHealth ?? creature.health}
              block={ally?.block ?? enemy?.block ?? 0}
              combat={ally?.combat ?? enemy?.combat}
              readout={false}
              speciesKit
              label={`${enemy?.name ?? creature.name} details`}
            />
            <section className="inspection-abilities" aria-label="Abilities">
              <h2>Abilities</h2>
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
            </section>
            <section className="passive-tiers" aria-label={`${creature.trait} passive tiers`}>
              <h2>Traits</h2>
              <div className="inspection-active-trait">
                <h3>{creature.trait}</h3>
                <p>
                  <KeywordText text={passive.description} />
                </p>
              </div>
              <h3>Rank progression</h3>
              <p>
                {enemy
                  ? "Species kit · Enemy passives use the base tier."
                  : `Collection rank: ${rank} / 5 stars`}
              </p>
              <PagedItems
                items={creature.passiveTiers}
                pageSize={1}
                className="passive-tier-page"
                contentRole="list"
                label="Passive tier pages"
              >
                {(tier, tierRank) => (
                  <div role="listitem" key={tierRank} aria-current={tierRank === rank ? "step" : undefined}>
                    <strong>
                      {tierRank} {tierRank === 1 ? "star" : "stars"}
                      {tierRank === rank ? " · Current rank" : ""}
                      {tierRank === passive.rank ? " · Active effect" : ""}
                    </strong>
                    <p>{tier ? <KeywordText text={tier.description} /> : "Not yet defined"}</p>
                  </div>
                )}
              </PagedItems>
            </section>
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

import { sharedDodgeChance } from "../../game/combat";
import { PagedItems } from "../shared/pagination";
import { creaturePassive, creatureStars } from "../../game/progression";
import { KeywordText } from "../shared/keyword-text";
import { enemyInspectionValue } from "../../game/rules";
import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { ChevronLeft } from "lucide-react";
import type { Session } from "../../application/session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { ActionCard, CreatureCard } from "../shared/cards";
import { CARDS, definition, species } from "../../game/content";
import type { Card } from "../../game/types";
import { isAvailableFocusTarget, returnFocus } from "../shared/focus";
import type { Inspection } from "./model";
import type { Controls } from "../shared/input";
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
  const [showRanks, setShowRanks] = useState(false);
  const rankButton = useRef<HTMLButtonElement>(null);
  const restoreRank = useRef(false);
  const chosenStarter = useRef(false);
  const thumbnails = useRef<HTMLDivElement>(null),
    backButton = useRef<HTMLButtonElement>(null);
  const previousCard = useRef(selected),
    restore = useRef<number | null>(null);
  const cycle = (direction: number) =>
    setSelected((index) => (index === null ? null : (index + direction + cards.length) % cards.length));
  const back = () => {
    if (rootCard) return false;
    if (showRanks) {
      restoreRank.current = true;
      setShowRanks(false);
      return true;
    }
    if (selected === null) return false;
    restore.current = selected;
    setSelected(null);
    return true;
  };
  useLayoutEffect(() => {
    if (showRanks) backButton.current?.focus();
    else if (restoreRank.current) {
      restoreRank.current = false;
      returnFocus(rankButton.current);
    }
  }, [showRanks]);
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
        className={`inspection ${card ? "single-card" : "creature-inspection"}${showRanks ? " rank-inspection" : ""}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Completing the draft can replace the opener when its slot changes.
          if (chosenStarter.current) {
            returnFocus(document.querySelector<HTMLElement>(`.draft-grid [data-species="${kind}"]`));
            return;
          }
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
            <DialogTitle className="sr-only">
              {enemy?.name ?? creature.name}
              {showRanks ? " rank progression" : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {showRanks
                ? "Creature artwork and paginated passive tiers. Back returns to the creature kit."
                : "Creature artwork, current trait and three action cards. Hover or focus for current state and action effects."}
            </DialogDescription>
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
            {!showRanks ? (
              <>
                <section className="inspection-active-trait" aria-label="Trait">
                  <h2>{creature.trait}</h2>
                  <p>
                    <KeywordText text={passive.description} />
                  </p>
                </section>
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
                <footer className="inspection-actions" data-nav-row>
                  <Button ref={rankButton} variant="outline" onClick={() => setShowRanks(true)}>
                    Rank progression
                  </Button>
                  {chooseStarter ? (
                    <Button
                      onClick={() => {
                        if (chooseStarter()) {
                          chosenStarter.current = true;
                          onClose();
                        }
                      }}
                    >
                      Choose {creature.name}
                    </Button>
                  ) : null}
                </footer>
              </>
            ) : (
              <section className="passive-tiers" aria-label={`${creature.trait} passive tiers`}>
                <h2>Rank progression</h2>
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
                      <p>
                        <KeywordText text={tier.description} />
                      </p>
                    </div>
                  )}
                </PagedItems>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

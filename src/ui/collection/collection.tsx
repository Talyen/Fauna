import { useMessages } from "../shared/localization/message-context";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PageControls, usePagination, useGridColumns } from "../shared/navigation/pagination";

import { EmptyState } from "../shared/empty-state";

import { assetUrl } from "../shared/assets";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { useLayoutEffect, useRef, useState } from "react";
import { Star, LayoutGrid, BookOpen, LockKeyhole } from "lucide-react";

import { CreatureCard } from "../shared/cards/cards";
import { ArtCard } from "../shared/cards/art-card";
import { returnFocus } from "../shared/navigation/focus";
import type { Inspection } from "../shared/inspection-model";
import { SPECIES, type SpeciesId } from "../../game/content";
import { creatureStars, MAX_CREATURE_STARS } from "../../game/progression";
import type { GameState } from "../../game/types";
import type { Controls } from "../shared/navigation/input";

export function Collection({
  game,
  controls: controlsRef,
  openMenu,
  inspect,
}: {
  game: GameState;
  controls: Controls;
  openMenu: () => void;
  inspect: (item: Inspection) => void;
}) {
  const i18n = useMessages();
  const showCreature = (kind: SpeciesId) => inspect({ species: kind, speciesKit: true });
  useLayoutEffect(() => {
    controlsRef.current = (action) => {
      if (action !== "inspect") return false;
      const button = document.activeElement?.closest<HTMLButtonElement>(
        ".collection-grid button[data-species]",
      );
      const kind = button?.dataset.species as SpeciesId | undefined;
      if (!kind) return false;
      showCreature(kind);
      return true;
    };
    return () => {
      controlsRef.current = null;
    };
  });
  const [filter, setFilter] = useState("all");
  const gridRef = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(gridRef, 4, filter);
  const known = (id: SpeciesId) => game.discovery.recruited[id] !== undefined;
  const collected: (typeof SPECIES)[number][] = [],
    uncollected: (typeof SPECIES)[number][] = [];
  for (const entry of SPECIES) (known(entry.id) ? collected : uncollected).push(entry);
  const ordered =
    filter === "known" ? collected : filter === "unknown" ? uncollected : [...collected, ...uncollected];
  const pageSize = columns * 2;
  const {
    page: activePage,
    pages: totalPages,
    start: pageStart,
    change,
  } = usePagination(ordered.length, pageSize, filter);
  const focusedControl = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (
      focusedControl.current &&
      !focusedControl.current.isConnected &&
      document.activeElement === document.body
    )
      returnFocus(gridRef.current?.querySelector<HTMLElement>("button:not(:disabled)") ?? null);
  }, [pageStart, filter, columns]);
  return (
    <div className="collection-gallery-page">
      <Screen
        className="collection-screen"
        onFocusCapture={(event) => {
          focusedControl.current = event.target as HTMLElement;
        }}
      >
        <header className="collection-heading">
          <ScreenHeading back={openMenu} openMenu={openMenu}>
            {i18n.message("menu.collection", "Collection")}
          </ScreenHeading>
        </header>
        <Tabs
          className="collection-tabs"
          value={filter}
          onValueChange={(value) => {
            setFilter(value);
          }}
        >
          <TabsList aria-label={i18n.message("collection.filter", "Collection filter")}>
            <TabsTrigger value="all">
              <LayoutGrid aria-hidden="true" />
              {i18n.message("collection.all", "All")}
            </TabsTrigger>
            <TabsTrigger value="known">
              <BookOpen aria-hidden="true" />
              {i18n.message("collection.collected", "Collected")}
            </TabsTrigger>
            <TabsTrigger value="unknown">
              <LockKeyhole aria-hidden="true" />
              {i18n.message("collection.uncollected", "Uncollected")}
            </TabsTrigger>
          </TabsList>
          <TabsContent className="collection-content" value={filter}>
            <div className="collection-gallery">
              <div className="collection-grid" ref={gridRef}>
                {ordered.slice(activePage * pageSize, (activePage + 1) * pageSize).map((creature) => {
                  const isKnown = known(creature.id);
                  const stars = isKnown ? creatureStars(game, creature.id) : 0;
                  return isKnown ? (
                    <div className="collection-entry" key={creature.id}>
                      <CreatureCard
                        progression={game}
                        kind={creature.id}
                        onClick={() => showCreature(creature.id)}
                        onInspect={() => showCreature(creature.id)}
                        label={i18n.message("collection.inspect", "Inspect {{name}}", {
                          name: i18n.content(`content.species.${creature.id}.name`, creature.name),
                        })}
                      />
                      <span
                        className="collection-stars"
                        role="img"
                        aria-label={i18n.message(
                          "collection.stars",
                          "{{name}}: {{rank}} of {{maximum}} stars",
                          {
                            name: i18n.content(`content.species.${creature.id}.name`, creature.name),
                            rank: stars,
                            maximum: MAX_CREATURE_STARS,
                          },
                        )}
                      >
                        {Array.from({ length: MAX_CREATURE_STARS }, (_, index) => (
                          <Star key={index} aria-hidden="true" data-earned={index < stars} />
                        ))}
                      </span>
                    </div>
                  ) : (
                    <div key={creature.id} className="locked-species">
                      <ArtCard
                        aspect="creature"
                        artwork={assetUrl(`creature.${creature.id}`)}
                        presentation
                        aria-label={i18n.message("collection.locked", "Locked species")}
                      />
                    </div>
                  );
                })}
              </div>
              {ordered.length === 0 ? (
                <EmptyState label={i18n.message("collection.empty", "No creatures in this view")} />
              ) : null}
            </div>
            <div className="collection-pagination">
              {totalPages > 1 ? (
                <PageControls
                  page={activePage}
                  pages={totalPages}
                  change={change}
                  label={i18n.message("collection.pages", "Collection pages")}
                  showCount={false}
                />
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </Screen>
    </div>
  );
}

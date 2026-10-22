import { Screen, ScreenHeading } from "../shared/screen";
import { PageControls } from "../shared/pagination";

import { EmptyState } from "../shared/empty-state";

import { assetUrl } from "../shared/assets";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { useLayoutEffect, useRef, useState } from "react";
import { Star, LayoutGrid, BookOpen, LockKeyhole } from "lucide-react";

import { CreatureCard } from "../shared/cards";
import { ArtCard } from "../shared/art-card";
import { CollectionCreature } from "./collection-creature";
import { returnFocus } from "../shared/focus";
import { SPECIES, species, type SpeciesId } from "../../game/content";
import { creatureStars, MAX_CREATURE_STARS } from "../../game/progression";
import type { Command, GameState } from "../../game/types";
import type { Inspection } from "../inspection/model";
import type { Controls } from "../shared/input";

type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function Collection({
  game,
  controls,
  openMenu,
}: {
  game: GameState;
  controls: Controls;
  openMenu: () => void;
}) {
  const [selected, setSelected] = useState<SpeciesId | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const returning = useRef(false);
  const showCreature = (kind: SpeciesId) => {
    opener.current = document.activeElement as HTMLElement | null;
    setSelected(kind);
  };
  const back = () => {
    returning.current = true;
    setSelected(null);
  };
  useLayoutEffect(() => {
    controls.current = (action) => {
      if (action === "inspect" && !selected) {
        const button = document.activeElement?.closest<HTMLButtonElement>(
          ".collection-grid button[data-species]",
        );
        const kind = button?.dataset.species as SpeciesId | undefined;
        if (!kind) return false;
        showCreature(kind);
        return true;
      }
      if (action !== "back" || !selected) return false;
      back();
      return true;
    };
    return () => {
      controls.current = null;
    };
  }, [controls, selected]);
  useLayoutEffect(() => {
    if (!selected && returning.current) {
      returning.current = false;
      returnFocus(opener.current);
    }
  }, [selected]);
  const [filter, setFilter] = useState("all");
  const [pageStarts, setPageStarts] = useState<Record<string, number>>({});
  const pageStart = pageStarts[filter] ?? 0;
  const setPageStart = (start: number) => setPageStarts((current) => ({ ...current, [filter]: start }));
  const [columns, setColumns] = useState(4);
  const gridRef = useRef<HTMLDivElement>(null);
  const focusedControl = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (
      focusedControl.current &&
      !focusedControl.current.isConnected &&
      document.activeElement === document.body
    )
      returnFocus(gridRef.current?.querySelector<HTMLElement>("button:not(:disabled)") ?? null);
  }, [pageStart, filter, columns]);
  const known = (id: SpeciesId) => game.discovery.recruited[id] !== undefined;
  const ordered = [...SPECIES]
    .filter((entry) => filter === "all" || (filter === "known" ? known(entry.id) : !known(entry.id)))
    .sort((a, b) => Number(known(b.id)) - Number(known(a.id)));
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const width = grid.getBoundingClientRect().width;
      const itemWidth = grid.firstElementChild?.getBoundingClientRect().width ?? 0;
      if (!width || !itemWidth) return;
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      setColumns(Math.max(1, Math.min(4, Math.floor((width + gap) / (itemWidth + gap)))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    if (grid.firstElementChild) observer.observe(grid.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [filter]);
  const pageSize = columns * 2;
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const activePage = Math.min(Math.floor(pageStart / pageSize), totalPages - 1);
  if (pageStart >= ordered.length && pageStart !== 0) setPageStart(activePage * pageSize);
  return (
    <>
      <div className="collection-gallery-page" hidden={selected !== null} inert={selected !== null}>
        <Screen
          className="collection-screen"
          onFocusCapture={(event) => {
            focusedControl.current = event.target as HTMLElement;
          }}
        >
          <header className="collection-heading">
            <ScreenHeading back={openMenu} openMenu={openMenu}>
              Collection
            </ScreenHeading>
          </header>
          <Tabs
            className="collection-tabs"
            value={filter}
            onValueChange={(value) => {
              setFilter(value);
            }}
          >
            <TabsList aria-label="Collection filter">
              <TabsTrigger value="all">
                <LayoutGrid aria-hidden="true" />
                All
              </TabsTrigger>
              <TabsTrigger value="known">
                <BookOpen aria-hidden="true" />
                Collected
              </TabsTrigger>
              <TabsTrigger value="unknown">
                <LockKeyhole aria-hidden="true" />
                Uncollected
              </TabsTrigger>
            </TabsList>
            <TabsContent className="collection-content" value={filter}>
              <div className="collection-gallery">
                <div className="collection-grid" ref={gridRef}>
                  {ordered.slice(activePage * pageSize, (activePage + 1) * pageSize).map((creature) =>
                    known(creature.id) ? (
                      <div className="collection-entry" key={creature.id}>
                        <CreatureCard
                          progression={game}
                          kind={creature.id}
                          onClick={() => showCreature(creature.id)}
                          onInspect={() => showCreature(creature.id)}
                          label={`Inspect ${creature.name}`}
                        />
                        <span
                          className="collection-stars"
                          role="img"
                          aria-label={`${creature.name}: ${creatureStars(game, creature.id)} of ${MAX_CREATURE_STARS} stars`}
                        >
                          {Array.from({ length: MAX_CREATURE_STARS }, (_, index) => (
                            <Star
                              key={index}
                              aria-hidden="true"
                              data-earned={index < creatureStars(game, creature.id)}
                            />
                          ))}
                        </span>
                      </div>
                    ) : (
                      <div key={creature.id} className="locked-species">
                        <ArtCard
                          aspect="creature"
                          artwork={assetUrl(`creature.${creature.id}`)}
                          presentation
                          aria-label="Locked species"
                        />
                      </div>
                    ),
                  )}
                </div>
                {ordered.length === 0 ? <EmptyState label="No creatures in this view" /> : null}
              </div>
              <div className="collection-pagination">
                {totalPages > 1 ? (
                  <PageControls
                    page={activePage}
                    pages={totalPages}
                    change={(next) => setPageStart(next * pageSize)}
                    label="Collection pages"
                    showCount={false}
                  />
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </Screen>
      </div>
      {selected ? <CollectionCreature game={game} kind={selected} back={back} openMenu={openMenu} /> : null}
    </>
  );
}

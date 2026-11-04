/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Read-only artwork needs keyboard focus to expose the same details as hover */
import { useMessages } from "../shared/localization/message-context";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PageControls, usePagination, useGridColumns } from "../shared/navigation/pagination";

import { assetUrl } from "../shared/assets";
import { BoonArt, BoonName, BoonText } from "../expedition/boon-presentation";
import { CreatureDetails } from "../shared/cards/card-details";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { useLayoutEffect, useRef, useState } from "react";
import { Star, PawPrint, Gift } from "lucide-react";

import { CreatureCard } from "../shared/cards/cards";
import { ArtCard } from "../shared/cards/art-card";
import { creatureKeywords } from "../shared/effects/palettes";
import { returnFocus } from "../shared/navigation/focus";
import type { Inspection } from "../shared/inspection-model";
import { BOONS, SPECIES, type SpeciesId } from "../../game/content";
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
  const [view, setView] = useState("fauna");
  const gridRef = useRef<HTMLDivElement>(null);
  const measuredColumns = useGridColumns(gridRef, 4, view);
  const columns = Math.min(measuredColumns, view === "fauna" ? 3 : 4);
  const known = (id: SpeciesId) => game.discovery.recruited[id] !== undefined;
  const collected: (typeof SPECIES)[number][] = [],
    uncollected: (typeof SPECIES)[number][] = [];
  for (const entry of SPECIES) (known(entry.id) ? collected : uncollected).push(entry);
  const ordered = [...collected, ...uncollected];
  const pageSize = columns * 2;
  const {
    page: activePage,
    pages: totalPages,
    start: pageStart,
    change,
  } = usePagination(view === "fauna" ? ordered.length : BOONS.length, pageSize, view);
  const focusedControl = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (
      focusedControl.current &&
      !focusedControl.current.isConnected &&
      document.activeElement === document.body
    )
      returnFocus(gridRef.current?.querySelector<HTMLElement>("button:not(:disabled)") ?? null);
  }, [pageStart, view, columns]);
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
        <Tabs className="collection-tabs" value={view} onValueChange={setView}>
          <TabsList aria-label={i18n.message("collection.views", "Collection views")}>
            <TabsTrigger value="fauna">
              <PawPrint aria-hidden="true" />
              {i18n.message("collection.fauna", "Fauna")}
            </TabsTrigger>
            <TabsTrigger value="boons">
              <Gift aria-hidden="true" />
              {i18n.message("menu.boons", "Boons")}
            </TabsTrigger>
          </TabsList>
          <TabsContent className="collection-content mt-0" value={view}>
            <div className="collection-grid" data-view={view} ref={gridRef}>
              {view === "fauna"
                ? ordered.slice(activePage * pageSize, (activePage + 1) * pageSize).map((creature) => {
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
                      <Tooltip key={creature.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="locked-species"
                            tabIndex={0}
                            role="img"
                            aria-label={i18n.message("collection.locked", "Locked species")}
                          >
                            <ArtCard
                              aspect="creature"
                              artwork={assetUrl(`creature.${creature.id}`)}
                              presentation
                              effectKeywords={creatureKeywords(creature.id, game)}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <CreatureDetails progression={game} kind={creature.id} />
                        </TooltipContent>
                      </Tooltip>
                    );
                  })
                : BOONS.slice(activePage * pageSize, (activePage + 1) * pageSize).map((boon) => (
                    <Tooltip key={boon.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="collection-boon"
                          role="img"
                          tabIndex={0}
                          aria-label={i18n.content(`content.boon.${boon.id}.name`, boon.name)}
                        >
                          <BoonArt boon={boon} presentation />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <strong>
                          <BoonName boon={boon} />
                        </strong>
                        <BoonText boon={boon} />
                      </TooltipContent>
                    </Tooltip>
                  ))}
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

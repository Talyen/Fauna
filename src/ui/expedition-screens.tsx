import { canVisitCampfire } from "../game/support";
import { SupportOffer } from "./support-screen";
import { assetUrl } from "./assets";
import { KeywordText } from "./keyword-text";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ActionCard, CreatureCard } from "./cards";
import { ArtCard } from "./art-card";
import { returnFocus } from "./focus";
import { SPECIES, species, type SpeciesId } from "../game/content";
import {
  KEYWORDS,
  BOONS,
  TALENTS,
  keywordLabel,
  keywordProgress,
  availablePoints,
  canBuyTalent,
  type Keyword,
} from "../game/progression";
import type { Command, GameState } from "../game/types";
import type { Inspection } from "./battle-screen";
import { Progress } from "./progress";
import { BattleEarnings } from "./battle-earnings";
import { BIOMES, encounterSource, location } from "../game/destinations";
type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function TeamSelection({ game, send, inspect, deck }: Props & { deck: () => void }) {
  if (game.expedition) {
    const route = game.expedition;
    return (
      <main className="destinations-screen">
        <header className="destination-heading">
          <h1>{BIOMES[route.biome]!.name}</h1>
          <p>{route.step === 3 ? "Boss" : `Encounter ${route.step + 1} of 3`}</p>
        </header>
        <section className="destination-grid" data-nav-row aria-label="Destinations">
          <SupportOffer game={game} inspect={inspect} />
          {canVisitCampfire(game) ? (
            <div className="destination-option">
              <ArtCard
                aspect="creature"
                artwork={assetUrl("location.ember-grove")}
                aria-label="Visit Campfire"
                onClick={() => send({ type: "visitCampfire" })}
              />
              <h2>Campfire</h2>
              <p>Rest</p>
            </div>
          ) : null}
          {route.offers.map((offer) => (
            <div className="destination-option" key={offer.location}>
              <ArtCard
                aspect="creature"
                artwork={assetUrl(`location.${offer.location}`)}
                data-destination={offer.location}
                aria-label={`Inspect ${location(offer.location)!.name}`}
                onClick={() => inspect({ destination: offer.location })}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.currentTarget.focus();
                  inspect({ destination: offer.location });
                }}
              />
              <h2>{location(offer.location)!.name}</h2>
              <p>{route.step === 3 ? "Boss" : "Combat"}</p>
            </div>
          ))}
        </section>
        <BattleEarnings game={game} />
        <footer className="destination-footer">
          <Button variant="outline" onClick={deck}>
            Deck
          </Button>
        </footer>
      </main>
    );
  }
  return (
    <main className="team-selection">
      <section className="selection-row" data-nav-row aria-label="Enemy lineup">
        {encounterSource(game).enemies.map((enemy, index) => (
          <CreatureCard
            key={index}
            kind={enemy.species}
            name={enemy.name}
            enemyId={`preview-${index}`}
            readout={false}
            health={enemy.health}
            maxHealth={enemy.health}
            label={`Inspect ${enemy.name}`}
            onInspect={() => inspect({ species: enemy.species, enemyId: `preview-${index}` })}
            onClick={() => inspect({ species: enemy.species, enemyId: `preview-${index}` })}
          />
        ))}
      </section>
      <footer className="selection-footer">
        <Button variant="outline" onClick={deck}>
          Deck
        </Button>
        <Button onClick={() => send({ type: "beginBattle" })}>Begin battle</Button>
      </footer>
    </main>
  );
}
export function Draft({ game, send, inspect }: Props) {
  return (
    <main className="draft-screen">
      <h1>Choose your starter</h1>
      <div className="draft-grid" data-nav-row>
        {SPECIES.filter((s) => game.unlocked.includes(s.id)).map((s) => (
          <div className="starter-option" key={s.id}>
            <CreatureCard
              kind={s.id}
              selected={game.selected.includes(s.id)}
              onClick={() => inspect({ species: s.id })}
              onInspect={() => inspect({ species: s.id })}
              label={`Inspect ${s.name}`}
              tooltips={false}
            />
            <h2>{s.name}</h2>
            <span className="starter-selection">
              {game.selected.includes(s.id) ? (
                <>
                  <Check aria-hidden="true" /> Selected
                </>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <footer className="selection-footer" data-nav-row>
        <Button disabled={game.selected.length !== 1} onClick={() => send({ type: "start" })}>
          Begin journey
        </Button>
      </footer>
    </main>
  );
}
export function Rewards({ game, send, inspect }: Props) {
  const [incoming, setIncoming] = useState<SpeciesId | null>(null);
  const choices = useRef<HTMLElement>(null);
  const returnTo = useRef<number | null>(null);
  useLayoutEffect(() => {
    const buttons = choices.current?.querySelectorAll<HTMLButtonElement>(".creature-card");
    if (incoming) returnFocus(buttons?.[0] ?? null);
    else if (returnTo.current !== null) {
      returnFocus(buttons?.[returnTo.current] ?? null);
      returnTo.current = null;
    }
  }, [incoming]);
  const reward = game.reward!;
  const recruiting = game.phase === "recruit";
  return (
    <main className="reward-screen">
      <header className="reward-heading">
        <h1>Victory</h1>
        <BattleEarnings game={game} detailed />
      </header>
      <section className="reward-choices" ref={choices}>
        <div className="reward-choice-content">
          <h2>{recruiting ? (incoming ? "Replace a creature" : "Choose a Recruit") : "Choose a Boon"}</h2>
          {recruiting ? (
            <div className="recruit-options">
              {(incoming
                ? [...game.team, ...game.reserves].map((creature) => ({
                    kind: creature.species,
                    id: creature.id,
                  }))
                : reward.recruits.map((kind, index) => ({ kind, id: String(index) }))
              ).map(({ kind, id }) => (
                <div className="reward-option" key={id}>
                  <CreatureCard
                    kind={kind}
                    actorId={incoming ? id : undefined}
                    label={incoming ? `Release ${species(kind).name}` : `Recruit ${species(kind).name}`}
                    onInspect={() =>
                      inspect(incoming ? { species: kind, creatureId: id } : { species: kind })
                    }
                    onClick={() => {
                      if (incoming) send({ type: "recruit", species: incoming, replace: id });
                      else if (game.roster.length === 5) {
                        returnTo.current = Number(id);
                        setIncoming(kind);
                      } else send({ type: "recruit", species: kind });
                    }}
                  />
                  <h2>{species(kind).name}</h2>
                </div>
              ))}
            </div>
          ) : (
            <div className="boon-options">
              {reward.boons.map((id) => {
                const boon = BOONS.find((r) => r.id === id)!;
                return (
                  <div className="reward-option" key={id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ArtCard
                          aspect="action"
                          artwork={assetUrl(`boon.${id}`)}
                          className="boon-choice"
                          aria-label={`Choose ${boon.name}`}
                          onClick={() => send({ type: "chooseBoon", boon: id })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <strong>{boon.name}</strong>
                        <p>{boon.text}</p>
                      </TooltipContent>
                    </Tooltip>
                    <h2>{boon.name}</h2>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <footer className="reward-footer">
        {incoming ? (
          <Button variant="outline" onClick={() => setIncoming(null)}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => send({ type: recruiting ? "skipRecruit" : "skipBoon" })}>
            Skip
          </Button>
        )}
      </footer>
    </main>
  );
}
export function Talents({ game, send, back }: { game: GameState; send: Props["send"]; back: () => void }) {
  const [keyword, setKeyword] = useState<Keyword>("physical");
  const p = keywordProgress(game.keywordXP[keyword] ?? 0);
  return (
    <main className="talents-screen">
      <header className="page-heading">
        <h1>Talents</h1>
        <Button variant="ghost" onClick={back}>
          Back
        </Button>
      </header>
      <Tabs value={keyword} onValueChange={(value) => setKeyword(value as Keyword)}>
        <TabsList className="keyword-tabs" aria-label="Talent keywords">
          {KEYWORDS.map((id) => (
            <TabsTrigger key={id} value={id}>
              <span data-keyword={id}>{keywordLabel(id)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={keyword}>
          <div className="talent-progress">
            <span>{availablePoints(game, keyword)} points available</span>
            <span>
              {p.current} / {p.required} XP
            </span>
          </div>
          <Progress
            value={p.current}
            maximum={p.required}
            label={`${keywordLabel(keyword)} XP`}
            tone={keyword}
          />
          <div className="talent-tree">
            {[
              ...new Set(TALENTS.filter((talent) => talent.keyword === keyword).map((talent) => talent.row)),
            ].map((row) => (
              <div className="talent-row" key={row} data-nav-row aria-label={`Row ${row + 1}`}>
                {TALENTS.filter((t) => t.keyword === keyword && t.row === row).map((t) => {
                  const owned = game.talents.includes(t.id),
                    available = canBuyTalent(game, t.id);
                  const earlierRowsOwned = TALENTS.filter(
                    (talent) => talent.keyword === keyword && talent.row < t.row,
                  ).every((talent) => game.talents.includes(talent.id));
                  const status = owned
                    ? "Unlocked"
                    : available
                      ? "Unlock · 1 point"
                      : !earlierRowsOwned
                        ? availablePoints(game, keyword) > 0
                          ? "Requires all earlier rows"
                          : "Requires 1 point and all earlier rows"
                        : "Requires 1 point";
                  return (
                    <Tooltip key={t.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className="talent-node"
                          aria-label={`${t.name}${owned ? ", unlocked" : ""}`}
                          aria-disabled={!available}
                          aria-describedby={`${t.id}-effect ${t.id}-status`}
                          data-owned={owned}
                          data-available={available}
                          onClick={() => {
                            if (available) send({ type: "buyTalent", talentId: t.id });
                          }}
                        >
                          <span>
                            {owned ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                          </span>
                          <span className="talent-name">{t.name}</span>
                          <span className="talent-effect" id={`${t.id}-effect`}>
                            <KeywordText text={t.text} />
                          </span>
                          <span className="talent-status" id={`${t.id}-status`}>
                            {status}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <strong>
                          {keywordLabel(keyword)} · {t.name}
                        </strong>
                        <p>
                          <KeywordText text={t.text} />
                        </p>
                        <p>{status}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
          <footer className="reward-footer">
            <Button
              variant="ghost"
              disabled={!game.talents.some((id) => id.startsWith(`${keyword}.`))}
              onClick={() => {
                if (send({ type: "resetTalents", keyword }))
                  document.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.focus();
              }}
            >
              Reset category
            </Button>
          </footer>
        </TabsContent>
      </Tabs>
    </main>
  );
}
export function Collection({
  game,
  inspect,
  back,
}: {
  game: GameState;
  inspect: Props["inspect"];
  back: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [columns, setColumns] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const tile = grid.querySelector(".creature-card");
      const width = tile?.getBoundingClientRect().width ?? 0;
      if (!width) return;
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      setColumns(Math.max(1, Math.min(3, Math.floor((grid.clientWidth + gap + 0.5) / (width + gap)))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [filter]);
  const known = (id: SpeciesId) => game.unlocked.includes(id) || game.discovery.encountered.includes(id);
  const ordered = [...SPECIES]
    .filter((entry) => filter === "all" || (filter === "known" ? known(entry.id) : !known(entry.id)))
    .sort((a, b) => Number(known(b.id)) - Number(known(a.id)));
  const pageSize = columns * 2;
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const activePage = Math.min(page, totalPages - 1);
  if (page !== activePage) setPage(activePage);
  return (
    <main className="collection-screen">
      <header className="collection-heading">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Back">
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1>Collection</h1>
      </header>
      <Tabs
        className="collection-tabs"
        value={filter}
        onValueChange={(value) => {
          setFilter(value);
          setPage(0);
        }}
      >
        <TabsList aria-label="Collection filter">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="known">Known</TabsTrigger>
          <TabsTrigger value="unknown">Unknown</TabsTrigger>
        </TabsList>
        <TabsContent className="collection-content" value={filter}>
          <div className="collection-gallery">
            <div className="collection-grid" ref={gridRef}>
              {ordered.slice(activePage * pageSize, (activePage + 1) * pageSize).map((creature) =>
                known(creature.id) ? (
                  <CreatureCard
                    key={creature.id}
                    kind={creature.id}
                    onClick={() => inspect({ species: creature.id })}
                    onInspect={() => inspect({ species: creature.id })}
                    label={`Inspect ${creature.name}`}
                  />
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
            {ordered.length === 0 ? <p>No creatures in this view.</p> : null}
          </div>
          <nav className="collection-pagination" aria-label="Collection pages">
            {totalPages > 1 ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous page"
                  disabled={activePage === 0}
                  onClick={() => setPage(activePage - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <span role="status" aria-live="polite">
                  {activePage + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next page"
                  disabled={activePage === totalPages - 1}
                  onClick={() => setPage(activePage + 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </>
            ) : null}
          </nav>
        </TabsContent>
      </Tabs>
    </main>
  );
}
export function DeckCards({
  game,
  inspect,
  pile,
}: {
  game: GameState;
  inspect: Props["inspect"];
  pile?: "draw" | "discard";
}) {
  const cards = game.cards
    .filter((card) => !pile || game.battle?.[pile].includes(card.id))
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId) || a.id.localeCompare(b.id));
  return (
    <div className="deck-grid">
      {cards.length === 0 ? (
        <p>{pile === "draw" ? "Draw Pile" : pile === "discard" ? "Discard Pile" : "Deck"} is empty.</p>
      ) : null}
      {cards.map((card) => {
        const owner = game.team.find((c) => c.id === card.ownerId)!;
        return (
          <ActionCard
            key={card.id}
            card={card}
            actor={owner}
            modifiers={game}
            ownerName={species(owner.species).name}
            onClick={() => inspect({ card })}
            onInspect={() => inspect({ card })}
          />
        );
      })}
    </div>
  );
}

import { PageControls, PagedItems, useCompactLayout } from "./pagination";
import { starterCount } from "../game/engine";
import { motionValue } from "./motion-values";
import { ResultPresentation } from "./result-presentation";
import { EmptyState } from "./empty-state";
import { canVisitCampfire } from "../game/support";
import { SupportOffer } from "./support-screen";
import { assetUrl } from "./assets";
import { KeywordText } from "./keyword-text";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Star,
  LayoutGrid,
  BookOpen,
  LockKeyhole,
  ArrowLeft,
  Check,
  Swords,
  ShieldPlus,
  Flame,
  Anvil,
  Snowflake,
  ShieldHalf,
  Zap,
  ShieldOff,
  FlaskConical,
  Hourglass,
  Leaf,
  Sprout,
  Sun,
  HeartHandshake,
  Droplets,
  Skull,
  Shield,
  ShieldCheck,
  HeartPlus,
  HeartPulse,
  Shell,
  BrickWall,
  Wind,
  Footprints,
  Heart,
  Link,
  Gem,
  Battery,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ActionCard, CreatureCard } from "./cards";
import { ArtCard } from "./art-card";
import { returnFocus } from "./focus";
import { SPECIES, species, type SpeciesId } from "../game/content";
import {
  creatureStars,
  MAX_CREATURE_STARS,
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
import type { Inspection, Controls } from "./battle-screen";
import { Progress } from "./progress";
import { BattleEarnings } from "./battle-earnings";
import { bossEncounter, JOURNEY_LENGTH } from "../game/encounters";
const originalTalentSymbols = [
  Swords,
  ShieldPlus,
  Flame,
  Anvil,
  Snowflake,
  ShieldHalf,
  Zap,
  ShieldOff,
  FlaskConical,
  Hourglass,
  Leaf,
  Sprout,
  Sun,
  HeartHandshake,
  Droplets,
  Skull,
  Shield,
  ShieldCheck,
  HeartPlus,
  HeartPulse,
  Shell,
  BrickWall,
  Wind,
  Footprints,
  Heart,
  Link,
  Gem,
  Battery,
];
const talentSymbols = Object.fromEntries(
  KEYWORDS.flatMap((keyword) => {
    const talents = TALENTS.filter((talent) => talent.keyword === keyword);
    const original = talents.slice(0, 2).map((talent) => originalTalentSymbols[TALENTS.indexOf(talent)]!);
    const symbols = [...original, ...originalTalentSymbols.filter((symbol) => !original.includes(symbol))];
    return talents.map((talent, index) => [talent.id, symbols[index]!] as const);
  }),
);
type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function TeamSelection({ game, send, inspect, deck }: Props & { deck: () => void }) {
  const boss = bossEncounter(game);
  return (
    <main className="destinations-screen">
      <header className="destination-heading">
        <h1>
          Encounter {game.encounter + 1} of {game.expedition ? JOURNEY_LENGTH : 3}
        </h1>
      </header>
      <section className="destination-grid" data-nav-row aria-label="Encounters">
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
        <div className="destination-option">
          <ArtCard
            aspect="creature"
            artwork={assetUrl(boss ? "encounter.boss" : "encounter.combat")}
            data-encounter
            aria-label={boss ? "Boss" : "Combat"}
            onClick={() => send({ type: "beginBattle" })}
          />
          <h2>{boss ? "Boss" : "Combat"}</h2>
        </div>
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

export function Draft({ game, send, inspect }: Props) {
  return (
    <main className="draft-screen">
      <h1>
        {game.selected.length < starterCount(game)
          ? `Choose your starter (${game.selected.length + 1} of ${starterCount(game)})`
          : "Your starter team"}
      </h1>
      <div className="draft-grid" data-nav-row>
        {(game.selected.length === starterCount(game) ? game.selected : game.starterOffers).map(
          (kind, index) => {
            const s = species(kind);
            return (
              <div className="starter-option" key={`${index}-${s.id}`}>
                <CreatureCard
                  progression={game}
                  kind={s.id}
                  selected={game.selected.length === starterCount(game)}
                  onClick={() => inspect({ species: s.id })}
                  onInspect={() => inspect({ species: s.id })}
                  label={`Inspect ${s.name}`}
                  tooltips={false}
                />
                <h2>{s.name}</h2>
                <span className="starter-selection">
                  {game.selected.length === starterCount(game) ? (
                    <>
                      <Check aria-hidden="true" /> Selected
                    </>
                  ) : null}
                </span>
              </div>
            );
          },
        )}
      </div>
      <footer className="selection-footer" data-nav-row>
        <Button
          disabled={game.selected.length !== starterCount(game)}
          onClick={() => send({ type: "start" })}
        >
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
    <ResultPresentation>
      <main className="reward-screen">
        <header className="reward-heading">
          <h1>Victory</h1>
          <BattleEarnings game={game} detailed />
        </header>
        <section className="reward-choices" ref={choices}>
          <div className="reward-choice-content">
            <h2>{recruiting ? (incoming ? "Replace a creature" : "Choose a Recruit") : "Choose a Boon"}</h2>
            {recruiting ? (
              <PagedItems
                key={incoming ?? "recruits"}
                className="recruit-options"
                label="Recruit pages"
                pageSize={3}
                items={
                  incoming
                    ? [...game.team, ...game.reserves].map((creature) => ({
                        kind: creature.species,
                        id: creature.id,
                      }))
                    : reward.recruits.map((kind, index) => ({ kind, id: String(index) }))
                }
              >
                {({ kind, id }) => (
                  <div className="reward-option" key={id}>
                    <CreatureCard
                      progression={game}
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
                    {!incoming ? (
                      <p className="collection-uncollected">
                        {!game.discovery.recruited[kind]
                          ? "Unlock in Collection"
                          : creatureStars(game, kind) === MAX_CREATURE_STARS
                            ? `${MAX_CREATURE_STARS} stars · Max`
                            : `${creatureStars(game, kind)} → ${creatureStars(game, kind) + 1} stars`}
                      </p>
                    ) : null}
                  </div>
                )}
              </PagedItems>
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
          ) : !recruiting ? (
            <Button variant="ghost" onClick={() => send({ type: "skipBoon" })}>
              Skip
            </Button>
          ) : null}
        </footer>
      </main>
    </ResultPresentation>
  );
}
export function Talents({
  game,
  send,
  back,
  controls,
}: {
  game: GameState;
  send: Props["send"];
  back: () => void;
  controls?: Controls;
}) {
  const compact = useCompactLayout();
  const [keyword, setKeyword] = useState<Keyword | null>(null);
  const [treeReset, setTreeReset] = useState(0);
  const [purchased, setPurchased] = useState<string | null>(null);
  const lastKeyword = useRef<Keyword | null>(null);
  const screen = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!purchased) return;
    const timer = setTimeout(() => setPurchased(null), motionValue("--motion-battle"));
    return () => clearTimeout(timer);
  }, [purchased]);
  useLayoutEffect(() => {
    if (keyword) {
      lastKeyword.current = keyword;
      returnFocus(screen.current?.querySelector<HTMLElement>(".talent-node") ?? null);
    } else if (lastKeyword.current)
      returnFocus(
        screen.current?.querySelector<HTMLElement>(`[data-talent-keyword="${lastKeyword.current}"]`) ?? null,
      );
    if (controls)
      controls.current = (action) => {
        if (action === "back" && keyword) {
          setKeyword(null);
          return true;
        }
        return false;
      };
    return () => {
      if (controls) controls.current = null;
    };
  }, [keyword, controls, treeReset]);
  const p = keywordProgress(keyword ? (game.keywordXP[keyword] ?? 0) : 0);
  const artwork: Record<Keyword, string> = {
    physical: "physical",
    burn: "fire",
    freeze: "ice",
    stun: "lightning",
    poison: "poison",
    nature: "nature",
    light: "light",
    bleed: "physical",
    block: "block",
    heal: "heal",
    armor: "block",
    dodge: "nature",
    leech: "light",
    mana: "ice",
  };
  return (
    <main className="talents-screen" data-view={keyword ? "tree" : "overview"} ref={screen}>
      <header className="page-heading talents-heading">
        <Button variant="outline" onClick={() => (keyword ? setKeyword(null) : back())}>
          Back
        </Button>
        <h1>{keyword ? keywordLabel(keyword) : "Talents"}</h1>
        {keyword ? (
          <Button
            variant="ghost"
            disabled={!game.talents.some((id) => id.startsWith(`${keyword}.`))}
            onClick={() => {
              if (send({ type: "resetTalents", keyword })) setTreeReset((value) => value + 1);
            }}
          >
            Reset {keywordLabel(keyword)} talents
          </Button>
        ) : null}
      </header>
      {keyword === null ? (
        <div className="talent-overview-viewport">
          <div className="talent-overview">
            {KEYWORDS.map((id) => {
              const points = availablePoints(game, id);
              return (
                <section className="talent-category" key={id}>
                  <ArtCard
                    aspect="action"
                    artwork={assetUrl(`keyword.${artwork[id]}`)}
                    data-talent-keyword={id}
                    aria-label={`${keywordLabel(id)} talents`}
                    aria-describedby={points > 0 ? `${id}-available-points` : undefined}
                    onClick={() => setKeyword(id)}
                  />
                  <h2>{keywordLabel(id)}</h2>
                  <p className="talent-category-points" id={`${id}-available-points`}>
                    {points > 0 ? `${points} ${points === 1 ? "point" : "points"} available` : null}
                  </p>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="talent-progress-group">
            <div className="talent-progress">
              <span aria-live="polite" aria-atomic="true">
                {availablePoints(game, keyword)} {availablePoints(game, keyword) === 1 ? "point" : "points"}{" "}
                available
              </span>
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
          </div>
          <PagedItems
            key={`${keyword}:${treeReset}`}
            className="talent-tree"
            label="Talent pages"
            pageSize={compact ? 1 : 2}
            items={[
              ...new Set(TALENTS.filter((talent) => talent.keyword === keyword).map((talent) => talent.row)),
            ]}
          >
            {(row) => (
              <div className="talent-row" key={row} data-nav-row aria-label={`Row ${row + 1}`}>
                {TALENTS.filter((t) => t.keyword === keyword && t.row === row).map((t) => {
                  const TalentSymbol = talentSymbols[t.id]!;
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
                          variant="outline"
                          className="talent-node"
                          aria-label={`${t.name}${owned ? ", unlocked" : ""}`}
                          aria-disabled={!available}
                          aria-describedby={`${t.id}-effect ${t.id}-status`}
                          data-owned={owned}
                          data-keyword={keyword}
                          data-purchased={purchased === t.id || undefined}
                          data-available={available}
                          onClick={() => {
                            if (available && send({ type: "buyTalent", talentId: t.id })) setPurchased(t.id);
                          }}
                        >
                          <span className="talent-card-heading">
                            <span data-keyword={keyword}>
                              <TalentSymbol className="talent-icon" aria-hidden="true" />
                            </span>
                            <span className="talent-name">{t.name}</span>
                          </span>
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
            )}
          </PagedItems>
        </>
      )}
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
  const compact = useCompactLayout();
  const [filter, setFilter] = useState("all");
  const [pageStart, setPageStart] = useState(0);
  const [columns, setColumns] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);
  const focusedControl = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (
      focusedControl.current &&
      !focusedControl.current.isConnected &&
      document.activeElement === document.body
    )
      returnFocus(gridRef.current?.querySelector<HTMLElement>("button:not(:disabled)") ?? null);
  }, [pageStart, filter, columns, compact]);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const tile = grid.querySelector(".creature-card");
      const width = tile?.getBoundingClientRect().width ?? 0;
      if (!width) return;
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const next = Math.max(1, Math.min(3, Math.floor((grid.clientWidth + gap + 0.5) / (width + gap))));
      setColumns(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [filter]);
  const known = (id: SpeciesId) => game.discovery.recruited[id] !== undefined;
  const ordered = [...SPECIES]
    .filter((entry) => filter === "all" || (filter === "known" ? known(entry.id) : !known(entry.id)))
    .sort((a, b) => Number(known(b.id)) - Number(known(a.id)));
  const pageSize = columns * (compact ? 1 : 2);
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const activePage = Math.min(Math.floor(pageStart / pageSize), totalPages - 1);
  if (pageStart >= ordered.length && pageStart !== 0) setPageStart(activePage * pageSize);
  return (
    <main
      className="collection-screen"
      onFocusCapture={(event) => {
        focusedControl.current = event.target as HTMLElement;
      }}
    >
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
          setPageStart(0);
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
                      onClick={() => inspect({ species: creature.id })}
                      onInspect={() => inspect({ species: creature.id })}
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
              />
            ) : null}
          </div>
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
  const compact = useCompactLayout();
  const cards = game.cards
    .filter((card) => !pile || game.battle?.[pile].includes(card.id))
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId) || a.id.localeCompare(b.id));
  return (
    <>
      {cards.length === 0 ? (
        <EmptyState
          label={`${pile === "draw" ? "Draw Pile" : pile === "discard" ? "Discard Pile" : "Deck"} is empty`}
        />
      ) : null}
      <PagedItems items={cards} pageSize={compact ? 3 : 6} className="deck-grid" label="Deck pages">
        {(card) => {
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
        }}
      </PagedItems>
    </>
  );
}

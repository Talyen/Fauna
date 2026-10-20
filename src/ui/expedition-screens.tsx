import { Keyword as KeywordLabel, KeywordText } from "./keyword-text";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useLayoutEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ActionCard, CreatureCard } from "./cards";
import { ArtCard } from "./art-card";
import { returnFocus } from "./focus";
import { SPECIES, species, type SpeciesId } from "../game/content";
import {
  KEYWORDS,
  RELICS,
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
          {route.offers.map((offer) => (
            <div className="destination-option" key={offer.location}>
              <ArtCard
                aspect="creature"
                artwork={`./art/locations/${offer.location}.svg`}
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
          <h2>{recruiting ? (incoming ? "Replace a creature" : "Choose a Recruit") : "Choose a Relic"}</h2>
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
            <div className="relic-options">
              {reward.relics.map((id) => {
                const relic = RELICS.find((r) => r.id === id)!;
                return (
                  <div className="reward-option" key={id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ArtCard
                          aspect="action"
                          artwork="./art/relic-placeholder.svg"
                          className="relic-choice"
                          aria-label={`Choose ${relic.name}`}
                          onClick={() => send({ type: "chooseRelic", relic: id })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <strong>{relic.name}</strong>
                        <p>{relic.text}</p>
                      </TooltipContent>
                    </Tooltip>
                    <h2>{relic.name}</h2>
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
          <Button variant="ghost" onClick={() => send({ type: recruiting ? "skipRecruit" : "skipRelic" })}>
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
              <KeywordLabel id={id} />
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
            {[0, 1, 2].map((row) => (
              <div className="talent-row" key={row} data-nav-row aria-label={`Row ${row + 1}`}>
                {TALENTS.filter((t) => t.keyword === keyword && t.row === row).map((t) => {
                  const owned = game.talents.includes(t.id),
                    available = canBuyTalent(game, t.id);
                  return (
                    <Tooltip key={t.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className="talent-node"
                          aria-label={`${t.name}${owned ? ", unlocked" : ""}`}
                          aria-disabled={!available}
                          data-owned={owned}
                          data-available={available}
                          onClick={() => {
                            if (available) send({ type: "buyTalent", talentId: t.id });
                          }}
                        >
                          <span>
                            {owned ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                          </span>
                          <span>{t.name}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <strong>
                          {keywordLabel(keyword)} · {t.name}
                        </strong>
                        <p>
                          <KeywordText text={t.text} />
                        </p>
                        <p>
                          {owned
                            ? "Unlocked"
                            : available
                              ? "1 point · Click to unlock"
                              : "Requires an available point and every talent in earlier rows."}
                        </p>
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
  const ordered = [...SPECIES].sort(
    (a, b) => Number(game.unlocked.includes(b.id)) - Number(game.unlocked.includes(a.id)),
  );
  return (
    <main className="collection-screen">
      <header className="page-heading">
        <h1>Collection</h1>
        <Button variant="ghost" onClick={back}>
          Back
        </Button>
      </header>
      <div className="collection-grid">
        {ordered.map((creature) =>
          game.unlocked.includes(creature.id) ? (
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
                artwork={`./art/${creature.id}.svg`}
                presentation
                aria-label="Locked species"
              />
            </div>
          ),
        )}
      </div>
    </main>
  );
}
export function DeckCards({ game, inspect }: { game: GameState; inspect: Props["inspect"] }) {
  return (
    <div className="deck-grid">
      {game.cards.map((card) => {
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

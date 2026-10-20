import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useState } from "react";
import { Coins, Gem, Feather, Shell, Leaf, Circle, Check, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ActionCard, CreatureCard } from "./cards";
import { ArtCard } from "./art-card";
import { ENCOUNTERS, SPECIES, species, type SpeciesId } from "../game/content";
import {
  KEYWORDS,
  RELICS,
  TALENTS,
  keywordLabel,
  keywordProgress,
  talentPoints,
  availablePoints,
  canBuyTalent,
  type Keyword,
} from "../game/progression";
import type { Command, GameState } from "../game/types";
import type { Inspection } from "./battle-screen";
import { Progress } from "./progress";
type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function TeamSelection({ game, send, inspect, deck }: Props & { deck: () => void }) {
  return (
    <main className="team-selection">
      <section className="selection-row" data-nav-row aria-label="Enemy lineup">
        {ENCOUNTERS[game.encounter]!.enemies.map((enemy, index) => (
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
          Begin expedition
        </Button>
      </footer>
    </main>
  );
}
export function Rewards({ game, send, inspect }: Props) {
  const [incoming, setIncoming] = useState<SpeciesId | null>(null);
  const reward = game.reward!;
  if (game.phase === "reward")
    return (
      <main className="reward-screen">
        <header className="reward-heading">
          <h1>{reward.outcome === "defeat" ? "Defeat" : "Rewards"}</h1>
          {reward.currency > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={`${reward.currency} currency earned; ${game.currency} total`}
                >
                  <Coins aria-hidden="true" />+{reward.currency}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Currency · {game.currency} total · Kept between expeditions</TooltipContent>
            </Tooltip>
          ) : null}
        </header>
        <section className="reward-xp" aria-label="Keyword XP earned">
          {KEYWORDS.filter((keyword) => (reward.xp[keyword] ?? 0) > 0).map((keyword) => {
            const gain = reward.xp[keyword]!,
              total = game.keywordXP[keyword] ?? 0,
              p = keywordProgress(total),
              points = p.points - talentPoints(Math.max(0, total - gain));
            return (
              <div className="reward-keyword" key={keyword} data-combat-tone={keyword}>
                <div className="reward-keyword-label">
                  <span>{keywordLabel(keyword)}</span>
                  <span>+{gain} XP</span>
                </div>
                <Progress
                  value={p.current}
                  maximum={p.required}
                  label={`${keywordLabel(keyword)} talent progress`}
                  tone={keyword}
                />
                <div className="reward-progress-detail">
                  <span>{points > 0 ? `+${points} talent point${points === 1 ? "" : "s"}` : ""}</span>
                  <span>
                    {p.current} / {p.required} XP
                  </span>
                </div>
              </div>
            );
          })}
        </section>
        <footer className="reward-footer">
          <Button onClick={() => send({ type: "continueReward" })}>Continue</Button>
        </footer>
      </main>
    );
  if (game.phase === "recruit")
    return (
      <main className="reward-screen">
        <h1>{incoming ? "Replace a creature" : "Recruit"}</h1>
        <div className="recruit-options">
          {(incoming ? game.roster : reward.recruits.filter((kind) => !game.roster.includes(kind))).map(
            (kind) => (
              <CreatureCard
                key={kind}
                kind={kind}
                label={incoming ? `Release ${species(kind).name}` : `Recruit ${species(kind).name}`}
                onInspect={() => inspect({ species: kind })}
                onClick={() => {
                  if (incoming) send({ type: "recruit", species: incoming, replace: kind });
                  else if (game.roster.length === 5) setIncoming(kind);
                  else send({ type: "recruit", species: kind });
                }}
              />
            ),
          )}
        </div>
        <footer className="reward-footer">
          {incoming ? (
            <Button variant="outline" onClick={() => setIncoming(null)}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => send({ type: "skipRecruit" })}>
              Skip
            </Button>
          )}
        </footer>
      </main>
    );
  return (
    <main className="reward-screen">
      <h1>Choose a relic</h1>
      <div className="relic-options">
        {reward.relics.map((id) => {
          const relic = RELICS.find((r) => r.id === id)!,
            Icon =
              id === "emberstone"
                ? Gem
                : id === "wind-feather"
                  ? Feather
                  : id === "river-shell"
                    ? Shell
                    : id === "living-seed"
                      ? Leaf
                      : Circle;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="card"
                  className="relic-choice"
                  aria-label={`Choose ${relic.name}`}
                  onClick={() => send({ type: "chooseRelic", relic: id })}
                >
                  <Icon aria-hidden="true" />
                  <span>{relic.name}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <strong>{relic.name}</strong>
                <p>{relic.text}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <footer className="reward-footer">
        <Button variant="ghost" onClick={() => send({ type: "skipRelic" })}>
          Skip
        </Button>
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
              {keywordLabel(id)}
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
                        <p>{t.text}</p>
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
export function EndScreen({ game, send, inspect, home }: Props & { home: () => void }) {
  return (
    <main className="end-screen">
      <h1>{game.phase === "victory" ? "Victory" : "Expedition ended"}</h1>
      {game.phase === "victory" && game.wins === 1 ? (
        <div className="unlock-card">
          <CreatureCard kind="moonhart" onClick={() => inspect({ species: "moonhart" })} />
          <p>Unlocked</p>
        </div>
      ) : null}
      <Button onClick={home}>Main menu</Button>
      <Button variant="ghost" onClick={() => send({ type: "newRun", seed: Date.now() >>> 0 })}>
        New expedition
      </Button>
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

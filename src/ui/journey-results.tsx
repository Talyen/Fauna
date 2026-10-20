import { Coins } from "lucide-react";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { BIOMES, location } from "../game/destinations";
import { ENCOUNTERS, species } from "../game/content";
import { KEYWORDS, RELICS, keywordLabel, keywordProgress, talentPoints } from "../game/progression";
import type { Command, GameState } from "../game/types";
import type { Inspection } from "./battle-screen";
import { CreatureCard } from "./cards";
import { Keyword as KeywordLabel } from "./keyword-text";
import { Progress } from "./progress";

export function JourneyResults({
  game,
  send,
  inspect,
  home,
}: {
  game: GameState;
  send: (command: Command) => boolean;
  inspect: (item: Inspection) => void;
  home: () => void;
}) {
  const summary = game.journey;
  const route = game.expedition;
  const unlocks =
    summary?.unlocks ?? (game.phase === "victory" && game.wins === 1 ? ["moonhart" as const] : []);
  const place = route?.chosen ? location(route.chosen)?.name : null;
  const title =
    game.phase === "victory"
      ? "Journey complete"
      : summary?.outcome === "defeat"
        ? "Defeated"
        : summary?.outcome === "returned"
          ? "Returned home"
          : "Journey ended";
  return (
    <main className="journey-results">
      <header className="journey-results-heading">
        <h1>{title}</h1>
        <p>
          {route
            ? `${BIOMES[route.biome]!.name}${place ? ` · ${place}` : ""}`
            : ENCOUNTERS[game.encounter]!.name}
        </p>
      </header>
      <section className="journey-team" aria-label="Final team">
        <h2>Final team</h2>
        <div className="journey-team-grid" data-nav-row>
          {[...game.team, ...game.reserves].map((creature) => (
            <div className="journey-creature" key={creature.id}>
              <CreatureCard
                kind={creature.species}
                tooltips={false}
                label={`Inspect ${species(creature.species).name}`}
                onClick={() => inspect({ species: creature.species })}
                onInspect={() => inspect({ species: creature.species })}
              />
              <h3>{species(creature.species).name}</h3>
              <p>{game.reserves.includes(creature) ? "Reserve" : "Deployed"}</p>
            </div>
          ))}
        </div>
      </section>
      {summary ? (
        <section className="journey-gains" aria-label="Journey gains">
          <div className="journey-totals">
            <p>
              <strong>{summary.victories}</strong> battles won
            </p>
            {route ? (
              <p>
                <strong>{route.biome + 1}</strong> of {BIOMES.length} biomes reached
              </p>
            ) : null}
            <p>
              <Coins aria-hidden="true" />
              <strong>{summary.currency}</strong> currency earned
            </p>
          </div>
          <div className="journey-xp" aria-label="Keyword XP earned">
            {KEYWORDS.filter((keyword) => (summary.xp[keyword] ?? 0) > 0).map((keyword) => {
              const gain = summary.xp[keyword]!,
                total = game.keywordXP[keyword] ?? 0;
              const progress = keywordProgress(total);
              const points = talentPoints(total) - talentPoints(Math.max(0, total - gain));
              return (
                <div className="reward-keyword" key={keyword} data-combat-tone={keyword}>
                  <div className="reward-keyword-label">
                    <KeywordLabel id={keyword} />
                    <span>+{gain} XP</span>
                  </div>
                  <Progress
                    value={progress.current}
                    maximum={progress.required}
                    label={`${keywordLabel(keyword)} talent progress`}
                    tone={keyword}
                  />
                  <div className="reward-progress-detail">
                    <span>{points ? `+${points} talent point${points === 1 ? "" : "s"}` : ""}</span>
                    <span>
                      {progress.current} / {progress.required} XP
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {summary.currency > 0 || Object.values(summary.xp).some((value) => value > 0) ? (
            <p className="journey-kept">Currency and keyword XP are kept.</p>
          ) : null}
        </section>
      ) : (
        <p className="journey-kept">
          Journey totals are unavailable for this older save. Permanent progress is kept.
        </p>
      )}
      {game.relics.length ? (
        <section className="journey-relics" aria-label="Relics collected">
          <h2>Relics collected</h2>
          <div data-nav-row>
            {game.relics.map((id) => {
              const relic = RELICS.find((entry) => entry.id === id)!;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost">{relic.name}</Button>
                  </TooltipTrigger>
                  <TooltipContent>{relic.text}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </section>
      ) : null}
      {unlocks.length ? (
        <section className="journey-unlocks" aria-label="New creature unlocks">
          <h2>New creatures</h2>
          <div data-nav-row>
            {unlocks.map((kind) => (
              <Button key={kind} variant="outline" onClick={() => inspect({ species: kind })}>
                {species(kind).name} unlocked
              </Button>
            ))}
          </div>
        </section>
      ) : null}
      <footer className="journey-results-actions" data-nav-row>
        <Button variant="outline" onClick={home}>
          Main menu
        </Button>
        <Button
          className="primary-menu-action"
          onClick={() => send({ type: "newRun", seed: Date.now() >>> 0 })}
        >
          New journey
        </Button>
      </footer>
    </main>
  );
}

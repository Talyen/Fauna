import { Coins } from "lucide-react";
import { Button } from "../components/ui/button";
import { KEYWORDS, keywordLabel, keywordProgress } from "../game/progression";
import type { GameState } from "../game/types";
import { Keyword as KeywordLabel } from "./keyword-text";
import { Progress } from "./progress";

export function JourneyResults({ game, home }: { game: GameState; home: () => void }) {
  const summary = game.journey;
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
      </header>
      {summary ? (
        <section className="journey-gains" aria-label="Journey gains">
          {summary.currency > 0 ? (
            <div className="journey-totals">
              <p>
                <Coins aria-hidden="true" />
                <strong>{summary.currency}</strong> currency earned
              </p>
            </div>
          ) : null}
          <div className="journey-xp" aria-label="Keyword XP earned">
            {KEYWORDS.filter((keyword) => (summary.xp[keyword] ?? 0) > 0).map((keyword) => {
              const total = game.keywordXP[keyword] ?? 0;
              const progress = keywordProgress(total);
              return (
                <div className="reward-keyword" key={keyword} data-combat-tone={keyword}>
                  <div className="reward-keyword-label">
                    <KeywordLabel id={keyword} />
                    <span>Lv {progress.points + 1}</span>
                  </div>
                  <Progress
                    value={progress.current}
                    maximum={progress.required}
                    label={`${keywordLabel(keyword)} level ${progress.points + 1} progress`}
                    tone={keyword}
                  />
                </div>
              );
            })}
          </div>
          {!summary.currency && !Object.values(summary.xp).some((value) => value > 0) ? (
            <p className="journey-kept">No permanent rewards earned.</p>
          ) : null}
        </section>
      ) : (
        <p className="journey-kept">Journey totals are unavailable. Permanent progress is kept.</p>
      )}
      <footer className="journey-results-actions" data-nav-row>
        <Button className="primary-menu-action" onClick={home}>
          Main menu
        </Button>
      </footer>
    </main>
  );
}

import { Coins } from "lucide-react";
import { Button } from "../components/ui/button";
import type { GameState } from "../game/types";
import { KeywordProgressGrid } from "./keyword-progress-grid";

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
                <strong>{summary.currency}</strong> Gold earned
              </p>
            </div>
          ) : null}
          <KeywordProgressGrid earned={summary.xp} totals={game.keywordXP} />
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

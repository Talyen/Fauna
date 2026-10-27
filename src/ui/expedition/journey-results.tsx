import { MessageParts } from "../shared/localization/message-parts";
import { useMessages } from "../shared/localization/message-context";
import { EffectBaseline } from "../shared/effects/effects";
import { effectPalette } from "../shared/effects/palettes";
import { PROGRESSION_KEYWORDS } from "../../game/keywords";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { ResultPresentation, AnimatedNumber } from "../shared/rewards/result-presentation";
import { EmptyState } from "../shared/empty-state";
import { Coins } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { StateAt } from "../../game/types";
import { KeywordProgressGrid } from "../shared/keyword-progress-grid";
export function JourneyResults({ game, home }: { game: StateAt<"victory" | "defeat">; home: () => void }) {
  const i18n = useMessages();
  const summary = game.journey;
  const title =
    game.phase === "victory"
      ? i18n.message("results.complete", "Journey complete")
      : summary?.outcome === "defeat"
        ? i18n.message("results.defeated", "Defeated")
        : summary?.outcome === "returned"
          ? i18n.message("results.returned", "Returned home")
          : i18n.message("results.ended", "Journey ended");
  return (
    <ResultPresentation>
      <Screen className="journey-results">
        <EffectBaseline
          palette={
            summary?.outcome === "defeat"
              ? effectPalette([], "death")
              : Object.values(summary?.xp ?? {}).some((value) => value > 0)
                ? effectPalette(
                    PROGRESSION_KEYWORDS.filter((id) => (summary?.xp[id] ?? 0) > 0).sort(
                      (a, b) => (summary?.xp[b] ?? 0) - (summary?.xp[a] ?? 0),
                    ),
                  )
                : effectPalette([], "gold")
          }
        />
        <header className="journey-results-heading">
          <ScreenHeading>{title}</ScreenHeading>
        </header>
        {summary ? (
          <section className="journey-gains" aria-label={i18n.message("results.gains", "Journey gains")}>
            {summary.currency > 0 ? (
              <div className="journey-totals">
                <p>
                  <Coins className="gold-icon" aria-hidden="true" />
                  <MessageParts
                    template={i18n.template("results.goldEarnedTotal", "{{amount}} Gold earned")}
                    values={{
                      amount: (
                        <strong>
                          <AnimatedNumber value={summary.currency} />
                        </strong>
                      ),
                    }}
                  />
                </p>
              </div>
            ) : null}
            <KeywordProgressGrid earned={summary.xp} totals={game.keywordXP} />
            {!summary.currency && !Object.values(summary.xp).some((value) => value > 0) ? (
              <EmptyState label={i18n.message("results.empty", "No permanent rewards earned")} />
            ) : null}
          </section>
        ) : null}
        <footer className="journey-results-actions" data-nav-row>
          <Button className="primary-menu-action" onClick={home}>
            {i18n.message("results.mainMenu", "Main menu")}
          </Button>
        </footer>
      </Screen>
    </ResultPresentation>
  );
}

import { KeywordIcon } from "./keyword-icon";
import { KEYWORDS, keywordLabel, keywordProgress, type KeywordXP } from "../game/progression";
import { Keyword as KeywordLabel } from "./keyword-text";
import { Progress } from "./progress";

/** Shared earned-keyword presentation for battle victory and Journey results. */
export function KeywordProgressGrid({ earned, totals }: { earned: KeywordXP; totals: KeywordXP }) {
  const keywords = KEYWORDS.filter((keyword) => (earned[keyword] ?? 0) > 0);
  if (!keywords.length) return null;
  return (
    <div className="keyword-progress-grid" aria-label="Keyword XP earned">
      {keywords.map((keyword) => {
        const progress = keywordProgress(totals[keyword] ?? 0);
        return (
          <div
            className="reward-keyword"
            key={keyword}
            data-combat-tone={keyword}
            data-level-up={
              keywordProgress((totals[keyword] ?? 0) - (earned[keyword] ?? 0)).points < progress.points ||
              undefined
            }
          >
            <div className="reward-keyword-label">
              <span className="reward-keyword-identity">
                <KeywordIcon id={keyword} />
                <KeywordLabel id={keyword} />
              </span>
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
  );
}

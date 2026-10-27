import { useMessages } from "./localization/message-context";
import { PagedItems, useCompactLayout } from "./navigation/pagination";
import { KeywordIcon } from "./keyword-icon";
import { KEYWORDS, keywordLabel, keywordProgress, type KeywordXP } from "../../game/progression";
import { Keyword as KeywordLabel } from "./keyword-text";
import { Progress } from "./progress";
/** Shared earned-keyword presentation for battle victory and Journey results. */
export function KeywordProgressGrid({ earned, totals }: { earned: KeywordXP; totals: KeywordXP }) {
  const i18n = useMessages();
  const compact = useCompactLayout();
  const keywords = KEYWORDS.filter((keyword) => (earned[keyword] ?? 0) > 0);
  if (!keywords.length) return null;
  return (
    <PagedItems
      items={keywords}
      pageSize={compact ? 2 : 4}
      className="keyword-progress-grid"
      label={i18n.message("progress.keywordXpEarned", "Keyword XP earned")}
    >
      {(keyword) => {
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
              <span className="reward-keyword-identity" data-keyword={keyword}>
                <KeywordIcon id={keyword} />
                <KeywordLabel id={keyword} />
              </span>
              <span data-keyword={keyword}>
                {i18n.message("progress.levelShort", "Lv {{level}}", { level: progress.points + 1 })}
              </span>
            </div>
            <Progress
              value={progress.current}
              maximum={progress.required}
              label={i18n.message("progress.keywordLevel", "{{keyword}} level {{level}} progress", {
                keyword: i18n.content(`content.keyword.${keyword}.label`, keywordLabel(keyword)),
                level: progress.points + 1,
              })}
              tone={keyword}
            />
          </div>
        );
      }}
    </PagedItems>
  );
}

import { useMessages } from "../shared/localization/message-context";
import { isKeywordId } from "../../game/keywords";
import { GLOSSARY } from "../../game/glossary";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { Keyword, KeywordText } from "../shared/keyword-text";
export function GlossaryScreen({
  back,
  controller = false,
  prompts = { confirm: "A", back: "B", inspect: "X", endTurn: "Y" },
}: {
  back: () => void;
  controller?: boolean;
  prompts?: { confirm: string; back: string; inspect: string; endTurn: string };
}) {
  const i18n = useMessages();
  return (
    <Screen className="menu-screen glossary-screen" aria-labelledby="menu-screen-title">
      <header className="collection-heading">
        <ScreenHeading id="menu-screen-title" back={back} openMenu={back}>
          {i18n.message("glossary.title", "Glossary & controls")}
        </ScreenHeading>
      </header>
      <p>
        {controller
          ? i18n.message(
              "glossary.controllerHelp",
              "Use the D-pad or left stick to navigate; {{confirm}} activates; {{inspect}} inspects artwork outside battle; {{back}} goes back; {{endTurn}} ends the turn",
              prompts,
            )
          : i18n.message(
              "glossary.keyboardHelp",
              "W/A/S/D or Tab to navigate; A/D switches targets; Enter activates; I or right-click inspects artwork outside battle; Escape goes back",
            )}
      </p>
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- A named scrolling region needs focus for native keyboard scrolling and controller access */}
      <div
        className="secondary-scroll-region glossary-entries"
        data-scroll-region
        role="region"
        aria-label={i18n.message("glossary.entries", "Glossary entries")}
        tabIndex={0}
      >
        {GLOSSARY.map((entry) => {
          const keyword = entry.id.startsWith("keyword.") ? entry.id.slice("keyword.".length) : "";
          return (
            <dl key={entry.id}>
              <dt>
                {isKeywordId(keyword) ? (
                  <span className="rule-keyword">
                    <Keyword id={keyword} />
                  </span>
                ) : (
                  <KeywordText text={entry.term} id={`content.glossary.${entry.id}.term.rule`} />
                )}
              </dt>
              <dd>
                <KeywordText text={entry.definition} id={`content.glossary.${entry.id}.definition.rule`} />
              </dd>
            </dl>
          );
        })}
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
    </Screen>
  );
}

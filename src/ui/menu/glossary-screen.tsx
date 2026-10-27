import { useMessages } from "../shared/localization/message-context";
import { GLOSSARY } from "../../game/glossary";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { KeywordText } from "../shared/keyword-text";
export function GlossaryScreen({
  back,
  controller = false,
  prompts = { confirm: "A", back: "B", endTurn: "Y" },
}: {
  back: () => void;
  controller?: boolean;
  prompts?: { confirm: string; back: string; endTurn: string };
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
              "Use the D-pad or left stick to navigate; {{confirm}} selects; {{back}} goes back; {{endTurn}} ends the turn · View creature abilities in Collection from the menu",
              prompts,
            )
          : i18n.message(
              "glossary.keyboardHelp",
              "W/A/S/D or Tab to navigate; A/D switches targets; Enter selects; Escape goes back · View creature abilities in Collection from the menu",
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
        {GLOSSARY.map((entry) => (
          <dl key={entry.term}>
            <dt>
              <KeywordText text={entry.term} />
            </dt>
            <dd>
              <KeywordText text={entry.definition} />
            </dd>
          </dl>
        ))}
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
    </Screen>
  );
}

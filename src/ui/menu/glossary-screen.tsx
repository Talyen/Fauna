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
  return (
    <Screen className="menu-screen glossary-screen" aria-labelledby="menu-screen-title">
      <header className="collection-heading">
        <ScreenHeading id="menu-screen-title" back={back} openMenu={back}>
          Glossary &amp; controls
        </ScreenHeading>
      </header>
      <p>
        {controller
          ? `Use the D-pad or left stick to navigate; ${prompts.confirm} selects; ${prompts.back} goes back; ${prompts.endTurn} ends the turn`
          : "W/A/S/D or Tab to navigate; A/D switches targets; Enter selects; Escape goes back"}
        {" · View creature abilities in Collection from the menu"}
      </p>
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- A named scrolling region needs focus for native keyboard scrolling and controller access */}
      <div
        className="secondary-scroll-region glossary-entries"
        data-scroll-region
        role="region"
        aria-label="Glossary entries"
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

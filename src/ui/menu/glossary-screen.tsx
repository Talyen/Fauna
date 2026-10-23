import { GLOSSARY } from "../../game/glossary";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { KeywordText } from "../shared/keyword-text";
export function GlossaryScreen({ back }: { back: () => void }) {
  return (
    <Screen className="menu-screen glossary-screen" aria-labelledby="menu-screen-title">
      <header className="collection-heading">
        <ScreenHeading id="menu-screen-title" back={back} openMenu={back}>
          Glossary &amp; controls
        </ScreenHeading>
      </header>
      <p>
        W/A/S/D or Tab to navigate. A/D switches targets. Enter/controller A selects. Escape/B goes back.
        Controller Y ends the turn. View creature abilities in Collection from the menu.
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

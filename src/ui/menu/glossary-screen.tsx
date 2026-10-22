import { GLOSSARY } from "../../game/glossary";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PagedItems } from "../shared/navigation/pagination";
import { KeywordText } from "../shared/keyword-text";
export function GlossaryScreen({ scale, back }: { scale: number; back: () => void }) {
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
      <PagedItems
        items={GLOSSARY}
        pageSize={scale > 1 ? 2 : 3}
        className="glossary-entries"
        label="Glossary pages"
      >
        {(entry) => (
          <dl key={entry.term}>
            <dt>
              <KeywordText text={entry.term} />
            </dt>
            <dd>
              <KeywordText text={entry.definition} />
            </dd>
          </dl>
        )}
      </PagedItems>
    </Screen>
  );
}

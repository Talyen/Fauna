import { useMessages } from "../shared/localization/message-context";
import { findBoon, type BoonId } from "../../game/content";
import { PagedItems } from "../shared/navigation/pagination";
import { BoonArt, BoonName, BoonText } from "./boon-presentation";
export function OwnedBoons({ boons }: { boons: readonly BoonId[] }) {
  const i18n = useMessages();
  return (
    <PagedItems
      items={boons}
      pageSize={2}
      className="boon-options"
      label={i18n.message("boons.pages", "Boon pages")}
    >
      {(id) => {
        const boon = findBoon(id)!;
        return (
          <section className="reward-option" key={id}>
            <BoonArt
              boon={boon}
              presentation
              aria-label={i18n.content(`content.boon.${boon.id}.name`, boon.name)}
            />
            <h2>
              <BoonName boon={boon} />
            </h2>
            <BoonText boon={boon} />
          </section>
        );
      }}
    </PagedItems>
  );
}

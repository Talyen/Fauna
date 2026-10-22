import { BOONS, type BoonId } from "../../game/content";
import { ArtCard } from "../shared/cards/art-card";
import { assetUrl } from "../shared/assets";
import { KeywordText } from "../shared/keyword-text";
import { PagedItems } from "../shared/navigation/pagination";
export function OwnedBoons({ boons }: { boons: readonly BoonId[] }) {
  return (
    <PagedItems items={boons} pageSize={2} className="boon-options" label="Boon pages">
      {(id) => {
        const boon = BOONS.find((entry) => entry.id === id)!;
        return (
          <section className="reward-option" key={id}>
            <ArtCard
              aspect="action"
              artwork={assetUrl(`boon.${id}`)}
              effectText={boon.text}
              presentation
              aria-label={boon.name}
            />
            <h2>{boon.name}</h2>
            <p>
              <KeywordText text={boon.text} />
            </p>
          </section>
        );
      }}
    </PagedItems>
  );
}

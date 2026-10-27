import { BOONS, type BoonId } from "../../game/content";
import { PagedItems } from "../shared/navigation/pagination";
import { BoonArt, BoonName, BoonText } from "./boon-presentation";
export function OwnedBoons({ boons }: { boons: readonly BoonId[] }) {
  return (
    <PagedItems items={boons} pageSize={2} className="boon-options" label="Boon pages">
      {(id) => {
        const boon = BOONS.find((entry) => entry.id === id)!;
        return (
          <section className="reward-option" key={id}>
            <BoonArt boon={boon} presentation aria-label={boon.name} />
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

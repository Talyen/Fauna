import { Button } from "../../components/ui/button";
import { species, type SpeciesId } from "../../game/content";
import type { GameState } from "../../game/types";
import type { Inspection } from "../inspection/model";
import { CreatureCard } from "../shared/cards";
import { Screen, ScreenHeading } from "../shared/screen";
export function UnlockScreen({
  game,
  kind,
  inspect: setInspection,
  onHome,
  onContinue,
}: {
  game: GameState;
  kind: SpeciesId;
  inspect: (inspection: Inspection) => void;
  onHome: () => void;
  onContinue: () => void;
}) {
  return (
    <Screen className="unlock-screen">
      <ScreenHeading back={onHome} openMenu={onHome}>
        Creature unlocked
      </ScreenHeading>
      <div className="unlock-creature">
        <CreatureCard
          progression={game}
          kind={kind}
          label={`Inspect ${species(kind).name}`}
          onClick={() => setInspection({ species: kind })}
          onInspect={() => setInspection({ species: kind })}
        />
        <h2>{species(kind).name}</h2>
      </div>
      <Button onClick={onContinue}>Continue</Button>
    </Screen>
  );
}

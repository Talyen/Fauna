import { useLayoutEffect, useRef } from "react";
import { ArrowDownUp, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import { species, type SpeciesId } from "../../game/content";
import type { Command, StateAt } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";
import { CreatureCard } from "../shared/cards/cards";
import { returnFocus } from "../shared/navigation/focus";
import { Screen, ScreenHeading } from "../shared/navigation/screen";

type Props = {
  game: StateAt<"recruit">;
  incoming: SpeciesId;
  send: (command: Command) => boolean;
  inspect: (item: Inspection) => void;
};

/** The banked recruit stays in Collection even when the player keeps the current team. */
export function RecruitTeam({ game, incoming, send, inspect }: Props) {
  const root = useRef<HTMLElement>(null);
  const all = [...game.team, ...game.reserves];
  useLayoutEffect(() => {
    returnFocus(
      root.current?.querySelector<HTMLButtonElement>(".recruit-team-roster .creature-card") ?? null,
    );
  }, []);
  return (
    <Screen className="recruit-team-screen" ref={root}>
      <ScreenHeading back={false}>Replace a creature</ScreenHeading>
      <section className="recruit-team-exchange" aria-label="Incoming creature">
        <CreatureCard
          progression={game}
          kind={incoming}
          readout={false}
          label={`Inspect ${species(incoming).name}`}
          onClick={() => inspect({ species: incoming })}
          onInspect={() => inspect({ species: incoming })}
        />
      </section>
      <ArrowDownUp className="recruit-team-swap" aria-hidden="true" />
      <section className="recruit-team-tray" aria-labelledby="recruit-team-heading">
        <h2 id="recruit-team-heading">
          <Users aria-hidden="true" />
          Team
        </h2>
        <div className="recruit-team-roster" data-nav-row>
          {all.map((unit) => (
            <div className="recruit-team-slot" data-roster-slot={unit.id} key={unit.id}>
              <CreatureCard
                progression={game}
                kind={unit.species}
                actorId={unit.id}
                readout={false}
                label={`Replace ${species(unit.species).name} with ${species(incoming).name}`}
                onClick={() => send({ type: "confirmRecruit", replace: unit.id })}
                onInspect={() => inspect({ species: unit.species, creatureId: unit.id })}
              />
            </div>
          ))}
        </div>
      </section>
      <footer className="recruit-team-footer">
        <Button variant="outline" onClick={() => send({ type: "confirmRecruit" })}>
          Keep team
        </Button>
      </footer>
    </Screen>
  );
}

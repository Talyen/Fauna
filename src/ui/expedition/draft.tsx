import { Screen, ScreenHeading } from "../shared/screen";
import { starterCount } from "../../game/engine";

import { StarterDetails } from "../shared/card-details";

import { Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { CreatureCard } from "../shared/cards";

import { species } from "../../game/content";
import type { Command, GameState } from "../../game/types";
import type { Inspection } from "../inspection/model";

type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function Draft({ game, send, inspect }: Props) {
  return (
    <Screen className="draft-screen">
      <ScreenHeading>
        {game.selected.length < starterCount(game) ? "Choose your starter" : "Your starter team"}
      </ScreenHeading>
      <div className="draft-grid" data-nav-row>
        {(game.selected.length === starterCount(game) ? game.selected : game.starterOffers).map(
          (kind, index) => {
            const s = species(kind);
            return (
              <div className="starter-option" key={`${index}-${s.id}`}>
                <CreatureCard
                  progression={game}
                  kind={s.id}
                  selected={game.selected.length === starterCount(game)}
                  onClick={() => inspect({ species: s.id })}
                  onInspect={() => inspect({ species: s.id })}
                  label={`Inspect ${s.name}`}
                  tooltipContent={<StarterDetails game={game} kind={s.id} />}
                />
                <h2>{s.name}</h2>
                <span className="starter-selection">
                  {game.selected.length === starterCount(game) ? (
                    <>
                      <Check aria-hidden="true" /> Selected
                    </>
                  ) : null}
                </span>
              </div>
            );
          },
        )}
      </div>
      <footer className="selection-footer" data-nav-row>
        <Button
          disabled={game.selected.length !== starterCount(game)}
          onClick={() => send({ type: "start" })}
        >
          Begin journey
        </Button>
      </footer>
    </Screen>
  );
}

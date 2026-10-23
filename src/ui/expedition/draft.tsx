import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { useLayoutEffect, useRef } from "react";
import { returnFocus } from "../shared/navigation/focus";
import { starterCount } from "../../game/progression";

import { StarterDetails } from "../shared/cards/card-details";

import { Check } from "lucide-react";
import { EffectButton as Button } from "../shared/effects/treatments";
import { creatureKeywords } from "../shared/effects/palettes";
import { CreatureCard } from "../shared/cards/cards";

import { species } from "../../game/content";
import type { Command, StateAt } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";

type Props = {
  game: StateAt<"draft">;
  send: (command: Command) => boolean;
  inspect: (item: Inspection) => void;
};
export function Draft({ game, send, inspect }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const restore = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (game.selected.length === starterCount(game)) {
      send({ type: "start" });
      return;
    }
    if (restore.current === null) return;
    const targets = grid.current?.querySelectorAll<HTMLElement>(
      game.selected.length === starterCount(game) ? ".creature-card" : ".recruit-button",
    );
    returnFocus(targets?.[Math.min(restore.current, (targets?.length ?? 1) - 1)] ?? null);
    restore.current = null;
  }, [game, send]);
  return (
    <Screen className="draft-screen">
      <ScreenHeading>
        {game.selected.length < starterCount(game) ? "Choose your starter" : "Your starter team"}
      </ScreenHeading>
      <div className="draft-grid" data-nav-row ref={grid}>
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
                {game.selected.length === starterCount(game) ? (
                  <span className="starter-selection">
                    <Check aria-hidden="true" /> Selected
                  </span>
                ) : (
                  <Button
                    effectKeywords={creatureKeywords(s.id, game)}
                    className="recruit-button"
                    aria-label={`Recruit ${s.name}`}
                    onClick={() => {
                      restore.current = index;
                      if (!send({ type: "draft", species: s.id })) restore.current = null;
                    }}
                  >
                    Recruit
                  </Button>
                )}
              </div>
            );
          },
        )}
      </div>
    </Screen>
  );
}

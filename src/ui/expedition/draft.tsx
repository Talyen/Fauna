import { useMessages } from "../shared/localization/message-context";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { useLayoutEffect, useRef } from "react";
import { returnFocus } from "../shared/navigation/focus";
import { starterCount } from "../../game/progression";

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
  const i18n = useMessages();
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
        {game.selected.length < starterCount(game)
          ? i18n.message("draft.choose", "Choose your starter")
          : i18n.message("draft.team", "Your starter team")}
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
                  label={i18n.message("creature.inspect", "Inspect {{name}}", {
                    name: i18n.content(`content.species.${s.id}.name`, s.name),
                  })}
                />
                {game.selected.length !== starterCount(game) ? (
                  <Button
                    effectKeywords={creatureKeywords(s.id, game)}
                    className="recruit-button"
                    aria-label={i18n.message("creature.recruit", "Recruit {{name}}", {
                      name: i18n.content(`content.species.${s.id}.name`, s.name),
                    })}
                    onClick={() => {
                      restore.current = index;
                      if (!send({ type: "draft", species: s.id })) restore.current = null;
                    }}
                  >
                    {i18n.message("creature.recruitAction", "Recruit")}
                  </Button>
                ) : null}
              </div>
            );
          },
        )}
      </div>
    </Screen>
  );
}

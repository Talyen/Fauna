import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PagedItems } from "../shared/navigation/pagination";
import { ResultPresentation } from "./result-presentation";
import { assetUrl } from "../shared/assets";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { CreatureCard } from "../shared/cards/cards";
import { ArtCard } from "../shared/cards/art-card";
import { returnFocus } from "../shared/navigation/focus";
import { species, type SpeciesId, BOONS } from "../../game/content";
import { creatureStars, MAX_CREATURE_STARS } from "../../game/progression";
import type { Command, RewardState } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";
import { BattleEarnings } from "../battle/battle-earnings";
type Props = { game: RewardState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function Rewards({ game, send, inspect }: Props) {
  const [incoming, setIncoming] = useState<SpeciesId | null>(null);
  const choices = useRef<HTMLElement>(null);
  const returnTo = useRef<number | null>(null);
  useLayoutEffect(() => {
    const buttons = choices.current?.querySelectorAll<HTMLButtonElement>(".recruit-options .creature-card");
    if (incoming) returnFocus(buttons?.[0] ?? null);
    else if (returnTo.current !== null) {
      returnFocus(buttons?.[returnTo.current] ?? null);
      returnTo.current = null;
    }
  }, [incoming]);
  const reward = game.reward;
  const recruiting = game.phase === "recruit";
  return (
    <ResultPresentation>
      <Screen className="reward-screen">
        <header className="reward-heading">
          <ScreenHeading back={incoming ? () => setIncoming(null) : undefined}>Victory</ScreenHeading>
          <BattleEarnings game={game} detailed />
        </header>
        <section className="reward-choices" ref={choices}>
          <div className="reward-choice-content">
            <h2>{recruiting ? (incoming ? "Replace a creature" : "Choose a Recruit") : "Choose a Boon"}</h2>
            {recruiting ? (
              <div className={incoming ? "recruit-comparison" : undefined}>
                {incoming ? (
                  <section className="incoming-recruit" aria-label="Incoming recruit">
                    <h3>Recruit</h3>
                    <CreatureCard
                      progression={game}
                      kind={incoming}
                      label={`Inspect ${species(incoming).name}`}
                      onClick={() => inspect({ species: incoming })}
                      onInspect={() => inspect({ species: incoming })}
                    />
                    <h2>{species(incoming).name}</h2>
                  </section>
                ) : null}
                <div className="recruit-roster">
                  {incoming ? <h3>Release</h3> : null}
                  <PagedItems
                    key={incoming ?? "recruits"}
                    className="recruit-options"
                    label="Recruit pages"
                    pageSize={3}
                    adaptive={{ columns: incoming ? 5 : 3, rows: 1 }}
                    items={
                      incoming
                        ? [...game.team, ...game.reserves].map((creature) => ({
                            kind: creature.species,
                            id: creature.id,
                          }))
                        : reward.recruits.map((kind, index) => ({ kind, id: String(index) }))
                    }
                  >
                    {({ kind, id }) => (
                      <div className="reward-option" key={id}>
                        <CreatureCard
                          progression={game}
                          kind={kind}
                          actorId={incoming ? id : undefined}
                          label={incoming ? `Release ${species(kind).name}` : `Recruit ${species(kind).name}`}
                          onInspect={() =>
                            inspect(incoming ? { species: kind, creatureId: id } : { species: kind })
                          }
                          onClick={() => {
                            if (incoming) send({ type: "recruit", species: incoming, replace: id });
                            else if (game.roster.length === 5) {
                              returnTo.current = Number(id);
                              setIncoming(kind);
                            } else send({ type: "recruit", species: kind });
                          }}
                        />
                        <h2>{species(kind).name}</h2>
                        {!incoming ? (
                          <p className="collection-uncollected">
                            {!game.discovery.recruited[kind]
                              ? "Unlock in Collection"
                              : creatureStars(game, kind) === MAX_CREATURE_STARS
                                ? `${MAX_CREATURE_STARS} stars · Max`
                                : `${creatureStars(game, kind)} → ${creatureStars(game, kind) + 1} stars`}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </PagedItems>
                </div>
              </div>
            ) : (
              <div className="boon-options">
                {reward.boons.map((id) => {
                  const boon = BOONS.find((r) => r.id === id)!;
                  return (
                    <div className="reward-option" key={id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <ArtCard
                            aspect="action"
                            artwork={assetUrl(`boon.${id}`)}
                            effectText={boon.text}
                            className="boon-choice"
                            aria-label={`Choose ${boon.name}`}
                            onClick={() => send({ type: "chooseBoon", boon: id })}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <strong>{boon.name}</strong>
                          <p>{boon.text}</p>
                        </TooltipContent>
                      </Tooltip>
                      <h2>{boon.name}</h2>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
        <footer className="reward-footer">
          {incoming ? (
            <Button variant="outline" onClick={() => setIncoming(null)}>
              Cancel
            </Button>
          ) : !recruiting ? (
            <Button variant="ghost" onClick={() => send({ type: "skipBoon" })}>
              Skip
            </Button>
          ) : null}
        </footer>
      </Screen>
    </ResultPresentation>
  );
}

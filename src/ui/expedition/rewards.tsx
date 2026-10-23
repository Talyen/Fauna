import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PagedItems } from "../shared/navigation/pagination";
import { ResultPresentation } from "../shared/rewards/result-presentation";
import { assetUrl } from "../shared/assets";
import { useLayoutEffect, useRef, useState } from "react";
import { Plus, Star } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { CreatureCard } from "../shared/cards/cards";
import { ArtCard } from "../shared/cards/art-card";
import { returnFocus } from "../shared/navigation/focus";
import { species, type SpeciesId, BOONS } from "../../game/content";
import { creatureStars, MAX_CREATURE_STARS } from "../../game/progression";
import type { Command, RewardState } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";
import { RecruitTeam } from "./recruit-team";
import { BattleEarnings } from "../shared/rewards/battle-earnings";
type Props = { game: RewardState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
function RecruitProgress({ game, kind }: { game: RewardState; kind: SpeciesId }) {
  const collected = game.discovery.recruited[kind] !== undefined;
  const rank = creatureStars(game, kind);
  const next = Math.min(rank + 1, MAX_CREATURE_STARS);
  return (
    <div
      className="recruit-progress"
      role="img"
      aria-label={
        !collected
          ? `${species(kind).name}: New to Collection, zero stars`
          : rank === MAX_CREATURE_STARS
            ? `${species(kind).name}: ${rank} of ${MAX_CREATURE_STARS} stars`
            : `${species(kind).name}: ${rank} to ${next} of ${MAX_CREATURE_STARS} stars`
      }
    >
      {!collected ? (
        <span className="recruit-new">New!</span>
      ) : (
        <span className="recruit-stars" aria-hidden="true">
          {Array.from({ length: MAX_CREATURE_STARS }, (_, index) => (
            <span className="recruit-star" key={index} data-earned={index < rank} data-new={index === rank}>
              <Star />
              {index === rank ? <Plus className="recruit-star-plus" /> : null}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
export function Rewards({ game, send, inspect }: Props) {
  const selectedRecruit = game.phase === "recruit" ? game.reward.selectedRecruit : undefined;
  const [choosing, setChoosing] = useState(game.phase === "boon" || selectedRecruit !== undefined);
  const proceed = useRef<HTMLButtonElement>(null);
  const choices = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (selectedRecruit !== undefined) return;
    returnFocus(
      choosing
        ? (choices.current?.querySelector<HTMLButtonElement>(".recruit-button, .boon-choice") ?? null)
        : proceed.current,
    );
  }, [choosing, selectedRecruit]);
  if (game.phase === "recruit" && selectedRecruit !== undefined)
    return <RecruitTeam game={game} incoming={selectedRecruit} send={send} inspect={inspect} />;
  const reward = game.reward;
  const recruiting = game.phase === "recruit";
  if (!choosing)
    return (
      <ResultPresentation>
        <Screen className="battle-rewards-screen">
          <ScreenHeading>Victory</ScreenHeading>
          <BattleEarnings game={game} detailed />
          <Button ref={proceed} onClick={() => setChoosing(true)}>
            Continue
          </Button>
        </Screen>
      </ResultPresentation>
    );
  return (
    <ResultPresentation>
      <Screen className="reward-screen">
        <header className="reward-heading">
          <ScreenHeading>{recruiting ? "Choose a Recruit" : "Choose a Boon"}</ScreenHeading>
        </header>
        <section className="reward-choices" ref={choices}>
          <div className="reward-choice-content">
            {recruiting ? (
              <PagedItems
                className="recruit-options"
                label="Recruit pages"
                pageSize={3}
                adaptive={{ columns: 3, rows: 1 }}
                items={reward.recruits.map((kind, index) => ({ kind, id: index }))}
              >
                {({ kind, id }) => (
                  <div className="reward-option" key={id}>
                    <CreatureCard
                      progression={game}
                      kind={kind}
                      label={`Inspect ${species(kind).name}`}
                      onInspect={() => inspect({ species: kind })}
                      onClick={() => inspect({ species: kind })}
                    />
                    <Button
                      className="recruit-button"
                      aria-label={`Recruit ${species(kind).name}`}
                      onClick={() => send({ type: "recruit", species: kind })}
                    >
                      Recruit
                    </Button>
                    <RecruitProgress game={game} kind={kind} />
                  </div>
                )}
              </PagedItems>
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
        {!recruiting ? (
          <footer className="reward-footer">
            <Button variant="ghost" onClick={() => send({ type: "skipBoon" })}>
              Skip
            </Button>
          </footer>
        ) : null}
      </Screen>
    </ResultPresentation>
  );
}

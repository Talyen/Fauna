import { useMessages } from "../shared/localization/message-context";
import { creatureKeywords } from "../shared/effects/palettes";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PagedItems } from "../shared/navigation/pagination";
import { ResultPresentation } from "../shared/rewards/result-presentation";
import { useLayoutEffect, useRef, useState } from "react";
import { Plus, Star } from "lucide-react";
import { EffectButton as Button } from "../shared/effects/treatments";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { CreatureCard } from "../shared/cards/cards";
import { returnFocus } from "../shared/navigation/focus";
import { species, type SpeciesId, BOONS } from "../../game/content";
import { creatureStars, MAX_CREATURE_STARS } from "../../game/progression";
import type { Command, RewardState } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";
import { RecruitTeam } from "./recruit-team";
import { BoonArt, BoonName, BoonText } from "./boon-presentation";
import { BattleEarnings } from "../shared/rewards/battle-earnings";
type Props = { game: RewardState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
function RecruitProgress({ game, kind }: { game: RewardState; kind: SpeciesId }) {
  const i18n = useMessages();
  const name = i18n.content(`content.species.${kind}.name`, species(kind).name);
  const collected = game.discovery.recruited[kind] !== undefined;
  const rank = creatureStars(game, kind);
  const next = Math.min(rank + 1, MAX_CREATURE_STARS);
  return (
    <div
      className="recruit-progress"
      role="img"
      aria-label={
        !collected
          ? i18n.message("rewards.newStars", "{{name}}: New to Collection, zero stars", { name })
          : rank === MAX_CREATURE_STARS
            ? i18n.message("collection.stars", "{{name}}: {{rank}} of {{maximum}} stars", {
                name,
                rank,
                maximum: MAX_CREATURE_STARS,
              })
            : i18n.message("rewards.nextStars", "{{name}}: {{rank}} to {{next}} of {{maximum}} stars", {
                name,
                rank,
                next,
                maximum: MAX_CREATURE_STARS,
              })
      }
    >
      {!collected ? (
        <span className="recruit-new">{i18n.message("rewards.new", "New!")}</span>
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
  const i18n = useMessages();
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
          <ScreenHeading>{i18n.message("rewards.victory", "Victory")}</ScreenHeading>
          <BattleEarnings game={game} detailed />
          <Button ref={proceed} onClick={() => setChoosing(true)}>
            {i18n.message("merchant.continue", "Continue")}
          </Button>
        </Screen>
      </ResultPresentation>
    );
  return (
    <ResultPresentation>
      <Screen className="reward-screen">
        <header className="reward-heading">
          <ScreenHeading>
            {recruiting
              ? i18n.message("rewards.chooseRecruit", "Choose a Recruit")
              : i18n.message("rewards.chooseBoon", "Choose a Boon")}
          </ScreenHeading>
        </header>
        <section className="reward-choices" ref={choices}>
          <div className="reward-choice-content">
            {recruiting ? (
              <PagedItems
                className="recruit-options"
                label={i18n.message("rewards.recruitPages", "Recruit pages")}
                pageSize={3}
                adaptive={{ columns: 3, rows: 1 }}
                items={reward.recruits.map((kind, index) => ({ kind, id: index }))}
              >
                {({ kind, id }) => (
                  <div className="reward-option" key={id}>
                    <CreatureCard
                      progression={game}
                      kind={kind}
                      label={i18n.message("creature.inspect", "Inspect {{name}}", {
                        name: i18n.content(`content.species.${kind}.name`, species(kind).name),
                      })}
                      onInspect={() => inspect({ species: kind })}
                      onClick={() => inspect({ species: kind })}
                    />
                    <Button
                      effectKeywords={creatureKeywords(kind, game)}
                      className="recruit-button"
                      aria-label={i18n.message("creature.recruit", "Recruit {{name}}", {
                        name: i18n.content(`content.species.${kind}.name`, species(kind).name),
                      })}
                      onClick={() => send({ type: "recruit", species: kind })}
                    >
                      {i18n.message("creature.recruitAction", "Recruit")}
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
                          <BoonArt
                            boon={boon}
                            className="boon-choice"
                            aria-label={i18n.message("boons.choose", "Choose {{name}}", {
                              name: i18n.content(`content.boon.${boon.id}.name`, boon.name),
                            })}
                            onClick={() => send({ type: "chooseBoon", boon: id })}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <strong>
                            <BoonName boon={boon} />
                          </strong>
                          <BoonText boon={boon} />
                        </TooltipContent>
                      </Tooltip>
                      <h2>
                        <BoonName boon={boon} />
                      </h2>
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
              {i18n.message("rewards.skip", "Skip")}
            </Button>
          </footer>
        ) : null}
      </Screen>
    </ResultPresentation>
  );
}

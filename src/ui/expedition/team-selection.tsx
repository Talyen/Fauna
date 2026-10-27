import { useMessages } from "../shared/localization/message-context";
import { creatureKeywords } from "../shared/effects/palettes";
import { ShineText } from "../shared/effects/treatments";
import { Screen, ScreenHeading } from "../shared/navigation/screen";

import { RestRecovery } from "./campfire";
import { canVisitCampfire, canRecruitDestination } from "../../game/destinations";
import { PurchaseFeedback, SupportOffer } from "./support-screen";
import { assetUrl } from "../shared/assets";
import { CreatureCard } from "../shared/cards/cards";
import { species } from "../../game/content";
import { CreatureDetails } from "../shared/cards/card-details";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { ArtCard } from "../shared/cards/art-card";

import type { Command, StateAt, GameEvent } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";

import { BattleEarnings } from "../shared/rewards/battle-earnings";
import { bossEncounter, encounterSource, JOURNEY_LENGTH } from "../../game/encounters";
type Props = {
  game: StateAt<"teamSelection">;
  send: (command: Command) => boolean;
  inspect: (item: Inspection) => void;
};
export function TeamSelection({
  game,
  send,
  recovery,
  purchase,
}: Props & { recovery?: GameEvent[]; purchase?: StateAt<"support">["support"] }) {
  const i18n = useMessages();
  const boss = bossEncounter(game);
  const bossEnemy = boss ? encounterSource(game).enemies[0]! : null;
  const bossName =
    bossEnemy && bossEnemy.name === species(bossEnemy.species).name
      ? i18n.content(`content.species.${bossEnemy.species}.name`, bossEnemy.name)
      : bossEnemy?.name;
  return (
    <Screen className="destinations-screen">
      <header className="destination-heading">
        <ScreenHeading>
          {i18n.message("journey.encounter", "Encounter {{current}} of {{total}}", {
            current: game.encounter + 1,
            total: JOURNEY_LENGTH,
          })}
        </ScreenHeading>
      </header>
      <section
        className="destination-grid"
        data-nav-row
        aria-label={i18n.message("journey.encounters", "Encounters")}
      >
        <SupportOffer game={game} send={send} />
        {canRecruitDestination(game) ? (
          <div className="destination-option">
            <CreatureCard
              kind={game.expedition.recruit!}
              progression={game}
              readout={false}
              tooltipSide="right"
              label={i18n.message("creature.recruit", "Recruit {{name}}", {
                name: i18n.content(
                  `content.species.${game.expedition.recruit!}.name`,
                  species(game.expedition.recruit!).name,
                ),
              })}
              onClick={(element) => {
                if (!send({ type: "recruitDestination", species: game.expedition.recruit! })) return;
                if (document.documentElement.dataset.focus === "visible")
                  element
                    .closest(".destination-grid")
                    ?.querySelector<HTMLElement>("[data-encounter]")
                    ?.focus();
              }}
            />
            <h2>{i18n.message("creature.recruitAction", "Recruit")}</h2>
            <p>
              {i18n.content(
                `content.species.${game.expedition.recruit!}.name`,
                species(game.expedition.recruit!).name,
              )}
            </p>
          </div>
        ) : null}
        {canVisitCampfire(game) ? (
          <div className="destination-option">
            <ArtCard
              aspect="creature"
              artwork={assetUrl("location.ember-grove")}
              effectKeywords={["burn"]}
              aria-label={i18n.message("campfire.visit", "Visit Campfire")}
              onClick={() => send({ type: "visitCampfire" })}
            />
            <h2>{i18n.message("campfire.name", "Campfire")}</h2>
            <p>{i18n.message("campfire.rest", "Rest")}</p>
          </div>
        ) : null}
        <div className="destination-option">
          {bossEnemy ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <ArtCard
                  aspect="creature"
                  artwork={assetUrl(`creature.${bossEnemy.species}`)}
                  effectKeywords={creatureKeywords(bossEnemy.species)}
                  data-encounter
                  aria-label={i18n.message("journey.boss", "Boss: {{name}}", { name: bossName! })}
                  onClick={() => send({ type: "beginBattle" })}
                />
              </TooltipTrigger>
              <TooltipContent>
                <CreatureDetails kind={bossEnemy.species} name={bossEnemy.name} />
              </TooltipContent>
            </Tooltip>
          ) : (
            <ArtCard
              aspect="creature"
              artwork={assetUrl("encounter.combat")}
              data-encounter
              effectKeywords={["physical"]}
              aria-label={i18n.message("journey.combat", "Combat")}
              onClick={() => send({ type: "beginBattle" })}
            />
          )}
          <h2>
            {bossEnemy ? (
              <ShineText keywords={creatureKeywords(bossEnemy.species)}>{bossName}</ShineText>
            ) : (
              i18n.message("journey.combat", "Combat")
            )}
          </h2>
        </div>
      </section>
      <BattleEarnings game={game} />
      {recovery ? <RestRecovery key={game.revision} game={game} events={recovery} /> : null}
      {purchase?.purchased ? <PurchaseFeedback key={game.revision} visit={purchase} /> : null}
    </Screen>
  );
}

import { creatureKeywords } from "../shared/effects/palettes";
import { ShineText } from "../shared/effects/treatments";
import { Screen, ScreenHeading } from "../shared/navigation/screen";

import { RestRecovery } from "./campfire";
import { canVisitCampfire, canRecruitDestination } from "../../game/destinations";
import { SupportOffer } from "./support-screen";
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
export function TeamSelection({ game, send, recovery }: Props & { recovery?: GameEvent[] }) {
  const boss = bossEncounter(game);
  const bossEnemy = boss ? encounterSource(game).enemies[0]! : null;
  return (
    <Screen className="destinations-screen">
      <header className="destination-heading">
        <ScreenHeading>
          Encounter {game.encounter + 1} of {JOURNEY_LENGTH}
        </ScreenHeading>
      </header>
      <section className="destination-grid" data-nav-row aria-label="Encounters">
        <SupportOffer game={game} send={send} />
        {canRecruitDestination(game) ? (
          <div className="destination-option">
            <CreatureCard
              kind={game.expedition.recruit!}
              progression={game}
              readout={false}
              tooltipSide="right"
              label={`Recruit ${species(game.expedition.recruit!).name}`}
              onClick={(element) => {
                if (!send({ type: "recruitDestination", species: game.expedition.recruit! })) return;
                if (document.documentElement.dataset.focus === "visible")
                  element
                    .closest(".destination-grid")
                    ?.querySelector<HTMLElement>("[data-encounter]")
                    ?.focus();
              }}
            />
            <h2>Recruit</h2>
            <p>{species(game.expedition.recruit!).name}</p>
          </div>
        ) : null}
        {canVisitCampfire(game) ? (
          <div className="destination-option">
            <ArtCard
              aspect="creature"
              artwork={assetUrl("location.ember-grove")}
              effectKeywords={["burn"]}
              aria-label="Visit Campfire"
              onClick={() => send({ type: "visitCampfire" })}
            />
            <h2>Campfire</h2>
            <p>Rest</p>
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
                  aria-label={`Boss: ${bossEnemy.name}`}
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
              aria-label="Combat"
              onClick={() => send({ type: "beginBattle" })}
            />
          )}
          <h2>
            {bossEnemy ? (
              <ShineText keywords={creatureKeywords(bossEnemy.species)}>{bossEnemy.name}</ShineText>
            ) : (
              "Combat"
            )}
          </h2>
        </div>
      </section>
      <BattleEarnings game={game} />
      {recovery ? <RestRecovery key={game.revision} game={game} events={recovery} /> : null}
    </Screen>
  );
}

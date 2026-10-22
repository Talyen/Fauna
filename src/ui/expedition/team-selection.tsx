import { Screen, ScreenHeading } from "../shared/screen";

import { RestRecovery } from "./campfire";
import { canVisitCampfire } from "../../game/support";
import { SupportOffer } from "./support-screen";
import { assetUrl } from "../shared/assets";
import { CreatureDetails } from "../shared/card-details";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { ArtCard } from "../shared/art-card";

import type { Command, GameState, GameEvent } from "../../game/types";
import type { Inspection } from "../inspection/model";

import { BattleEarnings } from "../battle/battle-earnings";
import { bossEncounter, encounterSource, JOURNEY_LENGTH } from "../../game/encounters";
type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function TeamSelection({ game, send, recovery }: Props & { recovery?: GameEvent[] }) {
  const boss = bossEncounter(game);
  const bossEnemy = boss ? encounterSource(game).enemies[0]! : null;
  return (
    <Screen className="destinations-screen">
      <header className="destination-heading">
        <ScreenHeading>
          Encounter {game.encounter + 1} of {game.expedition ? JOURNEY_LENGTH : 3}
        </ScreenHeading>
      </header>
      <section className="destination-grid" data-nav-row aria-label="Encounters">
        <SupportOffer game={game} send={send} />
        {canVisitCampfire(game) ? (
          <div className="destination-option">
            <ArtCard
              aspect="creature"
              artwork={assetUrl("location.ember-grove")}
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
                  data-encounter
                  aria-label={`Boss: ${bossEnemy.name}`}
                  onClick={() => send({ type: "beginBattle" })}
                />
              </TooltipTrigger>
              <TooltipContent>
                <CreatureDetails kind={bossEnemy.species} name={bossEnemy.name} speciesKit />
              </TooltipContent>
            </Tooltip>
          ) : (
            <ArtCard
              aspect="creature"
              artwork={assetUrl("encounter.combat")}
              data-encounter
              aria-label="Combat"
              onClick={() => send({ type: "beginBattle" })}
            />
          )}
          <h2>{bossEnemy?.name ?? "Combat"}</h2>
        </div>
      </section>
      <BattleEarnings game={game} />
      {recovery ? <RestRecovery key={game.revision} game={game} events={recovery} /> : null}
    </Screen>
  );
}

import { Screen, ScreenHeading } from "./screen";
import { PagedItems } from "./pagination";
import { campfireRecovery } from "../game/support";
import { species } from "../game/content";
import type { Command, GameState } from "../game/types";
import { Button } from "../components/ui/button";
import { AllyCard } from "./cards";
import { KeywordText } from "./keyword-text";
export function Campfire({ game, send }: { game: GameState; send: (command: Command) => boolean }) {
  const creatures = [...game.team, ...game.reserves];
  return (
    <Screen className="campfire-screen">
      <ScreenHeading back={() => send({ type: "leaveCampfire" })}>Campfire</ScreenHeading>
      <PagedItems items={creatures} pageSize={3} className="campfire-roster" label="Rest recovery pages">
        {(creature) => (
          <div key={creature.id}>
            <AllyCard creature={creature} presentation />
            <h2>{species(creature.species).name}</h2>
            <p>
              <KeywordText
                text={`${creature.health}/${species(creature.species).health} Health · Rest +${campfireRecovery(creature)}`}
              />
            </p>
          </div>
        )}
      </PagedItems>
      <Button onClick={() => send({ type: "rest" })}>Rest</Button>
    </Screen>
  );
}

import { campfireRecovery } from "../game/support";
import { species } from "../game/content";
import type { Command, GameState } from "../game/types";
import { Button } from "../components/ui/button";
import { AllyCard } from "./cards";
import { KeywordText } from "./keyword-text";
export function Campfire({ game, send }: { game: GameState; send: (command: Command) => boolean }) {
  const creatures = [...game.team, ...game.reserves];
  return (
    <main className="campfire-screen">
      <h1>Campfire</h1>
      <section className="campfire-roster" aria-label="Rest recovery">
        {creatures.map((creature) => (
          <div key={creature.id}>
            <AllyCard creature={creature} presentation />
            <h2>{species(creature.species).name}</h2>
            <p>
              <KeywordText
                text={`${creature.health}/${species(creature.species).health} Health · Rest +${campfireRecovery(creature)}`}
              />
            </p>
          </div>
        ))}
      </section>
      <Button onClick={() => send({ type: "rest" })}>Rest</Button>
    </main>
  );
}

import { Plus } from "lucide-react";
import { useState } from "react";
import { CreatureCard } from "./cards";
import { species } from "../../game/content";
import type { Command, Creature, GameState } from "../../game/types";
import type { Inspection } from "./inspection-model";
/** Shared by optional starting-lineup management and free combat swaps. */
export function RosterPicker({
  game,
  lineup,
  send,
  inspect,
  close,
}: {
  game: GameState;
  lineup: boolean;
  send: (command: Command) => boolean;
  inspect?: (item: Inspection) => void;
  close: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const all = [...game.team, ...game.reserves];
  const active = lineup ? game.lineup.map((id) => all.find((c) => c.id === id)!) : game.team;
  const reserves = all.filter((c) => !active.some((a) => a.id === c.id));
  const selectedActive = active.some((c) => c.id === selected);
  const choose = (creature: Creature, isActive: boolean) => {
    if (!selected || selectedActive === isActive) {
      setSelected(selected === creature.id ? null : creature.id);
      return;
    }
    const outgoing = isActive ? creature : active.find((c) => c.id === selected)!;
    const incoming = isActive ? reserves.find((c) => c.id === selected)! : creature;
    if (send({ type: lineup ? "setLineup" : "swap", activeId: outgoing.id, reserve: incoming.id })) {
      setSelected(null);
      close();
    }
  };
  const tile = (creature: Creature, isActive: boolean) => (
    <CreatureCard
      progression={game}
      key={creature.id}
      kind={creature.species}
      actorId={creature.id}
      health={creature.health}
      maxHealth={species(creature.species).health}
      block={creature.block}
      combat={creature.combat}
      selected={selected === creature.id}
      disabled={!lineup && !isActive && creature.health === 0}
      label={`${species(creature.species).name}, ${isActive ? (lineup ? "starting" : "deployed") : "backup"}`}
      onClick={() => choose(creature, isActive)}
      onInspect={inspect ? () => inspect({ species: creature.species, creatureId: creature.id }) : undefined}
    />
  );
  return (
    <>
      <section aria-labelledby="roster-active-label">
        <h2 id="roster-active-label">{lineup ? "Starting lineup" : "Deployed"}</h2>
        <div className="swap-roster" data-nav-row>
          {active.map((c) => tile(c, true))}
        </div>
      </section>
      <section aria-labelledby="roster-reserve-label">
        <h2 id="roster-reserve-label">Backup</h2>
        <div className="swap-roster swap-reserves" data-nav-row>
          {reserves.map((c) => tile(c, false))}
          {Array.from({ length: 2 - reserves.length }, (_, index) => (
            <div key={index} className="empty-reserve" role="img" aria-label="Empty backup slot">
              <Plus aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

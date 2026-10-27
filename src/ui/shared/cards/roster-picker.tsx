import { useMessages } from "../localization/message-context";
import { CreatureCard } from "./cards";
import { ArrowDownUp } from "lucide-react";
import { species } from "../../../game/content";
import type { Command, Creature, GameState } from "../../../game/types";

export function ReplacementPicker({
  game,
  outgoing,
  send,
}: {
  game: GameState;
  outgoing: Creature;
  send: (command: Command) => boolean;
}) {
  const i18n = useMessages();
  const tile = (creature: Creature, backup: boolean) => (
    <CreatureCard
      key={creature.id}
      progression={game}
      kind={creature.species}
      actorId={creature.id}
      health={creature.health}
      maxHealth={species(creature.species).health}
      block={creature.block}
      combat={creature.combat}
      disabled={!backup || creature.health <= 0}
      label={
        backup
          ? i18n.message("replacement.backupCreature", "{{creature}}, backup", {
              creature: species(creature.species).name,
            })
          : i18n.message("replacement.knockedOutCreature", "{{creature}}, knocked out", {
              creature: species(creature.species).name,
            })
      }
      onClick={() => {
        if (backup && creature.health > 0)
          send({ type: "swap", activeId: outgoing.id, reserve: creature.id });
      }}
    />
  );
  return (
    <>
      <section className="swap-roster" aria-label={i18n.message("replacement.knockedOut", "Knocked out")}>
        {tile(outgoing, false)}
      </section>
      <ArrowDownUp className="swap-direction" aria-hidden="true" />
      <section
        className="swap-roster"
        aria-label={i18n.message("replacement.backup", "Backup")}
        data-replacement-choices
        data-nav-row
      >
        {game.reserves.filter((unit) => unit.health > 0).map((unit) => tile(unit, true))}
      </section>
    </>
  );
}

import { useMessages } from "../shared/localization/message-context";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowDownUp, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import { species, type SpeciesId } from "../../game/content";
import type { Command, StateAt } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";
import { CreatureCard } from "../shared/cards/cards";
import { captureArtworkSwap } from "../shared/cards/swap-motion";
import { returnFocus } from "../shared/navigation/focus";
import { Screen, ScreenHeading } from "../shared/navigation/screen";

type Props = {
  game: StateAt<"recruit">;
  incoming: SpeciesId;
  send: (command: Command) => boolean;
  inspect: (item: Inspection) => void;
};

/** Only the final command changes the roster; every artwork exchange is a local preview. */
export function RecruitTeam({ game, incoming, send, inspect }: Props) {
  const i18n = useMessages();
  const creatureName = (kind: SpeciesId) => i18n.content(`content.species.${kind}.name`, species(kind).name);
  const [replacement, setReplacement] = useState<string>();
  const root = useRef<HTMLElement>(null);
  const motion = useRef<ReturnType<typeof captureArtworkSwap> | null>(null);
  const all = [...game.team, ...game.reserves];
  const outgoing = all.find((unit) => unit.id === replacement);
  const outside = outgoing?.species ?? incoming;
  useEffect(() => () => motion.current?.cancel(), []);
  useLayoutEffect(() => {
    returnFocus(
      root.current?.querySelector<HTMLButtonElement>(".recruit-team-roster .creature-card") ?? null,
    );
  }, []);
  const preview = (next: string | undefined) => {
    motion.current?.cancel();
    const outsideArt = root.current?.querySelector<HTMLElement>(".recruit-team-exchange .creature-card");
    const slot = (id: string) =>
      [...(root.current?.querySelectorAll<HTMLElement>("[data-roster-slot]") ?? [])]
        .find((node) => node.dataset.rosterSlot === id)
        ?.querySelector<HTMLElement>(".creature-card");
    const poses = [outsideArt];
    if (replacement) poses.push(slot(replacement));
    if (next) poses.push(slot(next));
    const animation = captureArtworkSwap(poses, { hideArtwork: true });
    flushSync(() => setReplacement(next));
    motion.current = animation;
    animation.start();
  };
  const inspectCreature = (kind: SpeciesId, id?: string) => inspect({ species: kind, creatureId: id });
  return (
    <Screen className="recruit-team-screen" ref={root}>
      <ScreenHeading back={false}>{i18n.message("recruit.chooseTeam", "Choose your team")}</ScreenHeading>
      <section
        className="recruit-team-exchange"
        aria-label={i18n.message("recruit.exchange", "Exchange creature")}
      >
        <CreatureCard
          progression={game}
          kind={outside}
          actorId={outgoing?.id}
          readout={false}
          label={
            outgoing
              ? i18n.message("recruit.undoReplacement", "Undo replacement of {{name}}", {
                  name: creatureName(outside),
                })
              : i18n.message("creature.inspect", "Inspect {{name}}", { name: creatureName(incoming) })
          }
          onClick={() => (outgoing ? preview(undefined) : inspectCreature(incoming))}
          onInspect={() => inspectCreature(outside, outgoing?.id)}
        />
      </section>
      <ArrowDownUp className="recruit-team-swap" aria-hidden="true" />
      <section className="recruit-team-tray" aria-labelledby="recruit-team-heading">
        <h2 id="recruit-team-heading">
          <Users aria-hidden="true" />
          {i18n.message("recruit.team", "Team")}
        </h2>
        <div className="recruit-team-roster" data-nav-row>
          {all.map((unit, index) => {
            const selected = replacement === unit.id;
            const kind = selected ? incoming : unit.species;
            return (
              <div className="recruit-team-slot" data-roster-slot={unit.id} key={unit.id}>
                <CreatureCard
                  progression={game}
                  kind={kind}
                  actorId={selected ? undefined : unit.id}
                  readout={false}
                  selected={selected}
                  label={
                    selected
                      ? i18n.message("recruit.undoSlot", "Undo {{name}} in team slot {{slot}}", {
                          name: creatureName(incoming),
                          slot: index + 1,
                        })
                      : i18n.message(
                          "recruit.previewSlot",
                          "Preview replacing {{name}} in team slot {{slot}}",
                          { name: creatureName(kind), slot: index + 1 },
                        )
                  }
                  onClick={() => preview(selected ? undefined : unit.id)}
                  onInspect={() => inspectCreature(kind, selected ? undefined : unit.id)}
                />
              </div>
            );
          })}
        </div>
      </section>
      <footer className="recruit-team-footer">
        <Button
          onClick={() => {
            motion.current?.cancel();
            send({ type: "confirmRecruit", replace: replacement });
          }}
        >
          {i18n.message("recruit.confirm", "Confirm")}
        </Button>
      </footer>
    </Screen>
  );
}

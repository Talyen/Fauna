import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Progress } from "../shared/progress";
import { motionValue } from "../shared/motion-values";
import { Screen, ScreenHeading } from "../shared/screen";
import { PagedItems } from "../shared/pagination";
import { campfireRecovery } from "../../game/support";
import { species } from "../../game/content";
import type { Command, GameState, GameEvent } from "../../game/types";
import { Button } from "../../components/ui/button";
import { AllyCard } from "../shared/cards";
import { KeywordText } from "../shared/keyword-text";
export function Campfire({ game, send }: { game: GameState; send: (command: Command) => boolean }) {
  const creatures = [...game.team, ...game.reserves];
  return (
    <Screen className="campfire-screen">
      <ScreenHeading back={() => send({ type: "leaveCampfire" })}>Campfire</ScreenHeading>
      <PagedItems
        items={creatures}
        pageSize={3}
        adaptive={{ columns: 5, rows: 1 }}
        className="campfire-roster"
        label="Rest recovery pages"
      >
        {(creature) => (
          <div key={creature.id}>
            <AllyCard creature={creature} presentation />
            <h2>{species(creature.species).name}</h2>
            <Progress
              value={creature.health}
              maximum={species(creature.species).health}
              label={`${species(creature.species).name} Health`}
              tone="health"
            />
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

/** Rest is already committed; these meters neither delay navigation nor issue commands. */
export function RestRecovery({ game, events }: { game: GameState; events: GameEvent[] }) {
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (reduced?.matches) return;
    const duration = motionValue("--motion-support");
    const animations = Array.from(
      root.current?.querySelectorAll<HTMLElement>("[data-recovered]") ?? [],
    ).flatMap((meter) => {
      const fill = meter.querySelector<HTMLElement>(".progress-current");
      const value = Number(meter.dataset.recovered);
      const previous = Number(meter.dataset.previous);
      const maximum = Number(meter.dataset.maximum);
      return fill?.animate && duration
        ? [
            fill.animate(
              [
                { transform: `translateX(-${100 - (previous / maximum) * 100}%)` },
                { transform: `translateX(-${100 - (value / maximum) * 100}%)` },
              ],
              { duration, easing: "ease-out" },
            ),
          ]
        : [];
    });
    const settle = () => {
      if (reduced?.matches) animations.forEach((animation) => animation.cancel());
    };
    reduced?.addEventListener?.("change", settle);
    return () => {
      animations.forEach((animation) => animation.cancel());
      reduced?.removeEventListener?.("change", settle);
    };
  }, [visible]);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), motionValue("--rest-feedback-duration") || 1800);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <section ref={root} className="rest-recovery" aria-label="Rest recovery" role="status">
      {[...game.team, ...game.reserves].map((creature) => {
        const amount = events
          .filter((event) => event.kind === "heal" && event.targetId === creature.id)
          .reduce((total, event) => total + (event.amount ?? 0), 0);
        if (!amount) return null;
        const name = species(creature.species).name;
        const maximum = species(creature.species).health;
        return (
          <div
            key={creature.id}
            data-recovered={creature.health}
            data-previous={creature.health - amount}
            data-maximum={maximum}
          >
            <strong>{name}</strong>
            <Progress value={creature.health} maximum={maximum} label={`${name} Health`} tone="health" />
            <p>
              <KeywordText text={`${creature.health - amount} → ${creature.health} Health · +${amount}`} />
            </p>
          </div>
        );
      })}
    </section>
  );
}

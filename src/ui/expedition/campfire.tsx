import { useMessages } from "../shared/localization/message-context";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Progress } from "../shared/progress";
import { motionValue } from "../shared/motion-values";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PagedItems } from "../shared/navigation/pagination";
import { campfireRecovery } from "../../game/destinations";
import { species } from "../../game/content";
import type { Command, GameState, GameEvent, StateAt } from "../../game/types";
import { Button } from "../../components/ui/button";
import { AllyCard } from "../shared/cards/cards";
import { KeywordText } from "../shared/keyword-text";
export function Campfire({ game, send }: { game: StateAt<"campfire">; send: (command: Command) => boolean }) {
  const i18n = useMessages();
  const creatures = [...game.team, ...game.reserves];
  return (
    <Screen className="campfire-screen">
      <ScreenHeading back={() => send({ type: "leaveCampfire" })}>
        {i18n.message("campfire.name", "Campfire")}
      </ScreenHeading>
      <PagedItems
        items={creatures}
        pageSize={3}
        adaptive={{ columns: 5, rows: 1 }}
        className="campfire-roster"
        label={i18n.message("campfire.pages", "Rest recovery pages")}
      >
        {(creature) => (
          <div key={creature.id}>
            <AllyCard creature={creature} presentation />
            <h2>
              {i18n.content(`content.species.${creature.species}.name`, species(creature.species).name)}
            </h2>
            <Progress
              value={creature.health}
              maximum={species(creature.species).health}
              label={i18n.message("campfire.creatureHealth", "{{name}} Health", {
                name: i18n.content(
                  `content.species.${creature.species}.name`,
                  species(creature.species).name,
                ),
              })}
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
      <Button onClick={() => send({ type: "rest" })}>{i18n.message("campfire.rest", "Rest")}</Button>
    </Screen>
  );
}

/** Rest is already committed; these meters neither delay navigation nor issue commands. */
export function RestRecovery({ game, events }: { game: GameState; events: GameEvent[] }) {
  const i18n = useMessages();
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
    <section
      ref={root}
      className="rest-recovery"
      aria-label={i18n.message("campfire.recovery", "Rest recovery")}
      role="status"
    >
      {[...game.team, ...game.reserves].map((creature) => {
        const amount = events
          .filter(
            (event): event is Extract<GameEvent, { kind: "heal" }> =>
              event.kind === "heal" && event.targetId === creature.id,
          )
          .reduce((total, event) => total + (event.amount ?? 0), 0);
        if (!amount) return null;
        const name = i18n.content(`content.species.${creature.species}.name`, species(creature.species).name);
        const maximum = species(creature.species).health;
        return (
          <div
            key={creature.id}
            data-recovered={creature.health}
            data-previous={creature.health - amount}
            data-maximum={maximum}
          >
            <strong>{name}</strong>
            <Progress
              value={creature.health}
              maximum={maximum}
              label={i18n.message("campfire.creatureHealth", "{{name}} Health", { name })}
              tone="health"
            />
            <p>
              <KeywordText text={`${creature.health - amount} → ${creature.health} Health · +${amount}`} />
            </p>
          </div>
        );
      })}
    </section>
  );
}

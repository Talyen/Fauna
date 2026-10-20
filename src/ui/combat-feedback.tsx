import type { SoundCue } from "./audio-runtime";
import { useEffect, useState, useRef, useCallback, type RefObject } from "react";
import { selectCombatCue } from "./combat-audio";
import { createCombatImpacts } from "./combat-impact";
import { Heart, Shield, Skull } from "lucide-react";
import type { Session } from "../application/session";
import type { GameEvent } from "../game/types";
import { DamageValue } from "./combat-values";
export interface Burst {
  id: string;
  targetId: string;
  started: number;
  entries: GameEvent[];
}
const LIFETIME = 1400;
/** Display-only consolidation: same recipient, kind, type and direction. Expiry never extends. */
export function appendFeedback(
  previous: readonly Burst[],
  events: readonly GameEvent[],
  id: number | string,
  now: number,
): Burst[] {
  let bursts = previous
    .filter((b) => now - b.started < LIFETIME)
    .map((b) => ({ ...b, entries: b.entries.map((e) => ({ ...e })) }));
  for (const event of events) {
    if (!event.targetId || !["damage", "heal", "block", "knockout", "status"].includes(event.kind)) continue;
    let burst = bursts.find((b) => b.targetId === event.targetId && now - b.started < 250);
    if (!burst) {
      burst = { id: `${id}-${event.targetId}`, targetId: event.targetId, started: now, entries: [] };
      bursts.push(burst);
    }
    const match = burst.entries.find(
      (e) =>
        e.kind === event.kind &&
        e.damageType === event.damageType &&
        (event.kind !== "status" || e.text === event.text) &&
        Math.sign(e.amount ?? 0) === Math.sign(event.amount ?? 0),
    );
    if (match && event.kind !== "knockout" && event.kind !== "status")
      match.amount = (match.amount ?? 0) + (event.amount ?? 0);
    else if (!match) burst.entries.push({ ...event });
  }
  bursts = bursts.filter(
    (b) => bursts.filter((other) => other.targetId === b.targetId && other.started >= b.started).length <= 3,
  );
  return bursts;
}
export function feedbackFrames(events: readonly GameEvent[]): GameEvent[][] {
  const frames: GameEvent[][] = [];
  let actor: string | undefined;
  for (const event of events) {
    if (event.actorId?.startsWith("enemy-") && event.actorId !== actor) {
      frames.push([]);
      actor = event.actorId;
    }
    if (!frames.length) frames.push([]);
    frames[frames.length - 1]!.push(event);
  }
  return frames.filter((frame) =>
    frame.some((e) => e.targetId && ["damage", "heal", "block", "knockout", "status"].includes(e.kind)),
  );
}
export function useCombatFeedback(
  session: Session,
  root: RefObject<HTMLDivElement | null>,
  playSound: (cue: SoundCue) => void,
  paused = false,
) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const denial = useRef<(element: HTMLElement) => void>(() => {});
  const deny = useCallback((element: HTMLElement) => denial.current(element), []);
  useEffect(() => {
    if (paused) {
      setBursts([]);
      return;
    }
    const impacts = createCombatImpacts(() => root.current);
    const deniedAnimations = new Map<HTMLElement, Animation>();
    denial.current = (element) => {
      playSound("deny");
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !element.animate) return;
      deniedAnimations.get(element)?.cancel();
      const animation = element.animate(
        [{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "0 0" }],
        { duration: 180, easing: "ease-out" },
      );
      deniedAnimations.set(element, animation);
      animation.onfinish = () => {
        if (deniedAnimations.get(element) === animation) deniedAnimations.delete(element);
      };
    };
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const cancelPending = () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
    const unsubscribe = session.store.subscribe((current, previous) => {
      if (current.game.revision === previous.game.revision) return;
      // Fresh accepted input interrupts the remaining visual sequence, never gameplay.
      cancelPending();
      if (current.game.phase !== "battle") {
        setBursts([]);

        return;
      }
      feedbackFrames(current.events).forEach((events, index) => {
        const show = () => {
          setBursts((items) =>
            appendFeedback(items, events, `${current.game.revision}:${index}`, performance.now()),
          );
          impacts.present(events);
          const cue = selectCombatCue(events);
          if (cue) playSound(cue);
          else if (events.some((event) => event.kind === "knockout")) playSound("knockout");
        };
        if (index === 0) show();
        else {
          const timer = setTimeout(() => {
            pending.delete(timer);
            show();
          }, index * 300);
          pending.add(timer);
        }
      });
    });
    const interval = setInterval(
      () =>
        setBursts((items) =>
          items.some((b) => performance.now() - b.started >= LIFETIME)
            ? items.filter((b) => performance.now() - b.started < LIFETIME)
            : items,
        ),
      100,
    );
    return () => {
      denial.current = () => {};
      deniedAnimations.forEach((animation) => animation.cancel());
      deniedAnimations.clear();
      unsubscribe();
      cancelPending();
      clearInterval(interval);
      impacts.dispose();
    };
  }, [session, root, playSound, paused]);
  return { bursts, deny };
}

export function CombatFeedback({ bursts, targetId }: { bursts: readonly Burst[]; targetId: string }) {
  return (
    <div className="combat-feedback" aria-hidden="true">
      {bursts
        .filter((b) => b.targetId === targetId)
        .map((b) => (
          <div key={b.id} className="combat-burst">
            {b.entries.map((e, i) => {
              const Icon = e.kind === "heal" ? Heart : e.kind === "block" ? Shield : Skull;
              return (
                <span
                  key={i}
                  className="combat-number"
                  data-combat-tone={e.kind === "heal" || e.kind === "block" ? e.kind : undefined}
                >
                  {e.kind === "damage" ? (
                    <DamageValue type={e.damageType ?? "physical"} amount={e.amount ?? 0} signed />
                  ) : e.kind === "status" ? (
                    e.text
                  ) : (
                    <>
                      <Icon />
                      {e.kind !== "knockout" ? `${(e.amount ?? 0) > 0 ? "+" : ""}${e.amount ?? 0}` : null}
                    </>
                  )}
                </span>
              );
            })}
          </div>
        ))}
    </div>
  );
}

import { startPerformanceSpan, measurePerformance, type SpanEnd } from "../../lib/performance";
import { motionValue } from "../shared/motion-values";
import type { SoundCue } from "../audio/audio-runtime";
import { useEffect, useState, useRef, useCallback, type RefObject } from "react";
import { selectCombatCue } from "../audio/combat-audio";
import { createCombatImpacts } from "./combat-impact";
import type { Session } from "../../application/session";
import { appendFeedback, feedbackFrames } from "./combat-feedback-model";
import type { Burst } from "./combat-feedback-model";
export { appendFeedback } from "./combat-feedback-model";
export type { Burst } from "./combat-feedback-model";
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
      // eslint-disable-next-line react/set-state-in-effect -- Pausing cancels the imperative feedback timeline and drops its retained visual queue
      setBursts([]);
      return;
    }
    const impacts = createCombatImpacts(() => root.current);
    const deniedAnimations = new Map<HTMLElement, Animation>();
    denial.current = (element) => {
      playSound("deny");
      if (!element.animate) return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        deniedAnimations.get(element)?.cancel();
        const cue = element.animate(
          [{ borderColor: "var(--destructive)" }, { borderColor: "var(--border)" }],
          { duration: motionValue("--motion-deny") },
        );
        deniedAnimations.set(element, cue);
        cue.onfinish = () => {
          if (deniedAnimations.get(element) === cue) deniedAnimations.delete(element);
        };
        return;
      }
      deniedAnimations.get(element)?.cancel();
      const animation = element.animate(
        [{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "0 0" }],
        { duration: motionValue("--motion-deny"), easing: "ease-out" },
      );
      deniedAnimations.set(element, animation);
      animation.onfinish = () => {
        if (deniedAnimations.get(element) === animation) deniedAnimations.delete(element);
      };
    };
    const pending = new Map<ReturnType<typeof setTimeout>, () => void>();
    let endSequence: SpanEnd = () => {};
    const cancelPending = (reveal = false) => {
      endSequence("interrupted");
      endSequence = () => {};
      pending.forEach((numbers, timer) => {
        clearTimeout(timer);
        if (reveal) numbers();
      });
      pending.clear();
    };
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motionChange = () => {
      if (motion?.matches) {
        cancelPending(true);
        impacts.cancel();
        deniedAnimations.forEach((animation) => animation.cancel());
        deniedAnimations.clear();
      }
    };
    motion?.addEventListener?.("change", motionChange);
    const unsubscribe = session.store.subscribe((current, previous) => {
      if (current.game.revision === previous.game.revision) return;
      // Fresh accepted input interrupts the remaining visual sequence, never gameplay.
      cancelPending(true);
      impacts.cancel();
      if (current.game.phase !== "battle") {
        setBursts([]);

        return;
      }
      const frames = measurePerformance("feedback-adaptation", () => feedbackFrames(current.events), {
        revision: current.game.revision,
      });
      endSequence = startPerformanceSpan("feedback-dispatch-sequence", { revision: current.game.revision });
      frames.forEach((events, index) => {
        const numbers = () => {
          setBursts((items) =>
            appendFeedback(
              items,
              events,
              `${current.game.revision}:${index}`,
              performance.now(),
              motionValue("--feedback-duration") || 1100,
            ),
          );
        };
        const show = () => {
          numbers();
          measurePerformance("feedback-presentation", () => impacts.present(events), {
            revision: current.game.revision,
          });
          const cue = selectCombatCue(events);
          if (cue) playSound(cue);
          else if (events.some((event) => event.kind === "knockout")) playSound("knockout");
          if (index === frames.length - 1) endSequence();
        };
        if (index === 0 || motion?.matches) show();
        else {
          const timer = setTimeout(
            () => {
              pending.delete(timer);
              show();
            },
            index * motionValue("--motion-feedback-sequence"),
          );
          pending.set(timer, numbers);
        }
      });
      if (!frames.length) endSequence();
    });
    const interval = setInterval(
      () =>
        setBursts((items) =>
          items.some((b) => performance.now() - b.started >= b.lifetime)
            ? items.filter((b) => performance.now() - b.started < b.lifetime)
            : items,
        ),
      100,
    );
    return () => {
      motion?.removeEventListener?.("change", motionChange);
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

export { CombatFeedback } from "./combat-feedback-rail";

import { startPerformanceSpan, measurePerformance, type SpanEnd } from "../../lib/performance";
import { motionValue } from "../shared/motion-values";
import type { SoundCue } from "../audio/audio-runtime";
import { useEffect, useState, useRef, useCallback, type RefObject } from "react";
import { selectCombatCue } from "../audio/combat-audio";
import { createCombatImpacts } from "./combat-impact";
import { createCombatPlayback } from "./combat-playback";
import type { BattleState } from "../../game/types";
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
  const [visual, setVisual] = useState<{ bursts: Burst[]; scene: BattleState | null }>({
    bursts: [],
    scene: null,
  });
  const playbackRef = useRef<ReturnType<typeof createCombatPlayback> | null>(null);
  const finish = useCallback(() => playbackRef.current?.finish(), []);
  const isPresenting = useCallback(() => playbackRef.current?.isBusy() ?? false, []);
  const denial = useRef<(element: HTMLElement) => void>(() => {});
  const deny = useCallback((element: HTMLElement) => denial.current(element), []);
  useEffect(() => {
    if (paused) {
      // eslint-disable-next-line react/set-state-in-effect -- Pausing cancels the imperative feedback timeline and drops its retained visual queue
      setVisual({ bursts: [], scene: null });
      return;
    }
    const impacts = createCombatImpacts(() => root.current);
    const deniedAnimations = new Map<HTMLElement, Animation>();
    denial.current = (element) => {
      playSound("deny");
      if (!element.animate) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      deniedAnimations.get(element)?.cancel();
      const animation = element.animate(
        reduced
          ? [{ borderColor: "var(--destructive)" }, { borderColor: "var(--border)" }]
          : [{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "0 0" }],
        reduced
          ? { duration: motionValue("--motion-deny") }
          : { duration: motionValue("--motion-deny"), easing: "ease-out" },
      );
      deniedAnimations.set(element, animation);
      animation.onfinish = () => {
        if (deniedAnimations.get(element) === animation) deniedAnimations.delete(element);
      };
    };
    let endSequence: SpanEnd = () => {};
    let outcome: SoundCue | undefined;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const numbers = (events: Parameters<typeof appendFeedback>[1], id: string) => {
      setVisual((previous) => ({
        ...previous,
        bursts: appendFeedback(
          previous.bursts,
          events,
          id,
          performance.now(),
          motionValue("--feedback-duration") || 1100,
        ),
      }));
    };
    const playback = createCombatPlayback(
      {
        scene: (scene) => setVisual((previous) => ({ ...previous, scene })),
        action: (events) => impacts.start(events),
        numbers,
        impact: (events, id) => {
          numbers(events, id);
          measurePerformance("feedback-presentation", () => impacts.present(events));
          const cue = selectCombatCue(events);
          if (cue) playSound(cue);
          else if (events.some((event) => event.kind === "knockout")) playSound("knockout");
        },
        complete: () => {
          endSequence();
          endSequence = () => {};
          const cue = outcome;
          outcome = undefined;
          if (cue) playSound(cue);
        },
      },
      () => ({
        attack: motionValue("--motion-attack"),
        support: motionValue("--motion-support"),
        feedback: motionValue("--motion-feedback-sequence"),
        lifetime: motionValue("--feedback-duration") || 1100,
      }),
    );
    playbackRef.current = playback;
    const stop = () => {
      playback.finish();
      impacts.cancel();
      deniedAnimations.forEach((animation) => animation.cancel());
      deniedAnimations.clear();
    };
    const motionChange = () => {
      if (motion?.matches) stop();
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    motion?.addEventListener?.("change", motionChange);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", visibility);
    const unsubscribe = session.store.subscribe((current, previous) => {
      if (current.game.revision === previous.game.revision) return;
      endSequence("interrupted");
      const before =
        previous.game.phase === "battle"
          ? previous.game
          : current.game.phase === "battle"
            ? current.game
            : null;
      const frames = measurePerformance(
        "feedback-adaptation",
        () =>
          current.battleFrames ??
          (before ? feedbackFrames(current.events).map((events) => ({ events, state: before })) : []),
      );
      if (!before || !frames.length) {
        playback.finish(current.game.phase === "battle");
        if (current.game.phase !== "battle") {
          impacts.cancel();
          setVisual({ bursts: [], scene: null });
        }
        return;
      }
      playback.finish();
      outcome =
        current.game.phase === "battle" ? undefined : current.game.phase === "defeat" ? "defeat" : "victory";
      endSequence = startPerformanceSpan("feedback-dispatch-sequence", { revision: current.game.revision });
      playback.play(
        frames,
        before,
        String(current.game.revision),
        current.game.phase !== "battle",
        !!motion?.matches,
      );
    });
    const interval = setInterval(
      () =>
        setVisual((previous) => {
          const now = performance.now();
          return previous.bursts.some((b) => now - b.started >= b.lifetime)
            ? { ...previous, bursts: previous.bursts.filter((b) => now - b.started < b.lifetime) }
            : previous;
        }),
      100,
    );
    return () => {
      motion?.removeEventListener?.("change", motionChange);
      denial.current = () => {};
      deniedAnimations.forEach((animation) => animation.cancel());
      deniedAnimations.clear();
      unsubscribe();
      playbackRef.current = null;
      outcome = undefined;
      playback.finish(false);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", visibility);
      clearInterval(interval);
      impacts.dispose();
    };
  }, [session, root, playSound, paused]);
  return {
    bursts: visual.bursts,
    scene: paused ? null : visual.scene,
    presenting: !paused && visual.scene !== null,
    finish,
    isPresenting,
    deny,
  };
}

export { CombatFeedback } from "./combat-feedback-rail";

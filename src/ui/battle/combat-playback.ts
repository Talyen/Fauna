import type { BattleFrame, BattleState, GameEvent } from "../../game/types";

export interface CombatPlaybackPort {
  scene(state: BattleState | null): void;
  action(events: readonly GameEvent[]): void;
  impact(events: readonly GameEvent[], id: string): void;
  numbers(events: readonly GameEvent[], id: string): void;
  complete(): void;
}
export interface CombatTiming {
  attack: number;
  support: number;
  feedback: number;
  lifetime: number;
}
/** Presentation consumes committed checkpoints; its timers have no command or save capability. */
export function createCombatPlayback(port: CombatPlaybackPort, timing: () => CombatTiming) {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let remaining: { frame: BattleFrame; id: string; shown: boolean }[] = [];
  let busy = false;
  let generation = 0;
  const clear = () => {
    generation++;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
  const later = (callback: () => void, delay: number) => {
    const current = generation;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (current === generation) callback();
    }, delay);
    timers.add(timer);
  };
  const finish = (reveal = true) => {
    clear();
    if (reveal) for (const item of remaining) if (!item.shown) port.numbers(item.frame.events, item.id);
    remaining = [];
    busy = false;
    port.scene(null);
    port.complete();
  };
  return {
    isBusy: () => busy,
    finish,
    play(
      frames: readonly BattleFrame[],
      before: BattleState,
      id: string,
      terminal: boolean,
      reduced: boolean,
    ) {
      // Manual takeover settles pending facts but leaves unrelated in-flight portrait movement intact.
      if (busy) finish();
      if (!frames.length) return;
      busy = true;
      remaining = frames.map((frame, index) => ({ frame, id: `${id}:${index}`, shown: false }));
      const duration = timing();
      let elapsed = 0;
      let lastImpact = 0;
      port.scene(before);
      for (const item of remaining) {
        const { frame } = item;
        const action = frame.events.find((event) => event.kind === "action" && event.actionType !== "swap");
        const length = reduced
          ? 0
          : action?.kind === "action"
            ? action.actionType === "attack"
              ? duration.attack
              : duration.support
            : frame.events.length
              ? duration.feedback
              : 0;
        const apex = action?.kind === "action" ? length * (action.actionType === "attack" ? 0.24 : 0.3) : 0;
        const start = () => port.action(frame.events);
        const impact = () => {
          item.shown = true;
          port.scene(frame.state);
          port.impact(frame.events, item.id);
        };
        if (elapsed === 0) start();
        else later(start, elapsed);
        if (elapsed + apex === 0) impact();
        else later(impact, elapsed + apex);
        if (frame.events.length) lastImpact = elapsed + apex;
        elapsed += length;
      }
      // The final hit keeps its normal readable lifetime on the outgoing battlefield.
      const end = terminal ? Math.max(elapsed, lastImpact + duration.lifetime) : elapsed;
      if (!end) finish(false);
      else later(() => finish(false), end);
    },
  };
}

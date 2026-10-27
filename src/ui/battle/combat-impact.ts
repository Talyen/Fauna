import { motionValue } from "../shared/motion-values";
import type { GameEvent } from "../../game/types";
/** Positive health loss recoils; absorbed and ineffective hits keep numbers/audio only. */
export function impactTargets(events: readonly GameEvent[]): string[] {
  const targets = new Set<string>();
  for (const event of events)
    if (event.kind === "damage" && event.impact !== false && event.amount > 0) targets.add(event.targetId!);
  return [...targets];
}
export function createCombatImpacts(root: () => HTMLElement | null) {
  const active = new Map<string, Animation>(),
    last = new Map<string, number>();
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let disposed = false;
  const cancel = () => {
    active.forEach((a) => a.cancel());
    active.clear();
    last.clear();
  };
  const reduce = () => {
    if (reduced?.matches) cancel();
  };
  reduced?.addEventListener?.("change", reduce);
  const animate = (
    key: string,
    element: HTMLElement | null | undefined,
    frames: Keyframe[],
    duration: number,
  ) => {
    if (!element?.animate) return;
    active.get(key)?.cancel();
    const animation = element.animate(frames, { duration, easing: "cubic-bezier(0.2, 1, 0.36, 1)" });
    active.set(key, animation);
    animation.onfinish = () => {
      if (active.get(key) === animation) active.delete(key);
    };
  };
  return {
    cancel,
    present(events: readonly GameEvent[]) {
      if (disposed || reduced?.matches) return;
      for (const event of events) {
        if (event.kind !== "action" || event.actionType === "swap") continue;
        const element = root()?.querySelector<HTMLElement>(
          `[data-actor-id="${event.actorId}"] .combatant-motion`,
        );
        const direction = event.actorId.startsWith("enemy-") ? 1 : -1;
        animate(
          `action:${event.actorId}`,
          element,
          event.actionType === "attack"
            ? [
                { transform: "none", offset: 0, easing: "cubic-bezier(0.25,0,0.15,1)" },
                {
                  transform: `translateY(${-8 * direction}px) scale(0.97,1.03) rotate(${-2 * direction}deg)`,
                  offset: 0.16,
                  easing: "cubic-bezier(0.08,0.92,0.18,1)",
                },
                {
                  transform: `translateY(${30 * direction}px) scale(1.06,0.94) rotate(${3 * direction}deg)`,
                  offset: 0.24,
                },
                { transform: "none", offset: 1 },
              ]
            : [
                { transform: "none" },
                { transform: "translateY(6px) scale(1.05,0.95)", offset: 0.3 },
                { transform: "translateY(-2px) scale(0.985,1.015)", offset: 0.6 },
                { transform: "none" },
              ],
          motionValue(event.actionType === "attack" ? "--motion-attack" : "--motion-support"),
        );
      }
      for (const id of impactTargets(events)) {
        if (performance.now() - (last.get(id) ?? -Infinity) < motionValue("--motion-hit")) continue;
        const actor = root()?.querySelector<HTMLElement>(`[data-actor-id="${id}"]`);
        let amount = 0;
        let periodic = true;
        for (const event of events) {
          if (event.kind !== "damage" || event.targetId !== id) continue;
          amount += event.amount;
          if (event.damageType !== "burn" && event.damageType !== "poison" && event.damageType !== "bleed")
            periodic = false;
        }
        const loss = amount / (Number(actor?.dataset.maxHealth) || 1);
        const strength = periodic || loss < 0.05 ? 3 : loss < 0.2 ? 6 : 10;
        const recoil = strength * (id.startsWith("enemy-") ? -1 : 1);
        last.set(id, performance.now());
        animate(
          `hit:${id}`,
          actor?.querySelector<HTMLElement>(".combatant-reaction"),
          [
            { transform: "translateY(0)" },
            { transform: `translateY(${recoil}px)`, offset: 0.22 },
            { transform: `translateY(${-recoil * 0.35}px)`, offset: 0.55 },
            { transform: "translateY(0)" },
          ],
          motionValue("--motion-hit"),
        );
      }
    },
    dispose() {
      disposed = true;
      cancel();
      reduced?.removeEventListener?.("change", reduce);
    },
  };
}

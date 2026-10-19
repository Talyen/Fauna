import type { GameEvent } from "../game/types";
/** Positive health loss recoils; absorbed and ineffective hits keep numbers/audio only. */
export function impactTargets(events: readonly GameEvent[]): string[] {
  return [
    ...new Set(
      events.filter((e) => e.kind === "damage" && (e.amount ?? 0) > 0 && e.targetId).map((e) => e.targetId!),
    ),
  ];
}
export function createCombatImpacts(root: () => HTMLElement | null) {
  const active = new Map<string, Animation>(),
    last = new Map<string, number>();
  return {
    present(events: readonly GameEvent[]) {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      for (const id of impactTargets(events)) {
        if (performance.now() - (last.get(id) ?? -Infinity) < 180) continue;
        const card = root()?.querySelector<HTMLElement>(`[data-actor-id="${id}"] .creature-card`);
        if (!card?.animate) continue;
        active.get(id)?.cancel();
        last.set(id, performance.now());
        const animation = card.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-4px)", offset: 0.2 },
            { transform: "translateX(3px)", offset: 0.45 },
            { transform: "translateX(-2px)", offset: 0.7 },
            { transform: "translateX(0)" },
          ],
          { duration: 180, easing: "ease-out" },
        );
        active.set(id, animation);
        animation.onfinish = () => {
          if (active.get(id) === animation) active.delete(id);
        };
      }
    },
    dispose() {
      active.forEach((animation) => animation.cancel());
      active.clear();
      last.clear();
    },
  };
}

import type { Creature, Enemy } from "../../game/types";

type Unit = Creature | Enemy;
type Slot = "left" | "center" | "right";

/** The same slots place Legendary combatants and order directional targets. */
export function battlefieldPresentation<T extends Unit>(row: readonly T[], legendary: boolean) {
  const visible = row.filter((unit) => !("minion" in unit && unit.minion) || unit.health > 0);
  return visible.map((unit, index) => {
    let slot: Slot | undefined;
    if (legendary) {
      slot = index === 0 ? "center" : index === 1 ? "left" : "right";
      if (/^(pendulum|ward)-.*-0$/.test(unit.id)) slot = "left";
      if (/^(pendulum|ward)-.*-1$/.test(unit.id)) slot = "right";
    }
    return { unit, slot };
  });
}

export function orderedTargets(
  recipients: readonly Unit[],
  battlefield: ReturnType<typeof battlefieldPresentation>,
  backups: readonly Creature[],
) {
  const legal = new Set(recipients.map((unit) => unit.id));
  const rank = { left: 0, center: 1, right: 2 };
  const ordered = [...battlefield].sort((a, b) => (a.slot && b.slot ? rank[a.slot] - rank[b.slot] : 0));
  return [...ordered.map(({ unit }) => unit.id), ...backups.map((unit) => unit.id)].filter((id) =>
    legal.has(id),
  );
}

/** Locate either kind of explicit recipient for focus and targeting geometry. */
export function targetElement(board: HTMLElement | null, id: string | undefined) {
  if (!board || !id) return null;
  return board.querySelector<HTMLElement>(
    `[data-actor-id="${id}"] .creature-card, [data-backup-target="${id}"]`,
  );
}

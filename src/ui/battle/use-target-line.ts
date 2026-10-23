import { useLayoutEffect, useState, type RefObject } from "react";

/** Target geometry follows committed layout; it never owns selection or command state. */
export function useTargetLine(
  board: RefObject<HTMLElement | null>,
  actorId: string | undefined,
  selected: string | null,
  target: string | undefined,
  allyTarget: boolean,
) {
  const [line, setLine] = useState("");
  useLayoutEffect(() => {
    const update = () => {
      const root = board.current;
      const actor = root?.querySelector(`[data-actor-id="${actorId}"] .creature-card`);
      const recipient = root?.querySelector(`[data-actor-id="${target}"] .creature-card`);
      if (!root || !actor || !recipient || !selected || !target) {
        setLine("");
        return;
      }
      const origin = root.getBoundingClientRect(),
        a = actor.getBoundingClientRect(),
        b = recipient.getBoundingClientRect();
      const x = a.x + (actorId === target ? 0 : a.width / 2) - origin.x,
        y = a.y - origin.y - 8,
        endX = allyTarget ? b.x + b.width / 2 - origin.x : b.right - origin.x + 6,
        endY = allyTarget ? b.y - origin.y - 8 : b.bottom - origin.y - 10;
      const arch = Math.min(y, endY) - 32;
      setLine(
        allyTarget
          ? `M ${x} ${y} C ${x} ${arch}, ${endX} ${arch}, ${endX} ${endY}`
          : `M ${x} ${y} C ${endX} ${y - 24}, ${endX} ${endY + 24}, ${endX} ${endY}`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (board.current) observer.observe(board.current);
    return () => observer.disconnect();
  }, [board, actorId, selected, target, allyTarget]);
  return line;
}

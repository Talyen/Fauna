import { motionValue } from "../shared/motion-values";
import { visualClone } from "../shared/visual-clone";
/** Visual copies outlive the closing picker; gameplay and focus transfer immediately. */
export function captureSwapMotion(activeId: string, reserveId: string) {
  const root = document.querySelector(".swap-dialog");
  const poses = [activeId, reserveId].map((id) =>
    root?.querySelector<HTMLElement>(`[data-actor-id="${id}"] .creature-card`),
  );
  const records = poses.map((node) =>
    node ? { clone: visualClone(node), rect: node.getBoundingClientRect() } : null,
  );
  let frame = 0;
  let cancelled = false;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const cancel = () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    records.forEach((r) => r?.clone.remove());
    reduced?.removeEventListener?.("change", cancel);
    window.removeEventListener("pointerdown", cancel, true);
    window.removeEventListener("keydown", cancel, true);
  };
  return {
    cancel,
    start() {
      if (cancelled) return;
      if (
        !motionValue("--motion-fast") ||
        reduced?.matches ||
        !records[0]?.rect.width ||
        !records[1]?.rect.width
      )
        return;
      records.forEach((record) => {
        if (!record) return;
        Object.assign(record.clone.style, {
          position: "fixed",
          width: `${record.rect.width}px`,
          height: `${record.rect.height}px`,
          margin: "0",
          zIndex: "60",
          scale: "1",
          transform: "none",
          translate: "none",
        });
        document.body.append(record.clone);
      });
      reduced?.addEventListener?.("change", cancel);
      window.addEventListener("pointerdown", cancel, true);
      window.addEventListener("keydown", cancel, true);
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / motionValue("--motion-fast")),
          p = 1 - (1 - t) ** 3;
        records.forEach((record, index) => {
          const target = records[1 - index];
          if (!record || !target) return;
          record.clone.style.left = `${record.rect.x + (target.rect.x - record.rect.x) * p}px`;
          record.clone.style.top = `${record.rect.y + (target.rect.y - record.rect.y) * p + (index ? 1 : -1) * Math.sin(Math.PI * p) * motionValue("--swap-arc-height")}px`;
        });
        if (t < 1) frame = requestAnimationFrame(tick);
        else cancel();
      };
      tick();
    },
  };
}

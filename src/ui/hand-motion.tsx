import { motionValue } from "./motion-values";
import { Component, createRef, type ReactNode } from "react";
import { assetUrl } from "./assets";
import { visualClone } from "./visual-clone";
type Pose = {
  rect: DOMRect;
  node: HTMLElement;
  clone: HTMLElement;
  angle: number;
  width: number;
  height: number;
};
type Snapshot = Map<string, Pose>;
type Props = { revision: number; turn?: number; opening?: boolean; paused: boolean; children: ReactNode };
// Alchemy uses the CSS ease-in-out curve for one uninterrupted half-turn.
function flipEase(time: number) {
  if (time <= 0 || time >= 1) return time;
  let low = 0,
    high = 1;
  for (let i = 0; i < 16; i++) {
    const t = (low + high) / 2;
    const x = 3 * (1 - t) ** 2 * t * 0.42 + 3 * (1 - t) * t * t * 0.58 + t ** 3;
    if (x < time) low = t;
    else high = t;
  }
  const t = (low + high) / 2;
  return 3 * (1 - t) * t * t + t ** 3;
}
function discardRect(pile: DOMRect) {
  const styles = getComputedStyle(document.documentElement);
  const fraction = (token: string, fallback: number) => {
    const value = Number.parseFloat(styles.getPropertyValue(token));
    return Number.isFinite(value) ? value / 100 : fallback;
  };
  return {
    x: pile.x + pile.width * fraction("--discard-top-x", 25 / 420),
    y: pile.y + pile.height * fraction("--discard-top-y", 25 / 560),
    width: pile.width * fraction("--discard-top-width", 328 / 420),
    height: pile.height * fraction("--discard-top-height", 432 / 560),
  };
}
/** Alchemy transfer/reflow choreography; committed cards and controls remain gameplay-owned. */
export class HandMotion extends Component<Props> {
  private root = createRef<HTMLDivElement>();
  private animations = new Set<Animation>();
  private overlays = new Set<HTMLElement>();
  private hidden = new Set<HTMLElement>();
  private frame = 0;
  private reduced: MediaQueryList | undefined;
  private disposed = false;
  private measure(): Snapshot {
    return new Map(
      Array.from(this.root.current?.querySelectorAll<HTMLElement>(".hand [data-card-id]") ?? []).map(
        (node) => {
          const slot = node.closest<HTMLElement>(".hand-slot");
          const transform = slot ? getComputedStyle(slot).transform : "none";
          const matrix =
            !transform || transform === "none" || typeof DOMMatrixReadOnly === "undefined"
              ? null
              : new DOMMatrixReadOnly(transform);
          const ownTransform = getComputedStyle(node).transform;
          const own =
            !ownTransform || ownTransform === "none" || typeof DOMMatrixReadOnly === "undefined"
              ? null
              : new DOMMatrixReadOnly(ownTransform);
          const scale = Number.parseFloat(getComputedStyle(node).scale) || 1;
          const reflow = slot?.querySelector<HTMLElement>(".hand-reflow");
          const reflowAngle = reflow ? Number.parseFloat(getComputedStyle(reflow).rotate) || 0 : 0;
          return [
            node.dataset.cardId!,
            {
              node,
              clone: visualClone(node),
              rect: node.getBoundingClientRect(),
              angle:
                (((matrix ? Math.atan2(matrix.b, matrix.a) : 0) + (own ? Math.atan2(own.b, own.a) : 0)) *
                  180) /
                  Math.PI +
                reflowAngle,
              width: node.offsetWidth * scale || node.getBoundingClientRect().width,
              height: node.offsetHeight * scale || node.getBoundingClientRect().height,
            },
          ];
        },
      ),
    );
  }
  private finish = () => {
    cancelAnimationFrame(this.frame);
    this.animations.forEach((a) => a.cancel());
    this.animations.clear();
    this.overlays.forEach((e) => e.remove());
    this.overlays.clear();
    this.hidden.forEach((e) => e.style.removeProperty("opacity"));
    this.hidden.clear();
  };
  private motionChange = () => {
    if (this.reduced?.matches) this.finish();
  };
  componentDidMount() {
    this.disposed = false;
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.reduced?.addEventListener?.("change", this.motionChange);
    for (const type of ["pointerdown", "keydown", "click", "resize", "blur"])
      window.addEventListener(type, this.finish, true);
    if (this.props.opening) this.present(new Map());
  }
  getSnapshotBeforeUpdate(previous: Readonly<Props>): Snapshot {
    return previous.revision === this.props.revision ? new Map() : this.measure();
  }
  componentDidUpdate(previous: Readonly<Props>, _: unknown, before: Snapshot) {
    if (previous.revision === this.props.revision) {
      if (this.props.paused) this.finish();
      return;
    }
    this.present(before, previous.turn !== this.props.turn);
  }
  private present(before: Snapshot, newTurn = false) {
    this.finish();
    const after = this.measure();
    if (this.disposed || this.props.paused || this.reduced?.matches) return;
    const board = this.root.current?.closest(".battle-screen");
    if (!board) return;
    const removed = [...before].filter(([id]) => newTurn || !after.has(id)).reverse();
    const added = [...after].filter(([id]) => newTurn || !before.has(id));
    for (const [id, pose] of after) {
      const old = before.get(id);
      const layer = pose.node.closest(".hand-slot")?.querySelector<HTMLElement>(".hand-reflow");
      if (newTurn || !old || !layer?.animate) continue;
      const dx = old.rect.x - pose.rect.x,
        dy = old.rect.y - pose.rect.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.5 && Math.abs(old.angle - pose.angle) < 0.05) continue;
      const radians = (pose.angle * Math.PI) / 180;
      const x = dx * Math.cos(radians) + dy * Math.sin(radians),
        y = -dx * Math.sin(radians) + dy * Math.cos(radians);
      const animation = layer.animate(
        [
          { translate: `${x}px ${y}px`, rotate: `${old.angle - pose.angle}deg` },
          { translate: "0 0", rotate: "0deg" },
        ],
        {
          duration: motionValue("--motion-hand-reflow"),
          easing: "cubic-bezier(0.16,1,0.3,1)",
        },
      );
      this.animations.add(animation);
      animation.onfinish = () => this.animations.delete(animation);
    }
    const flights: {
      pose: Pose;
      destination: HTMLElement | null;
      draw: boolean;
      duration: number;
      start: number;
    }[] = [];
    let start = 0;
    for (const [items, draw] of [
      [removed, false],
      [added, true],
    ] as const) {
      const duration =
        motionValue("--motion-hand-flight") / (items.length >= 4 ? 1.6 : items.length === 3 ? 1.4 : 1);
      for (const [, pose] of items) {
        const pile = board.querySelector<HTMLElement>(`[data-pile="${draw ? "draw" : "discard"}"]`);
        if (!pile || !pose.rect.width) continue;
        flights.push({ pose, destination: draw ? pose.node : pile, draw, duration, start });
        start += duration;
      }
    }
    if (!flights.length || !start) return;
    const now = performance.now();
    const surfaces = flights.map((flight) => {
      const clone = flight.pose.clone;
      const card = flight.pose.node;
      if (flight.draw) {
        card.style.opacity = "0";
        this.hidden.add(card);
      }
      clone.classList.add("card-transfer");
      clone.style.position = "fixed";
      clone.style.margin = "0";
      clone.style.zIndex = String(
        40 + [...before.keys(), ...after.keys()].indexOf(flight.pose.node.dataset.cardId!),
      );
      clone.style.transformOrigin = "center";
      clone.style.scale = "1";
      clone.style.translate = "none";
      document.body.append(clone);
      this.overlays.add(clone);
      const source = flight.draw
        ? board.querySelector<HTMLElement>('[data-pile="draw"]')!.getBoundingClientRect()
        : flight.pose.rect;
      const face = clone.querySelector("img");
      return { ...flight, clone, source, face, completed: false, front: face?.getAttribute("src") ?? "" };
    });
    const tick = () => {
      if (this.disposed) return;
      const elapsed = performance.now() - now;
      for (const f of surfaces) {
        if (f.completed) continue;
        if (elapsed < f.start && f.draw) {
          f.clone.style.opacity = "0";
          continue;
        }
        const t = Math.max(0, Math.min(1, (elapsed - f.start) / f.duration)),
          p = 1 - (1 - t) ** 3;
        const destination = f.destination?.getBoundingClientRect();
        if (!destination?.width) {
          this.finish();
          return;
        }
        const end = f.draw ? destination : discardRect(destination);
        const endScale = Number.parseFloat(getComputedStyle(f.destination!).scale) || 1;
        const endWidth = f.draw ? f.destination!.offsetWidth * endScale || end.width : end.width,
          endHeight = f.draw ? f.destination!.offsetHeight * endScale || end.height : end.height;
        const startWidth = f.draw ? f.source.width : f.pose.width,
          startHeight = f.draw ? f.source.height : f.pose.height;
        const width = startWidth + (endWidth - startWidth) * p,
          height = startHeight + (endHeight - startHeight) * p;
        const arc = Math.sin(Math.PI * p) ** 2 * f.source.height * 0.1;
        const cx =
          f.source.x + f.source.width / 2 + (end.x + end.width / 2 - f.source.x - f.source.width / 2) * p;
        const cy =
          f.source.y +
          f.source.height / 2 +
          (end.y + end.height / 2 - f.source.y - f.source.height / 2) * p -
          arc;
        const flipStart = f.draw ? 0.28 : 0.4,
          flipEnd = f.draw ? 0.82 : 0.95;
        const q = Math.max(0, Math.min(1, (t - flipStart) / (flipEnd - flipStart)));
        const eased = flipEase(q),
          flip = 180 * (f.draw ? 1 - eased : eased);
        if (f.face) {
          const back = flip > 90;
          f.face.src = back ? assetUrl(f.draw ? "card.back" : "pile.discard") : f.front;
          f.face.classList.toggle("discard-card-back", back && !f.draw);
        }
        f.clone.style.opacity = t >= 1 ? "0" : "1";
        f.clone.style.left = `${cx - width / 2}px`;
        f.clone.style.top = `${cy - height / 2}px`;
        f.clone.style.width = `${width}px`;
        f.clone.style.height = `${height}px`;
        f.clone.style.transform = `rotate(${f.draw ? f.pose.angle * p : f.pose.angle * (1 - p)}deg) scaleX(${Math.abs(Math.cos((flip * Math.PI) / 180))})`;
        if (t >= 1) f.completed = true;
        if (t >= 1 && f.draw) {
          f.pose.node.style.removeProperty("opacity");
          this.hidden.delete(f.pose.node);
        }
      }
      if (elapsed < start) this.frame = requestAnimationFrame(tick);
      else this.finish();
    };
    tick();
  }
  componentWillUnmount() {
    this.disposed = true;
    this.finish();
    this.reduced?.removeEventListener?.("change", this.motionChange);
    for (const type of ["pointerdown", "keydown", "click", "resize", "blur"])
      window.removeEventListener(type, this.finish, true);
  }
  render() {
    return (
      <div className="hand-motion-owner" ref={this.root}>
        {this.props.children}
      </div>
    );
  }
}

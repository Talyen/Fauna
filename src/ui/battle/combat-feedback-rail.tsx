import { useLayoutEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Heart, Shield, Skull, Sparkles, Timer } from "lucide-react";
import { isFeedbackNotice, type Burst, type FeedbackEntry } from "./combat-feedback-model";
import { DamageValue } from "../shared/combat/combat-values";
import { KeywordIcon } from "../shared/keyword-icon";
import { motionValue } from "../shared/motion-values";
function FeedbackNumber({ entry: e }: { entry: FeedbackEntry }) {
  const notice = isFeedbackNotice(e);
  const number = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (e.reservedDigits)
      number.current?.style.setProperty(
        "--feedback-value-width",
        `${e.reservedDigits + ((e.amount ?? 0) !== 0 ? 1 : 0)}ch`,
      );
  }, [e.reservedDigits, e.amount]);
  const Icon =
    e.kind === "heal"
      ? Heart
      : e.kind === "block" || e.outcome === "immune"
        ? Shield
        : e.kind === "knockout" || e.status === "deathDoor"
          ? Skull
          : e.outcome === "skip"
            ? Timer
            : Sparkles;
  return (
    <span
      ref={number}
      className={`combat-number${notice ? " combat-notice" : ""}`}
      data-critical={e.critical || undefined}
      data-kind={e.kind}
      data-combat-tone={
        e.kind === "damage"
          ? (e.damageType ?? "physical")
          : e.kind === "heal"
            ? "health"
            : e.kind === "block"
              ? "block"
              : e.status === "deathDoor"
                ? undefined
                : e.status
      }
      aria-label={
        notice
          ? e.text
          : `${e.amount ?? 0} ${e.status ?? e.damageType ?? e.kind}${e.critical ? ". Includes a Critical hit." : ""}`
      }
    >
      {e.kind === "damage" ? (
        <DamageValue type={e.damageType ?? "physical"} amount={e.amount ?? 0} signed />
      ) : (
        <>
          {e.status && e.status !== "deathDoor" ? (
            <>
              {e.outcome === "immune" || e.outcome === "skip" ? <Icon aria-hidden="true" /> : null}
              <KeywordIcon id={e.status} />
              {e.affectedStatus ? <KeywordIcon id={e.affectedStatus} /> : null}
            </>
          ) : (
            <Icon aria-hidden="true" />
          )}
          {!notice || e.amount === 0 ? (
            <span className="feedback-value">
              {(e.amount ?? 0) > 0 ? "+" : ""}
              {e.amount ?? 0}
            </span>
          ) : null}
        </>
      )}
    </span>
  );
}

/** One scene overlay keeps feedback above moving portraits and card flights. */
export function CombatFeedback({
  bursts,
  root,
}: {
  bursts: readonly Burst[];
  root?: RefObject<HTMLElement | null>;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const evicted = useRef(new Set<string>());
  const active = bursts.length > 0;
  useLayoutEffect(() => {
    if (!active || !root) return;
    let frame = 0;
    const animations = new Map<HTMLElement, Animation>();
    const positions = new Map<string, { y: number; anchor: number }>();
    let layoutSignature = "";
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const stopMotion = () => {
      if (reduced?.matches) {
        animations.forEach((animation) => animation.cancel());
        animations.clear();
        layer.current?.querySelectorAll<HTMLElement>(".combat-burst").forEach((element) => {
          element.dataset.static = "true";
        });
      }
    };
    reduced?.addEventListener?.("change", stopMotion);
    const measure = () => {
      const container = layer.current;
      const board = root.current;
      if (!container || !board) return;
      const gap = motionValue("--screen-item-gap") || 12;
      const margin = gap;
      const popScale = motionValue("--feedback-pop-scale") || 2;
      const maxRise = motionValue("--feedback-rise") || 240;
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = window.innerHeight;
      const anchors = new Map(
        Array.from(board.querySelectorAll<HTMLElement>("[data-actor-id]")).map((actor) => [
          actor.dataset.actorId,
          actor.querySelector(".creature-card")?.getBoundingClientRect(),
        ]),
      );
      // Read all intrinsic sizes and portrait bounds before writing overlay geometry.
      const items = Array.from(container.children).map((node) => {
        const element = node as HTMLElement;
        const numbers = element.querySelector<HTMLElement>(".combat-numbers")!;
        const staticMotion = reduced?.matches || element.dataset.static === "true";
        const scale = staticMotion ? 1 : popScale;
        return {
          staticMotion,
          element,
          rect: anchors.get(element.dataset.targetId),
          width: numbers.offsetWidth * scale,
          height: numbers.offsetHeight * scale,
        };
      });
      const signature = items
        .map(({ element, width, height }) => `${element.dataset.burstId}:${width}:${height}`)
        .join("|");
      const layoutChanged = signature !== layoutSignature;
      layoutSignature = signature;
      const ids = new Set(items.map(({ element }) => element.dataset.burstId!));
      for (const id of evicted.current) if (!ids.has(id)) evicted.current.delete(id);
      for (const id of positions.keys()) if (!ids.has(id)) positions.delete(id);
      for (const [element, animation] of animations)
        if (!element.isConnected) {
          animation.cancel();
          animations.delete(element);
        }
      const occupied: { x: number; y: number; width: number; height: number }[] = [];
      const cursors = new Map<string, number>();
      // Place newest actions first; older groups surrender their slot when space runs out.
      for (const item of items.reverse()) {
        const { element, rect } = item;
        if (item.staticMotion) element.dataset.static = "true";
        element.style.setProperty("--feedback-duration", `${element.dataset.lifetime}ms`);
        const id = element.dataset.burstId!;
        const target = element.dataset.targetId!;
        if (
          !rect ||
          rect.width <= 0 ||
          rect.bottom <= 0 ||
          rect.top >= height ||
          rect.right <= 0 ||
          rect.left >= width
        ) {
          element.style.visibility = "hidden";
          continue;
        }
        const x = Math.max(
          margin,
          Math.min(width - margin - item.width, rect.left + rect.width / 2 - item.width / 2),
        );
        const preferred =
          cursors.get(target) === undefined
            ? Math.max(margin, Math.min(height - margin - item.height, rect.top + rect.height / 2 - 48))
            : cursors.get(target)! - gap - item.height;
        const overlaps = (y: number) =>
          occupied.some(
            (other) =>
              x < other.x + other.width + gap &&
              x + item.width + gap > other.x &&
              y < other.y + other.height + gap &&
              y + item.height + gap > other.y,
          );
        const candidates = [
          preferred,
          ...occupied.flatMap((other) => [other.y - gap - item.height, other.y + other.height + gap]),
        ]
          .filter(
            (y) =>
              y >= margin &&
              y + item.height <= height - margin &&
              (cursors.get(target) === undefined || y <= preferred) &&
              !overlaps(y),
          )
          .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
        const y = candidates[0];
        if (y === undefined || evicted.current.has(id)) {
          evicted.current.add(id);
          element.dataset.evicted = "true";
          continue;
        }
        occupied.push({ x, y, width: item.width, height: item.height });
        cursors.set(target, y);
        element.style.left = `${x + item.width / 2}px`;
        element.style.top = `${y}px`;
        element.style.height = `${item.height}px`;
        element.style.setProperty("--feedback-rise", `${Math.min(maxRise, Math.max(0, y - margin))}px`);
        element.style.visibility = "visible";
        const prior = positions.get(id);
        if (
          layoutChanged &&
          prior !== undefined &&
          Math.abs(prior.y - y - (prior.anchor - rect.top)) > 1 &&
          !item.staticMotion &&
          element.animate
        ) {
          animations.get(element)?.cancel();
          const animation = element.animate(
            [{ translate: `0 ${prior.y - y - (prior.anchor - rect.top)}px` }, { translate: "0 0" }],
            {
              duration: motionValue("--feedback-reposition"),
              easing: "ease-out",
            },
          );
          animations.set(element, animation);
          animation.onfinish = () => {
            if (animations.get(element) === animation) animations.delete(element);
          };
        }
        positions.set(id, { y, anchor: rect.top });
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      reduced?.removeEventListener?.("change", stopMotion);
      animations.forEach((animation) => animation.cancel());
    };
  }, [active, root]);
  if (!active) return null;
  const content = (
    <div className="combat-feedback" ref={layer} aria-hidden="true">
      {bursts.map((b) => (
        <div
          className="combat-burst"
          key={b.id}
          data-burst-id={b.id}
          data-target-id={b.targetId}
          data-lifetime={b.lifetime}
        >
          <div className="combat-burst-travel">
            <div
              className="combat-numbers"
              data-columns={b.entries.filter((e) => !isFeedbackNotice(e)).length > 3 ? 2 : 1}
            >
              {b.entries.map((e) => (
                <FeedbackNumber key={e.id} entry={e} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  return typeof document === "undefined" ? content : createPortal(content, document.body);
}

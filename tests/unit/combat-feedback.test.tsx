// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createRef } from "react";
import type { Session, SessionView } from "../../src/application/session";
import type { GameEvent } from "../../src/game/types";
import { useCombatFeedback, CombatFeedback, appendFeedback } from "../../src/ui/combat-feedback";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const hit = (amount: number, damageType: GameEvent["damageType"] = "burn"): GameEvent => ({
  kind: "damage",
  targetId: "enemy-0",
  amount,
  damageType,
  text: "Resolved damage",
});
function source() {
  let listener: Parameters<Session["store"]["subscribe"]>[0] | undefined;
  const unsubscribe = vi.fn(() => {
    listener = undefined;
  });
  const session = {
    store: {
      subscribe(fn: typeof listener) {
        listener = fn;
        return unsubscribe;
      },
    },
  } as unknown as Session;
  let revision = 0;
  return {
    session,
    unsubscribe,
    commit(events: GameEvent[], phase = "battle") {
      const before = { game: { revision, phase } } as SessionView;
      listener?.({ game: { revision: ++revision, phase }, events } as SessionView, before);
    },
  };
}
const action = (actorId: string): GameEvent => ({
  kind: "action",
  actionType: "attack",
  actorId,
  text: "Attack",
});
it("reveals interrupted numbers without accumulated audio, and Pause/teardown revoke pending work", () => {
  vi.useFakeTimers();
  document.documentElement.style.setProperty("--motion-feedback-sequence", "300ms");
  const feed = source(),
    sound = vi.fn(),
    root = createRef<HTMLDivElement>();
  const view = renderHook(({ paused }) => useCombatFeedback(feed.session, root, sound, paused), {
    initialProps: { paused: false },
  });
  act(() => feed.commit([action("enemy-0"), hit(2), action("enemy-1"), hit(3, "freeze")]));
  expect(sound.mock.calls).toEqual([["fire"]]);
  expect(view.result.current.bursts).toHaveLength(1);
  act(() => feed.commit([hit(4, "nature")]));
  expect(view.result.current.bursts.flatMap((b) => b.entries).map((e) => e.amount)).toEqual([2, 3, 4]);
  expect(sound.mock.calls).toEqual([["fire"], ["nature"]]);
  act(() => feed.commit([action("enemy-0"), hit(1), action("enemy-1"), hit(5)]));
  view.rerender({ paused: true });
  expect(view.result.current.bursts).toEqual([]);
  act(() => vi.advanceTimersByTime(2000));
  view.rerender({ paused: false });
  expect(view.result.current.bursts).toEqual([]);
  expect(sound).toHaveBeenCalledTimes(3);
  act(() => feed.commit([action("enemy-0"), hit(1), action("enemy-1"), hit(5)]));
  view.unmount();
  const count = sound.mock.calls.length;
  act(() => vi.advanceTimersByTime(2000));
  expect(sound).toHaveBeenCalledTimes(count);
  expect(vi.getTimerCount()).toBe(0);
  expect(feed.unsubscribe).toHaveBeenCalledTimes(2);
});
it("retains readable numbers on a reduced-motion change and clears them at battle completion", () => {
  vi.useFakeTimers();
  document.documentElement.style.setProperty("--motion-feedback-sequence", "300ms");
  let reduced = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  const feed = source(),
    sound = vi.fn(),
    root = createRef<HTMLDivElement>();
  const view = renderHook(() => useCombatFeedback(feed.session, root, sound));
  act(() => feed.commit([action("enemy-0"), hit(2), action("enemy-1"), hit(3, "freeze")]));
  act(() => {
    reduced = true;
    listeners.forEach((fn) => fn());
  });
  expect(view.result.current.bursts.flatMap((b) => b.entries).map((e) => e.amount)).toEqual([2, 3]);
  act(() => vi.advanceTimersByTime(500));
  expect(sound).toHaveBeenCalledTimes(1);
  expect(view.result.current.bursts).toHaveLength(2);
  act(() => feed.commit([], "victory"));
  expect(view.result.current.bursts).toEqual([]);
  view.unmount();
  expect(listeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps icon-only notices and Critical identity while overlay tracking is disposed on unmount", () => {
  let scheduled: FrameRequestCallback | undefined;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      scheduled = callback;
      return 7;
    }),
  );
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const root = createRef<HTMLElement>();
  const bursts = appendFeedback(
    [],
    [
      hit(8),
      { ...hit(3), critical: true },
      { kind: "status", targetId: "enemy-0", status: "freeze", outcome: "immune", text: "Immune to Freeze" },
    ],
    1,
    0,
  );
  const view = render(
    <main ref={root}>
      <div data-actor-id="enemy-0">
        <div className="creature-card" />
      </div>
      <CombatFeedback root={root} bursts={bursts} />
    </main>,
  );
  expect(view.container.querySelector(".combat-feedback")).toBeNull();
  const overlay = document.querySelector(".combat-feedback")!;
  expect(overlay.getAttribute("aria-hidden")).toBe("true");
  expect(overlay.textContent).not.toContain("Immune");
  expect(overlay.querySelector(".combat-notice")?.getAttribute("aria-label")).toBe("Immune to Freeze");
  expect(overlay.querySelector('[data-critical="true"]')?.getAttribute("aria-label")).toContain(
    "11 burn. Includes a Critical",
  );
  expect(scheduled).toBeTypeOf("function");
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(7);
  expect(document.querySelector(".combat-feedback")).toBeNull();
});

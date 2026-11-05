// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { createSession } from "../../../src/application/session";
import { createCombatPlayback } from "../../../src/ui/battle/combat-playback";
import { useAutoplay } from "../../../src/ui/battle/autoplay";
import { createCombatImpacts } from "../../../src/ui/battle/combat-impact";
import { dispatch, previewCard } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { run } from "../../support/game";
import { setHand } from "../../support/cards";
import type { BattleState, BattleFrame } from "../../../src/game/types";
import type { Session, SessionView } from "../../../src/application/session";
import type { GameEvent, DamageEvent } from "../../../src/game/types";
import { useCombatFeedback, CombatFeedback, appendFeedback } from "../../../src/ui/battle/combat-feedback";
import { feedbackFrames } from "../../../src/ui/battle/combat-feedback-model";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const hit = (amount: number, damageType: DamageEvent["damageType"] = "burn"): DamageEvent => ({
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
it("keeps complete action frames in order while skipping frames without visible feedback", () => {
  const ignored: GameEvent = { kind: "action", actionType: "swap", actorId: "ally-0", text: "Swap" };
  const notice: GameEvent = { kind: "status", amount: 1, text: "Untargeted notice" };
  const first = action("enemy-0");
  const second = action("enemy-1");
  const damage = hit(3);
  expect(feedbackFrames([notice, ignored, notice, first, notice, damage, second])).toEqual([
    [first, notice, damage],
    [second],
  ]);
});
function timing() {
  vi.useFakeTimers();
  for (const [name, value] of [
    ["attack", 950],
    ["support", 520],
    ["feedback-sequence", 300],
  ] as const)
    document.documentElement.style.setProperty(`--motion-${name}`, `${value}ms`);
}
function checkpoint() {
  const state = structuredClone(run()) as BattleState;
  setHand(state, ["emberback-attack", "prismram-attack"]);
  return state;
}
it("captures detached accepted checkpoints without changing combat, RNG, previews or saved data", () => {
  const state = checkpoint();
  state.battle.mana = 1;
  const command = { type: "play", cardId: state.battle.hand[0]!, targetId: "enemy-0" } as const;
  const ordinary = dispatch(state, command);
  const recorded = dispatch(state, command, false, true);
  expect(recorded.state).toEqual(ordinary.state);
  expect(recorded.events).toEqual(ordinary.events);
  expect(encodeSave(recorded.state)).toBe(encodeSave(ordinary.state));
  if (!recorded.accepted) throw new Error(recorded.reason);
  const frames = recorded.battleFrames!;
  const actions = frames.filter((frame) => frame.events.some((event) => event.kind === "action"));
  expect(actions.length).toBeGreaterThan(3);
  expect(actions[0]!.state.battle.turn).toBe(state.battle.turn);
  expect(actions[1]!.state.battle.hand).toEqual([]);
  expect(frames.at(-1)!.state.battle.turn).toBe(state.battle.turn + 1);
  expect(frames.at(-1)!.state.battle.hand.length).toBeGreaterThan(0);
  for (const frame of frames) {
    expect(Object.isFrozen(frame.state)).toBe(true);
    expect(Object.isFrozen(frame.state.team)).toBe(true);
  }
  expect(previewCard(state, command.cardId, command.targetId)).not.toHaveProperty("battleFrames");
  const rejected = dispatch(state, { type: "play", cardId: "missing" }, false, true);
  expect(rejected.state).toBe(state);
  expect(rejected.state.rng).toBe(state.rng);
  expect(rejected).not.toHaveProperty("battleFrames");
});
it("retains committed victory recovery alongside the final hit before clearing combat", () => {
  const state = checkpoint();
  state.talents = ["health.vitality"];
  state.team[0]!.health -= 6;
  state.battle.enemies.forEach((enemy, index) => {
    enemy.health = index === 0 ? 1 : 0;
    enemy.block = 0;
  });
  const command = {
    type: "play",
    cardId: state.battle.hand[0]!,
    targetId: "enemy-0",
    autoEndTurn: false,
  } as const;
  const result = dispatch(state, command, false, true);
  expect(result.state).toEqual(dispatch(state, command).state);
  if (!result.accepted) throw new Error(result.reason);
  const frames = result.battleFrames!;
  const numeric = (events: GameEvent[]) =>
    events.filter((event) => ["damage", "heal", "block"].includes(event.kind));
  expect(numeric(frames.flatMap((frame) => frame.events))).toEqual(numeric(result.events));
  expect(
    frames.some((frame) => frame.events.some((event) => event.kind === "heal" && event.amount === 4)),
  ).toBe(true);
  expect(frames.at(-1)!.state.team[0]!.health).toBe(result.state.team[0]!.health);
});
it("presents wind-up, committed impact, recovery and the next action in order", () => {
  timing();
  const state = checkpoint();
  const scene = vi.fn(),
    start = vi.fn(),
    impact = vi.fn(),
    numbers = vi.fn(),
    complete = vi.fn();
  const playback = createCombatPlayback({ scene, action: start, impact, numbers, complete }, () => ({
    attack: 950,
    support: 520,
    feedback: 300,
    lifetime: 1100,
  }));
  const frames: BattleFrame[] = [
    { state, events: [action("ally-1"), hit(2)] },
    { state, events: [action("enemy-0"), hit(3)] },
  ];
  playback.play(frames, state, "1", false, false);
  expect(playback.isBusy()).toBe(true);
  expect(start).toHaveBeenCalledTimes(1);
  expect(impact).not.toHaveBeenCalled();
  vi.advanceTimersByTime(227);
  expect(impact).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(impact).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(721);
  expect(start).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(start).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(228);
  expect(impact).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(722);
  expect(playback.isBusy()).toBe(false);
  expect(scene).toHaveBeenLastCalledWith(null);
  expect(vi.getTimerCount()).toBe(0);
});
it("paces Auto-play against presentation while direct commands remain immediately available", async () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const state = checkpoint();
  setHand(state, ["emberback-attack"]);
  state.battle.mana = 1;
  const session = createSession({
    desktop: false,
    saves: {
      readCandidates: async () => [{ source: "primary", data: encodeSave(state) }],
      write: async () => {},
    },
  });
  await session.load();
  timing();
  const sound = vi.fn(),
    root = createRef<HTMLDivElement>();
  const hook = renderHook(() => {
    const feedback = useCombatFeedback(session, root, sound);
    return { feedback, autoplay: useAutoplay(session, feedback.presenting, true, feedback.isPresenting) };
  });
  act(() => hook.result.current.autoplay[1](true));
  act(() => vi.advanceTimersByTime(700));
  const revision = session.store.getState().game.revision;
  expect(revision).toBe(state.revision + 1);
  act(() => vi.advanceTimersByTime(2100));
  expect(session.store.getState().game.revision).toBe(revision);
  expect(hook.result.current.feedback.presenting).toBe(true);
  act(() => {
    expect(session.command({ type: "endTurn" })).toBe(true);
  });
  expect(session.store.getState().game.revision).toBe(revision + 1);
  hook.unmount();
  await session.dispose();
});
it("manual takeover reveals pending numbers without replaying old actions or sounds", () => {
  timing();
  const feed = source(),
    sound = vi.fn(),
    root = createRef<HTMLDivElement>();
  const view = renderHook(() => useCombatFeedback(feed.session, root, sound));
  act(() => feed.commit([action("enemy-0"), hit(2), action("enemy-1"), hit(3, "freeze")]));
  expect(sound).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(228));
  expect(sound.mock.calls).toEqual([["fire"]]);
  act(() => feed.commit([hit(4, "nature")]));
  expect(view.result.current.bursts.flatMap((b) => b.entries).map((e) => e.amount)).toEqual([2, 3, 4]);
  expect(sound.mock.calls).toEqual([["fire"], ["nature"]]);
  act(() => vi.advanceTimersByTime(2000));
  expect(sound).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps an unrelated creature's attack alive during a second committed action", () => {
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = [];
  const animate = vi.fn(
    (_frames: Keyframe[] | PropertyIndexedKeyframes | null, _options?: number | KeyframeAnimationOptions) => {
      const animation = { cancel: vi.fn(), onfinish: null };
      animations.push(animation);
      return animation;
    },
  );
  const board = document.createElement("div");
  board.innerHTML =
    '<div data-actor-id="ally-1"><div class="combatant-motion"></div></div><div data-actor-id="ally-2"><div class="combatant-motion"></div></div>';
  for (const node of board.querySelectorAll<HTMLElement>(".combatant-motion"))
    node.animate = animate as unknown as HTMLElement["animate"];
  const impacts = createCombatImpacts(() => board);
  impacts.start([action("ally-1")]);
  impacts.start([action("ally-2")]);
  expect(animations[0]!.cancel).not.toHaveBeenCalled();
  expect(animate.mock.calls[0]![1]).toMatchObject({ easing: "linear" });
  impacts.dispose();
  expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
});
it("publishes and saves a final blow immediately while its battle feedback finishes", async () => {
  const state = checkpoint();
  setHand(state, ["emberback-attack"]);
  state.battle.enemies.forEach((enemy, index) => {
    enemy.health = index === 0 ? 1 : 0;
    enemy.block = 0;
  });
  const writes: string[] = [];
  let release: () => void = () => {};
  const pendingSave = new Promise<void>((resolve) => {
    release = resolve;
  });
  const session = createSession({
    desktop: false,
    saves: {
      readCandidates: async () => [{ source: "primary", data: encodeSave(state) }],
      write: async (data) => {
        writes.push(data);
        await pendingSave;
      },
    },
  });
  await session.load();
  timing();
  const sound = vi.fn(),
    root = createRef<HTMLDivElement>();
  const hook = renderHook(() => useCombatFeedback(session, root, sound));
  act(() => {
    expect(
      session.command({
        type: "play",
        cardId: state.battle.hand[0]!,
        targetId: "enemy-0",
        autoEndTurn: false,
      }),
    ).toBe(true);
  });
  expect(session.store.getState().game.phase).toBe("recruit");
  expect(hook.result.current.scene?.battle.enemies[0]!.health).toBe(1);
  expect(hook.result.current.bursts).toEqual([]);
  await act(async () => {
    await Promise.resolve();
  });
  expect(decodeSave(writes[0]!).phase).toBe("recruit");
  act(() => vi.advanceTimersByTime(228));
  expect(hook.result.current.scene?.battle.enemies[0]!.health).toBe(0);
  expect(
    hook.result.current.bursts.some((burst) => burst.entries.some((entry) => entry.kind === "damage")),
  ).toBe(true);
  expect(sound).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(1100));
  expect(hook.result.current.scene).toBeNull();
  release();
  await session.flush();
  hook.unmount();
  await session.dispose();
});
it("Pause and teardown revoke pending presentation without replay on resume", () => {
  timing();
  const feed = source(),
    sound = vi.fn(),
    root = createRef<HTMLDivElement>();
  const hook = renderHook(({ paused }) => useCombatFeedback(feed.session, root, sound, paused), {
    initialProps: { paused: false },
  });
  act(() => feed.commit([action("enemy-0"), hit(2), action("enemy-1"), hit(3)]));
  hook.rerender({ paused: true });
  expect(hook.result.current.scene).toBeNull();
  expect(hook.result.current.bursts).toEqual([]);
  act(() => vi.advanceTimersByTime(2000));
  hook.rerender({ paused: false });
  expect(sound).not.toHaveBeenCalled();
  expect(hook.result.current.scene).toBeNull();
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("reduced motion settles pending facts without replay when motion returns", () => {
  timing();
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
  const hook = renderHook(() => useCombatFeedback(feed.session, root, sound));
  act(() => feed.commit([action("enemy-0"), hit(2), action("enemy-1"), hit(3)]));
  act(() => {
    reduced = true;
    listeners.forEach((fn) => fn());
  });
  expect(hook.result.current.scene).toBeNull();
  expect(
    hook.result.current.bursts
      .flatMap((burst) => burst.entries)
      .reduce((sum, entry) => sum + (entry.amount ?? 0), 0),
  ).toBe(5);
  act(() => {
    reduced = false;
    listeners.forEach((fn) => fn());
    vi.advanceTimersByTime(2000);
  });
  expect(sound).not.toHaveBeenCalled();
  hook.unmount();
  expect(listeners.size).toBe(0);
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

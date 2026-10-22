// @vitest-environment jsdom
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { createSession } from "../../../src/application/session";
import { useAutoplay } from "../../../src/ui/battle/autoplay";
import { encodeSave } from "../../../src/game/save";
import checkpoint from "../application/fixtures/cadenza-reedstag.json";
import { run } from "../../support/game";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("revokes a queued action synchronously on blur before React runs effect cleanup", async () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const session = createSession({
    desktop: false,
    steam: { available: false },
    saves: {
      readCandidates: async () => [{ source: "primary", data: encodeSave(run()) }],
      write: async () => {},
    },
  });
  await session.load();
  vi.useFakeTimers();
  const hook = renderHook(() => useAutoplay(session, false, false));
  act(() => hook.result.current[1](true));
  const revision = session.store.getState().game.revision;
  act(() => {
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(700);
  });
  expect(session.store.getState().game.revision).toBe(revision);
  act(() => window.dispatchEvent(new Event("focus")));
  await act(async () => {
    vi.advanceTimersByTime(700);
    await session.flush();
  });
  expect(session.store.getState().game.revision).toBe(revision + 1);
  await act(async () => {
    await session.dispose();
  });
});
it("pauses overlays and blur, revokes on disposal and keeps playing through a save failure", async () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  let fail = false;
  const session = createSession({
    desktop: false,
    steam: { available: false },
    saves: {
      readCandidates: async () => [{ source: "primary", data: encodeSave(run()) }],
      write: async () => {
        if (fail) throw new Error("disk full");
      },
    },
  });
  await session.load();
  vi.useFakeTimers();
  const hook = renderHook(({ paused }) => useAutoplay(session, paused, false), {
    initialProps: { paused: false },
  });
  const revision = session.store.getState().game.revision;
  act(() => hook.result.current[1](true));
  act(() => {
    vi.advanceTimersByTime(699);
  });
  expect(session.store.getState().game.revision).toBe(revision);
  hook.rerender({ paused: true });
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(session.store.getState().game.revision).toBe(revision);
  hook.rerender({ paused: false });
  act(() => window.dispatchEvent(new Event("blur")));
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(session.store.getState().game.revision).toBe(revision);
  act(() => window.dispatchEvent(new Event("focus")));
  await act(async () => {
    vi.advanceTimersByTime(700);
    await session.flush();
  });
  expect(session.store.getState().game.revision).toBe(revision + 1);
  fail = true;
  await act(async () => {
    vi.advanceTimersByTime(700);
    await session.flush();
  });
  expect(hook.result.current[0]).toBe(true);
  fail = false;
  await act(async () => {
    session.retrySave();
    await session.flush();
  });
  const recovered = session.store.getState().game.revision;
  await act(async () => {
    vi.advanceTimersByTime(700);
    await session.flush();
  });
  expect(session.store.getState().game.revision).toBe(recovered + 1);
  const stopped = session.store.getState().game.revision;
  await act(async () => {
    await session.dispose();
  });
  act(() => {
    vi.advanceTimersByTime(1400);
  });
  expect(session.store.getState().game.revision).toBe(stopped);
});

it("manual takeover revokes the queued move before React runs effect cleanup", async () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const session = createSession({
    desktop: false,
    steam: { available: false },
    saves: {
      readCandidates: async () => [{ source: "primary", data: encodeSave(run()) }],
      write: async () => {},
    },
  });
  await session.load();
  vi.useFakeTimers();
  const hook = renderHook(() => useAutoplay(session, false, false));
  act(() => hook.result.current[1](true));
  const revision = session.store.getState().game.revision;
  act(() => {
    hook.result.current[1](false);
    vi.advanceTimersByTime(700);
  });
  expect(session.store.getState().game.revision).toBe(revision);
  expect(hook.result.current[0]).toBe(false);
  await act(async () => {
    await session.dispose();
  });
});

it("Auto-play escapes the recorded self-replacing draw loop", async () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const session = createSession({
    desktop: false,
    steam: { available: false },
    saves: {
      readCandidates: async () => [{ source: "primary", data: JSON.stringify(checkpoint) }],
      write: async () => {},
    },
  });
  await session.load();
  vi.useFakeTimers();
  const turn = session.store.getState().game.battle!.turn;
  const hook = renderHook(() => useAutoplay(session, false, false));
  act(() => hook.result.current[1](true));
  for (let count = 0; count < 32 && session.store.getState().game.battle?.turn === turn; count++) {
    await act(async () => {
      vi.advanceTimersByTime(700);
      await session.flush();
    });
  }
  expect(session.store.getState().game.battle!.turn).toBeGreaterThan(turn);
  await act(async () => {
    await session.dispose();
  });
});

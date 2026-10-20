// @vitest-environment jsdom
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { createSession } from "../../src/application/session";
import { useAutoplay } from "../../src/ui/autoplay";
import { encodeSave } from "../../src/game/save";
import { run } from "./helpers";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("pauses overlays and blur, revokes on disposal and does not restart after a save failure", async () => {
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
  expect(hook.result.current[0]).toBe(false);
  fail = false;
  await act(async () => {
    session.retrySave();
    await session.flush();
  });
  const stopped = session.store.getState().game.revision;
  act(() => {
    vi.advanceTimersByTime(1400);
  });
  expect(session.store.getState().game.revision).toBe(stopped);
  act(() => hook.result.current[1](true));
  await act(async () => {
    await session.dispose();
  });
  act(() => {
    vi.advanceTimersByTime(1400);
  });
  expect(session.store.getState().game.revision).toBe(stopped);
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { GameErrorBoundary } from "../../../src/ui/shared/diagnostics";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { DisplaySettings } from "../../../src/ui/settings/platform-settings";
import { createSession } from "../../../src/application/session";
import { App } from "../../../src/ui/App";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { decodeSave } from "../../../src/game/save";
import { screenTestEnvironment } from "../../support/ui";

screenTestEnvironment();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("remounts presentation after a transient render failure without a player error", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const diagnostics = createDiagnostics();
  let broken = true;
  function Scene() {
    if (broken) throw new Error("transient");
    return <main>Fauna</main>;
  }
  render(
    <GameErrorBoundary diagnostics={diagnostics}>
      <Scene />
    </GameErrorBoundary>,
  );
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText(/could not|retry|unavailable/i)).toBeNull();
  broken = false;
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByRole("main").textContent).toBe("Fauna");
  expect(diagnostics.snapshot()[0]!.source).toBe("render");
});
it("retains usable display controls after a failed preference read without an alert", async () => {
  const session = createSession({
    desktop: true,
    saves: { readCandidates: async () => [], write: async () => {} },
    display: {
      read: async () => {
        throw new Error("read failed");
      },
      set: async (mode) => ({ mode }),
      subscribe: () => () => {},
    },
  });
  await act(async () => {
    render(<DisplaySettings session={session} />);
  });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("combobox", { name: "Display mode" }).textContent).toBe("Windowed");
  expect(screen.getByRole("combobox", { name: "Display mode" }).hasAttribute("disabled")).toBe(false);
  await session.dispose();
});

it("keeps repeated rendering failures silent, keeps retrying and resets after healthy rendering", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const diagnostics = createDiagnostics();
  let broken = true;
  function Scene() {
    if (broken) throw new Error("repeated failure");
    return <main>Recovered game</main>;
  }
  const view = () => (
    <GameErrorBoundary diagnostics={diagnostics}>
      <Scene />
    </GameErrorBoundary>
  );
  const { rerender } = render(view());
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.queryByText(/could not display/)).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText(/could not|retry|failed|error/i)).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole("status").textContent).toContain("Loading");
  expect(diagnostics.snapshot()[0]!.count).toBe(3);
  broken = false;
  await act(() => vi.advanceTimersByTimeAsync(4000));
  expect(screen.getByRole("main").textContent).toBe("Recovered game");
  await act(() => vi.advanceTimersByTimeAsync(30000));
  broken = true;
  rerender(view());
  expect(screen.queryByText(/could not display/)).toBeNull();
});

it("keeps play available through failed writes and automatically persists the latest outcome", async () => {
  vi.useFakeTimers();
  let failing = true;
  const platform = createBrowserPlatform(localStorage);
  const write = platform.saves.write;
  platform.saves.write = async (...args) => {
    if (failing) throw new Error("private disk failure");
    await write(...args);
  };
  const session = createSession(platform, 7);
  try {
    await session.load();
    render(<App session={session} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await session.flush();
    });
    const first = session.store.getState().game;
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /^Recruit / })[0]!);
      await session.flush();
    });
    const latest = session.store.getState().game;
    expect(latest.revision).toBe(first.revision + 1);
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    expect(session.store.getState().saveStatus).toBe("error");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    expect(screen.queryByText(/couldn.t save|saving|private disk failure/i)).toBeNull();
    failing = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await session.flush();
    });
    expect(decodeSave(localStorage.getItem("fauna.save.v1")!)).toEqual(latest);
    expect(session.store.getState().game).toBe(latest);
    expect(session.store.getState().saveStatus).toBe("saved");
    expect(session.diagnostics.snapshot().some((entry) => entry.source === "save-write")).toBe(true);
  } finally {
    await session.dispose();
  }
});

it("continues play after storage reads fail and recovers automatically when access returns", async () => {
  vi.useFakeTimers();
  const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  const session = createSession(createBrowserPlatform());
  try {
    await session.load();
    render(<App session={session} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await session.flush();
    });
    expect(session.store.getState().loadFailed).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Recruit / }).length).toBeGreaterThan(0);
    const game = session.store.getState().game;
    Object.defineProperty(window, "localStorage", original);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await session.flush();
    });
    expect(decodeSave(localStorage.getItem("fauna.save.v1")!)).toEqual(game);
    expect(session.store.getState().loadFailed).toBe(false);
  } finally {
    Object.defineProperty(window, "localStorage", original);
    await session.dispose();
  }
});

it("accepts play while a write is pending and drains committed outcomes in order", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saved: string[] = [];
  const session = createSession(
    {
      desktop: false,
      saves: {
        readCandidates: async () => [],
        write: async (data) => {
          await pending;
          saved.push(data);
        },
      },
    },
    7,
  );
  try {
    await session.load();
    render(<App session={session} />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    const first = session.store.getState().game;
    expect(session.store.getState().saveStatus).toBe("saving");
    fireEvent.click(screen.getAllByRole("button", { name: /^Recruit / })[0]!);
    const latest = session.store.getState().game;
    expect(latest.revision).toBe(first.revision + 1);
    expect(screen.queryByText(/saving|couldn.t save/i)).toBeNull();
    await act(async () => {
      release();
      await session.flush();
    });
    expect(saved.map((data) => decodeSave(data).revision)).toEqual([first.revision, latest.revision]);
    expect(decodeSave(saved.at(-1)!)).toEqual(latest);
  } finally {
    release();
    await session.dispose();
  }
});

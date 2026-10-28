// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { GameErrorBoundary } from "../../../src/ui/shared/diagnostics";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { DisplaySettings } from "../../../src/ui/settings/platform-settings";
import { createSession } from "../../../src/application/session";

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
  expect(screen.getByRole("radio", { name: "Windowed" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: "Fullscreen" }).hasAttribute("disabled")).toBe(false);
  await session.dispose();
});

it("explains repeated rendering failure, keeps retrying and resets after healthy rendering", async () => {
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
  expect(screen.getByRole("status").textContent).toContain("could not display this screen");
  broken = false;
  await act(() => vi.advanceTimersByTimeAsync(4000));
  expect(screen.getByRole("main").textContent).toBe("Recovered game");
  await act(() => vi.advanceTimersByTimeAsync(30000));
  broken = true;
  rerender(view());
  expect(screen.queryByText(/could not display/)).toBeNull();
});

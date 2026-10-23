// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { moveFocus } from "../../../src/ui/shared/navigation/input";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("applies slider and switch changes live, persists preferences, and preserves gameplay", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  const user = userEvent.setup();
  const view = render(<App session={session} />);
  const game = session.store.getState().game;
  try {
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByRole("slider", { name: "Master volume" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "75%" }));
    expect(document.documentElement.style.getPropertyValue("--tooltip-scale")).toBe("1");
    await user.click(screen.getByRole("radio", { name: "Tooltip 125%" }));
    expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("0.75");
    expect(document.documentElement.style.getPropertyValue("--tooltip-scale")).toBe("1.25");
    await user.click(screen.getByRole("tab", { name: "Battle" }));
    expect(screen.queryByRole("radio", { name: "75%" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Auto-end turn" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("switch", { name: "Auto-end turn" }));
    await user.click(screen.getByRole("tab", { name: "Sound" }));
    for (const label of ["Master volume", "Music volume", "Sound effects volume"])
      expect(screen.getByRole("slider", { name: label }).getAttribute("aria-valuenow")).toBe("50");
    const master = screen.getByRole("slider", { name: "Master volume" });
    master.focus();
    await user.keyboard("{ArrowLeft}");
    expect(master.getAttribute("aria-valuenow")).toBe("40");
    expect(master.getAttribute("aria-valuetext")).toBe("40%");
    // Controller/WASD navigation reaches the same Radix behavior.
    act(() => moveFocus("right"));
    expect(master.getAttribute("aria-valuenow")).toBe("50");
    await user.keyboard("{End}{ArrowRight}");
    expect(master.getAttribute("aria-valuenow")).toBe("100");
    await user.keyboard("{Home}{ArrowLeft}");
    expect(master.getAttribute("aria-valuenow")).toBe("0");
    await user.click(screen.getByRole("switch", { name: "Sound" }));
    await user.click(screen.getByRole("switch", { name: "Mute in background" }));
    expect(screen.queryByRole("tab", { name: "Diagnostics" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy diagnostics" })).toBeNull();
    expect(session.store.getState().game).toBe(game);
    view.unmount();
    render(<App session={session} />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("radio", { name: "75%" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Tooltip 125%" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Battle" }));
    expect(screen.getByRole("switch", { name: "Auto-end turn" }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("tab", { name: "Sound" }));
    expect(screen.getByRole("slider", { name: "Master volume" }).getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByRole("switch", { name: "Sound" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("switch", { name: "Mute in background" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Settings" })),
    );
  } finally {
    await session.dispose();
  }
});

it("normalizes and independently persists background controls without changing gameplay", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  localStorage.setItem("fauna.background-glow", "malformed");
  localStorage.setItem("fauna.background-particles", "101");
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  const user = userEvent.setup();
  const view = render(<App session={session} />);
  const game = session.store.getState().game;
  try {
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const glow = screen.getByRole("slider", { name: "Background Glow" });
    const particles = screen.getByRole("slider", { name: "Background Particles" });
    expect(glow.getAttribute("aria-valuenow")).toBe("100");
    expect(particles.getAttribute("aria-valuenow")).toBe("100");
    act(() => glow.focus());
    await user.keyboard("{Home}");
    act(() => moveFocus("right"));
    expect(glow.getAttribute("aria-valuenow")).toBe("1");
    expect(particles.getAttribute("aria-valuenow")).toBe("100");
    act(() => particles.focus());
    await user.keyboard("{Home}");
    expect(particles.getAttribute("aria-valuenow")).toBe("0");
    expect(glow.getAttribute("aria-valuenow")).toBe("1");
    expect(localStorage.getItem("fauna.background-glow")).toBe("1");
    expect(localStorage.getItem("fauna.background-particles")).toBe("0");
    expect(session.store.getState().game).toBe(game);
    view.unmount();
    render(<App session={session} />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("slider", { name: "Background Glow" }).getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByRole("slider", { name: "Background Particles" }).getAttribute("aria-valuenow")).toBe(
      "0",
    );
    expect(session.store.getState().game).toBe(game);
  } finally {
    await session.dispose();
  }
});

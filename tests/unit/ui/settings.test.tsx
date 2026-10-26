import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { moveFocus } from "../../../src/ui/shared/navigation/input";

import { useDevicePreferences } from "../../../src/ui/settings/preferences";

screenTestEnvironment();

it("retains independent changes batched through the shared preference owner", () => {
  const hook = renderHook(useDevicePreferences);
  act(() => {
    hook.result.current[1]({ audio: { master: 30 }, scale: 1.25 });
    hook.result.current[1]({ audio: { music: 80 }, glow: 0, controller: "nintendo" });
    hook.result.current[1]({ tooltipScale: 0.75, autoEndTurn: false });
  });
  expect(hook.result.current[0]).toEqual({
    audio: { enabled: true, master: 30, music: 80, effects: 50, muteInBackground: true },
    glow: 0,
    particles: 100,
    scale: 1.25,
    tooltipScale: 0.75,
    controller: "nintendo",
    autoEndTurn: false,
  });
  const audio = hook.result.current[0].audio;
  act(() => hook.result.current[1]({ particles: 100 }));
  expect(hook.result.current[0].audio).toBe(audio);
  hook.unmount();
  const restored = renderHook(useDevicePreferences);
  expect(restored.result.current[0]).toEqual({
    audio: JSON.parse(localStorage.getItem("fauna.audio.v1")!),
    glow: 0,
    particles: 100,
    scale: 1.25,
    tooltipScale: 0.75,
    controller: "nintendo",
    autoEndTurn: false,
  });
});

it("keeps preferences usable when optional storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Unavailable");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Full");
  });
  const hook = renderHook(useDevicePreferences);
  expect(hook.result.current[0].audio.master).toBe(50);
  act(() => hook.result.current[1]({ audio: { master: 150, music: Number.NaN }, glow: -4 }));
  expect(hook.result.current[0].audio).toMatchObject({ master: 100, music: 50 });
  expect(hook.result.current[0].glow).toBe(0);
});

it("applies independent preferences live, normalizes malformed storage and persists without changing gameplay", async () => {
  localStorage.setItem("fauna.background-glow", "malformed");
  localStorage.setItem("fauna.background-particles", "101");
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  // Layout and pointer hit testing run in the browser; this DOM suite checks state and persistence.
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const view = render(<App session={session} />);
  const game = session.store.getState().game;
  try {
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByRole("slider", { name: "Master volume" })).toBeNull();
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
    await user.click(screen.getByRole("radio", { name: "75%" }));
    expect(document.documentElement.style.getPropertyValue("--tooltip-scale")).toBe("1");
    await user.click(screen.getByRole("radio", { name: "Tooltip 125%" }));
    expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("0.75");
    expect(document.documentElement.style.getPropertyValue("--tooltip-scale")).toBe("1.25");
    await user.click(screen.getByRole("tab", { name: "Battle" }));
    expect(screen.queryByRole("radio", { name: "75%" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Auto-end turn" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("switch", { name: "Auto-end turn" }));
    await user.click(screen.getByRole("radio", { name: "PlayStation" }));
    expect(localStorage.getItem("fauna.controller-prompts")).toBe("playstation");
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
    expect(screen.getByRole("slider", { name: "Background Glow" }).getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByRole("slider", { name: "Background Particles" }).getAttribute("aria-valuenow")).toBe(
      "0",
    );
    expect(session.store.getState().game).toBe(game);
    expect(screen.getByRole("radio", { name: "75%" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Tooltip 125%" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Battle" }));
    expect(screen.getByRole("radio", { name: "PlayStation" }).getAttribute("aria-checked")).toBe("true");
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

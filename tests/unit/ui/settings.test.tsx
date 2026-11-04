// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { screenTestEnvironment } from "../../support/ui";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { useDevicePreferences } from "../../../src/ui/settings/preferences";
screenTestEnvironment({ visible: true });
it("retains independent changes and normalizes sizing to the Alchemy ranges", () => {
  const hook = renderHook(useDevicePreferences);
  act(() => {
    hook.result.current[1]({ audio: { master: 30 }, scale: 1.25 });
    hook.result.current[1]({ audio: { music: 80 }, glow: 0, rememberAutoplay: true });
    hook.result.current[1]({ tooltipScale: 0.75, autoEndTurn: false });
  });
  expect(hook.result.current[0]).toMatchObject({
    audio: { master: 30, music: 80 },
    scale: 1.2,
    tooltipScale: 0.9,
    glow: 0,
    rememberAutoplay: true,
    autoEndTurn: false,
  });
  const saved = hook.result.current[0];
  const audio = saved.audio;
  act(() => hook.result.current[1]({ particles: 100 }));
  expect(hook.result.current[0].audio).toBe(audio);
  hook.unmount();
  const restored = renderHook(useDevicePreferences);
  expect(restored.result.current[0]).toEqual(saved);
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
it("applies and resets device settings without changing progression", async () => {
  localStorage.setItem("fauna.background-glow", "malformed");
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<App session={session} />);
  const game = session.store.getState().game;
  await user.click(screen.getByRole("button", { name: "Options" }));
  const size = screen.getByRole("slider", { name: "Game Size" });
  act(() => size.focus());
  await user.keyboard("{Home}{ArrowRight}");
  expect(size.getAttribute("aria-valuenow")).toBe("85");
  expect(localStorage.getItem("fauna.game-scale")).toBe("0.85");
  await user.click(screen.getByRole("tab", { name: "Gameplay" }));
  await user.click(screen.getByRole("switch", { name: "Remember Auto-Battle Preference" }));
  expect(screen.queryByRole("slider", { name: "Game Size" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "PlayStation" })).toBeNull();
  await user.click(screen.getByRole("tab", { name: "Sound" }));
  const master = screen.getByRole("slider", { name: "Master volume" });
  act(() => master.focus());
  await user.keyboard("{Home}{ArrowRight}");
  expect(master.getAttribute("aria-valuenow")).toBe("1");
  expect(screen.queryByRole("switch", { name: "Sound", exact: true })).toBeNull();
  await user.click(screen.getByRole("tab", { name: "Other" }));
  await user.click(screen.getByRole("button", { name: "Reset to Default" }));
  expect(session.store.getState().game).toBe(game);
  expect(localStorage.getItem("fauna.game-scale")).toBe("1");
  expect(localStorage.getItem("fauna.remember-autoplay")).toBe("false");
  await user.click(screen.getByRole("button", { name: "Clear Save Data" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(session.store.getState().game).toBe(game);
  await session.dispose();
});

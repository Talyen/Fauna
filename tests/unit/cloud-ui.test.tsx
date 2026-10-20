// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import type { Platform } from "../../src/platform/ports";
import type { InputAction } from "../../src/ui/input";
import { App } from "../../src/ui/App";
const hook = vi.hoisted(() => ({ send: undefined as ((action: InputAction) => void) | undefined }));
vi.mock("../../src/ui/input", async (original) => ({
  ...(await original<typeof import("../../src/ui/input")>()),
  connectInput: (handler: (action: InputAction) => void) => {
    hook.send = handler;
    return () => {
      hook.send = undefined;
    };
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
it("controller confirm can choose offline continuation while cloud blocks gameplay commands", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const platform: Platform = createBrowserPlatform(localStorage);
  platform.cloud = {
    identity: async () => ({
      available: true,
      device: "a".repeat(32),
      profile: "b".repeat(32),
      importAvailable: false,
    }),
    readLocal: async () => null,
    writeLocal: async () => {},
    preserve: async () => {},
    importStandalone: async () => [],
    list: async () => {
      throw new Error("offline");
    },
    read: async () => null,
    write: async () => {},
  };
  const session = createSession(platform);
  try {
    await session.load();
    render(<App session={session} />);
    const offline = screen.getByRole("button", { name: "Play offline" });
    act(() => offline.focus());
    act(() => hook.send!("confirm"));
    expect(session.store.getState().cloud.blocking).toBe(false);
    expect(screen.getByRole("button", { name: "New journey" })).toBeTruthy();
    expect(session.store.getState().game.revision).toBe(0);
  } finally {
    cleanup();
    await session.dispose();
  }
});

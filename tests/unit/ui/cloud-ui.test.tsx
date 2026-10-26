// @vitest-environment jsdom
import { it, expect } from "vitest";
import { screenTestEnvironment } from "../../support/ui";
import { render, screen, cleanup } from "@testing-library/react";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import type { Platform } from "../../../src/platform/ports";
import { App } from "../../../src/ui/App";
screenTestEnvironment({ visible: true });
it("cloud failure silently continues at the main menu without recovery controls", async () => {
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
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /offline|retry|save/i })).toBeNull();
    expect(session.store.getState().cloud.blocking).toBe(false);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(session.store.getState().game.revision).toBe(0);
  } finally {
    cleanup();
    await session.dispose();
  }
});

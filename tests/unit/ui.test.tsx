// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/ui/App";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { gamepadActions } from "../../src/ui/input";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("player interface", () => {
  it("drafts through accessible buttons and commits the battle before feedback", async () => {
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    const enter = screen.getByRole("button", { name: "Enter the wilds" });
    expect((enter as HTMLButtonElement).disabled).toBe(true);
    for (const name of ["Mossback", "Emberfox", "Stormfin"])
      await user.click(screen.getByRole("button", { name: `Choose ${name}` }));
    await user.click(enter);
    expect(session.store.getState().game.phase).toBe("battle");
    expect(screen.getByRole("region", { name: "Enemy row" })).toBeTruthy();
    await act(async () => {
      await session.flush();
    });
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).phase).toBe("battle");
    await session.dispose();
  });
  it("maps standard controller buttons and sticks to semantic actions", () => {
    const buttons = Array.from({ length: 16 }, (_, i) => ({
      pressed: [0, 2, 3, 12].includes(i),
      touched: false,
      value: 0,
    }));
    expect(gamepadActions({ buttons, axes: [0.8, 0] })).toEqual([
      "confirm",
      "inspect",
      "endTurn",
      "right",
      "up",
    ]);
    expect(gamepadActions({ buttons: [], axes: [0.1, -0.1] })).toEqual([]);
  });
});
it("opens a recoverable error screen when browser storage access itself is denied", async () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  try {
    const session = createSession(createBrowserPlatform());
    await session.load();
    render(<App session={session} />);
    expect(screen.getByRole("button", { name: "Retry loading" })).toBeTruthy();
    expect(session.store.getState().loadFailed).toBe(true);
    await session.dispose();
  } finally {
    Object.defineProperty(window, "localStorage", original);
  }
});

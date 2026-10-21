// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { App } from "../../src/ui/App";

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("menu page focus return", () => {
  it.each(
    ["home", "pause"].flatMap((origin) =>
      ["Collection", "Talents", "Settings", "Glossary"].flatMap((page) =>
        ["Escape", "Back", "Open menu"].map((back) => ({ origin, page, back })),
      ),
    ),
  )("returns from $page via $back to its $origin menu choice", async ({ origin, page, back }) => {
    // jsdom has no layout. Only emulate visibility; this checks focus ownership,
    // not rendered geometry or physical controller behavior.
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      if (origin === "pause") {
        await user.click(screen.getByRole("button", { name: "New journey" }));
        await user.click(screen.getByRole("button", { name: "Open menu" }));
      }
      const revision = session.store.getState().game.revision;
      act(() => screen.getByRole("button", { name: page }).focus());
      await user.keyboard("{Enter}");
      expect(
        screen.getByRole("heading", { name: page === "Glossary" ? "Glossary & controls" : page }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Back", exact: true })).toBeTruthy();
      if (page === "Talents" && back === "Open menu") {
        await user.click(screen.getByRole("button", { name: "Physical talents", exact: true }));
        expect(screen.getByRole("heading", { name: "Physical", exact: true })).toBeTruthy();
      }
      if (back === "Escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: back, exact: true }));
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: page })));
      expect(session.store.getState().game.revision).toBe(revision);
      if (origin === "pause") {
        await user.keyboard("{Escape}");
        await waitFor(() =>
          expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open menu" })),
        );
      }
    } finally {
      cleanup();
      await session.dispose();
    }
  });
});

it("returns from a talent tree to its overview before returning to the menu", async () => {
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  const user = userEvent.setup();
  render(<App session={session} />);
  try {
    await user.click(screen.getByRole("button", { name: "Talents", exact: true }));
    await user.click(screen.getByRole("button", { name: "Physical talents", exact: true }));
    await user.click(screen.getByRole("button", { name: "Back", exact: true }));
    expect(screen.getByRole("heading", { name: "Talents", exact: true })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back", exact: true }));
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeTruthy();
  } finally {
    cleanup();
    await session.dispose();
  }
});

it("returns from starter selection without changing offers or committed choices", async () => {
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  const user = userEvent.setup();
  render(<App session={session} />);
  try {
    await user.click(screen.getByRole("button", { name: "New journey" }));
    const before = session.store.getState().game;
    expect(screen.getAllByRole("button", { name: "Open menu", exact: true })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Back", exact: true }));
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(session.store.getState().game).toBe(before);
  } finally {
    cleanup();
    await session.dispose();
  }
});

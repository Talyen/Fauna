// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { produce } from "immer";
import { encodeSave } from "../../src/game/save";
import { run } from "./helpers";
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
        await user.click(screen.getByRole("button", { name: "Play" }));
        await user.click(screen.getByRole("button", { name: "Open menu" }));
      }
      const revision = session.store.getState().game.revision;
      act(() => screen.getByRole("button", { name: page }).focus());
      await user.keyboard("{Enter}");
      expect(
        screen.getByRole("heading", { name: page === "Glossary" ? "Glossary & controls" : page }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
      if (page === "Collection")
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back" }));
      if (page === "Talents" && back === "Open menu") {
        await user.click(screen.getByRole("button", { name: "Physical talents" }));
        expect(screen.getByRole("heading", { name: "Physical" })).toBeTruthy();
      }
      if (back === "Escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: back }));
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
    await user.click(screen.getByRole("button", { name: "Talents" }));
    await user.click(screen.getByRole("button", { name: "Physical talents" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Talents" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back" }));
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
    await user.click(screen.getByRole("button", { name: "Play" }));
    const before = session.store.getState().game;
    expect(screen.getAllByRole("button", { name: "Open menu" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(session.store.getState().game).toBe(before);
  } finally {
    cleanup();
    await session.dispose();
  }
});

it("continues or dismisses the undimmed menu without changing the journey", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<App session={session} />);
  try {
    await user.click(screen.getByRole("button", { name: "Play" }));
    const revision = session.store.getState().game.revision;
    for (const dismiss of ["Continue", "Escape", "outside"]) {
      const opener = screen.getByRole("button", { name: "Open menu" });
      await user.click(opener);
      const menu = screen.getByRole("dialog", { name: "Pause menu" });
      expect(menu.querySelector(".dialog-close")).toBeNull();
      expect(menu.querySelector("h1, h2")).toBeNull();
      expect(document.querySelector(".dialog-overlay")).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
      if (dismiss === "Continue") await user.click(screen.getByRole("button", { name: "Continue" }));
      else if (dismiss === "Escape") await user.keyboard("{Escape}");
      else await user.click(document.body);
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Pause menu" })).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(opener));
      expect(session.store.getState().game.revision).toBe(revision);
    }
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  } finally {
    cleanup();
    await session.dispose();
  }
});

it.each(["home", "pause"])(
  "shows spendable talent points in the %s menu and clears the cue after purchase",
  async (origin) => {
    localStorage.setItem(
      "fauna.save.v1",
      encodeSave(
        produce(run(7), (game) => {
          game.keywordXP.physical = 10;
        }),
      ),
    );
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      if (origin === "pause") {
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Open menu" }));
      }
      const talents = screen.getByRole("button", { name: "Talents" });
      expect(talents.getAttribute("aria-describedby")).toBe(`menu-talent-points-${origin === "home"}`);
      expect(screen.getByLabelText("1 talent point available").textContent).toBe("1");
      act(() => {
        expect(session.command({ type: "buyTalent", talentId: "physical.shield-slam" })).toBe(true);
      });
      expect(screen.queryByLabelText("1 talent point available")).toBeNull();
      expect(screen.getByRole("button", { name: "Talents" }).hasAttribute("aria-describedby")).toBe(false);
    } finally {
      cleanup();
      await session.dispose();
    }
  },
);

it.each(["Back", "Escape", "Open menu"])(
  "returns from the battle Collection creature page using %s without changing combat",
  async (back) => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    localStorage.setItem("fauna.save.v1", encodeSave(run(7)));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Continue" }));
      const before = session.store.getState().game;
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(screen.getByRole("button", { name: "Collection" }));
      await user.click(screen.getByRole("button", { name: "Inspect Mossback" }));
      expect(screen.getByRole("region", { name: "Bramble Bash" })).toBeTruthy();
      if (back === "Escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: back }));
      if (back !== "Open menu") {
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Inspect Mossback" }));
        await user.keyboard("{Escape}");
      }
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Collection" })),
      );
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(screen.getByRole("main", { name: "Battlefield" })).toBeTruthy();
      expect(session.store.getState().game).toBe(before);
    } finally {
      cleanup();
      await session.dispose();
    }
  },
);

it.each(["home", "pause"])(
  "returns focus to Talents with available points in the %s menu",
  async (origin) => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    localStorage.setItem(
      "fauna.save.v1",
      encodeSave(
        produce(run(7), (game) => {
          game.keywordXP.physical = 10;
        }),
      ),
    );
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      if (origin === "pause") {
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Open menu" }));
      }
      await user.click(screen.getByRole("button", { name: "Talents" }));
      await user.click(screen.getByRole("button", { name: "Back" }));
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Talents" })),
      );
    } finally {
      cleanup();
      await session.dispose();
    }
  },
);

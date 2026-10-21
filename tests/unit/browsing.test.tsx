// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { App } from "../../src/ui/App";
import { createGame } from "../../src/game/engine";
import { SPECIES } from "../../src/game/content";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";

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
});

describe("menu browsing", () => {
  it("explains talents before hover and updates requirements after purchases and category reset", async () => {
    const game = produce(createGame(7), (draft) => {
      draft.keywordXP.physical = 10;
      draft.keywordXP.block = 10;
      draft.talents = ["block.second-wind"];
    });
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Talents" }));
      const physical = screen.getByRole("button", { name: "Physical talents" });
      expect(document.getElementById(physical.getAttribute("aria-describedby")!)?.textContent).toBe(
        "1 point available",
      );
      expect(screen.getByRole("button", { name: "Block talents" }).hasAttribute("aria-describedby")).toBe(
        false,
      );
      await user.click(physical);
      expect(screen.getByRole("button", { name: "Reset Physical talents" }).hasAttribute("disabled")).toBe(
        true,
      );
      const slam = screen.getByRole("button", { name: "Shield Slam" });
      expect(slam.textContent).toContain("Add half your Block to Physical damage.");
      expect(within(slam).getByText("Unlock · 1 point")).toBeTruthy();
      await user.click(slam);
      expect(screen.getByRole("button", { name: "Shield Slam, unlocked" })).toBeTruthy();
      const fists = screen.getByRole("button", { name: "Armored Fists" });
      expect(within(fists).getByText("Requires 1 point")).toBeTruthy();
      const revision = session.store.getState().game.revision;
      await user.click(fists);
      expect(session.store.getState().game.revision).toBe(revision);
      await user.click(screen.getByRole("button", { name: "Reset Physical talents" }));
      expect(session.store.getState().game.talents).toEqual(["block.second-wind"]);
      expect(session.store.getState().game.keywordXP).toEqual(game.keywordXP);
      expect(screen.getByRole("button", { name: "Reset Physical talents" }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(within(fists).getByText("Unlock · 1 point")).toBeTruthy();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Physical talents" })).toBeTruthy();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Talents" })).toBeTruthy();
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("keeps Collection artwork-only, reveals details on hover, and opens pinned inspection", async () => {
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! });
    session.command({ type: "start" });
    try {
      await user.click(screen.getByRole("button", { name: "Collection" }));
      const game = session.store.getState().game;
      for (const creature of SPECIES) {
        if (game.discovery.recruited[creature.id] !== undefined) {
          expect(screen.queryByRole("heading", { name: creature.name })).toBeNull();
          expect(screen.getByRole("button", { name: `Inspect ${creature.name}` }).textContent).toBe("");
        } else {
          expect(screen.queryByRole("heading", { name: creature.name })).toBeNull();
          expect(screen.queryByRole("button", { name: `Inspect ${creature.name}` })).toBeNull();
        }
      }
      const creature = SPECIES.find((entry) => game.discovery.recruited[entry.id] !== undefined)!;
      const card = screen.getByRole("button", { name: `Inspect ${creature.name}` });
      await user.hover(card);
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip.textContent).toContain(creature.name);
      expect(tooltip.textContent).toContain(creature.passiveTiers[0].description);
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(card);
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(session.store.getState().game.revision).toBe(game.revision);
    } finally {
      cleanup();
      await session.dispose();
    }
  });
});

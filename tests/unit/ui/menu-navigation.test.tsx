import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { produce } from "immer";
import { encodeSave } from "../../../src/game/save";
import { accept, run, winBattle, merchantDestination } from "../../support/game";
import { createGame } from "../../../src/game/engine";
import { App } from "../../../src/ui/App";

screenTestEnvironment();

it.each(["home", "pause"] as const)(
  "returns every menu page to its %s choice without changing the journey",
  async (origin) => {
    // Reuse the session across state-neutral visits so stale focus and navigation state remain observable
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
      const game = session.store.getState().game;
      for (const [index, page] of ["Collection", "Talents", "Settings", "Glossary"].entries()) {
        for (const [exit, back] of ["Escape", "Back", "Open menu"].entries()) {
          // Retain every page/exit pair and both origins per page without their Cartesian product
          if (((index + exit) % 2 === 0 ? "home" : "pause") !== origin) continue;
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
          await waitFor(() =>
            expect(document.activeElement).toBe(screen.getByRole("button", { name: page })),
          );
          expect(session.store.getState().game, `${page} via ${back}`).toBe(game);
        }
      }
      if (origin === "pause") {
        await user.keyboard("{Escape}");
        await waitFor(() =>
          expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open menu" })),
        );
        expect(session.store.getState().game).toBe(game);
      }
    } finally {
      cleanup();
      await session.dispose();
    }
  },
);

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
      const talents = screen.getByRole("button", { name: "Talents" });
      const description = talents.getAttribute("aria-describedby");
      expect(description).toBeTruthy();
      expect(document.getElementById(description!)?.getAttribute("aria-label")).toBe(
        "1 talent point available",
      );
      expect(screen.getByLabelText("1 talent point available").textContent).toBe("1");
      await user.click(talents);
      await user.click(screen.getByRole("button", { name: "Back" }));
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Talents" })),
      );
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

it("makes Deck available in drafting, rewards and Merchant without committing inspection", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const started = accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
    type: "start",
  });
  const reward = winBattle(accept(started, { type: "beginBattle" }));
  const destination = merchantDestination();
  const merchant = accept(destination, { type: "enterSupport", visit: destination.support!.id });
  for (const game of [
    accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }),
    reward,
    merchant,
  ]) {
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage));
    await session.load();
    const view = render(<App session={session} />);
    const user = userEvent.setup();
    try {
      await user.click(screen.getByRole("button", { name: "Continue" }));
      const before = session.store.getState().game;
      await user.click(screen.getByRole("button", { name: "Deck" }));
      const deck = screen.getByRole("dialog", { name: "Deck" });
      expect(deck.querySelectorAll(".action-card")).toHaveLength(3);
      expect(session.store.getState().game).toBe(before);
      await user.click(deck.querySelector<HTMLButtonElement>(".action-card")!);
      expect(screen.getByRole("dialog", { name: / details$/ })).not.toBe(deck);
      expect(session.store.getState().game).toBe(before);
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: "Deck" })).toBe(deck);
      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Deck" }));
    } finally {
      view.unmount();
      await session.dispose();
      localStorage.clear();
    }
  }
});

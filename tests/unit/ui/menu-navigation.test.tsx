import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { produce } from "immer";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept, run, winBattle, merchantDestination } from "../../support/game";
import { createGame, dispatch } from "../../../src/game/engine";
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
      expect(screen.queryByRole("button", { name: "Glossary" })).toBeNull();
      for (const [index, page] of ["Collection", "Talents", "Settings"].entries()) {
        for (const [exit, back] of ["Escape", "Back", "Open menu"].entries()) {
          // Retain every page/exit pair and both origins per page without their Cartesian product
          if (((index + exit) % 2 === 0 ? "home" : "pause") !== origin) continue;
          const action = page === "Settings" ? "Options" : page;
          act(() => screen.getByRole("button", { name: action }).focus());
          await user.keyboard("{Enter}");
          expect(screen.getByRole("heading", { name: action })).toBeTruthy();
          expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
          if (page === "Collection")
            expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back" }));
          if (page === "Talents" && back === "Open menu") {
            await user.click(screen.getByRole("button", { name: "Physical talents" }));
            expect(screen.getByRole("heading", { name: "Physical" })).toBeTruthy();
          }
          if (page === "Talents" && back === "Back") {
            await user.click(screen.getByRole("button", { name: "Physical talents" }));
            await user.click(screen.getByRole("button", { name: "Back" }));
            expect(screen.getByRole("heading", { name: "Talents" })).toBeTruthy();
          }
          if (back === "Escape") await user.keyboard("{Escape}");
          else await user.click(screen.getByRole("button", { name: back }));
          await waitFor(() =>
            expect(document.activeElement).toBe(screen.getByRole("button", { name: action })),
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

it("resumes an unchosen starter draft after restarting and can end it", async () => {
  const platform = createBrowserPlatform(localStorage);
  const first = createSession(platform, 7);
  await first.load();
  const user = userEvent.setup();
  render(<App session={first} />);
  await user.click(screen.getByRole("button", { name: "Play" }));
  const started = first.store.getState().game;
  expect(started.draftStarted).toBe(true);
  const replacement = dispatch(started, { type: "newRun", seed: 123 });
  expect(replacement.accepted).toBe(false);
  expect(replacement.state).toBe(started);
  const picked = accept(started, { type: "draft", species: started.starterOffers[0]! });
  expect(() => decodeSave(JSON.stringify({ ...picked, draftStarted: false }))).toThrow();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  cleanup();
  await first.dispose();

  const resumed = createSession(platform, 99);
  await resumed.load();
  render(<App session={resumed} />);
  try {
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(resumed.store.getState().game).toEqual(started);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: "End Run" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(resumed.store.getState().game.draftStarted).toBe(false);
  } finally {
    cleanup();
    await resumed.dispose();
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
    for (const dismiss of ["Return to Run", "Escape", "outside"]) {
      const opener = screen.getByRole("button", { name: "Open menu" });
      expect(opener.getAttribute("aria-expanded")).toBe("false");
      await user.click(opener);
      const menu = screen.getByRole("dialog", { name: "Pause menu" });
      expect(opener.getAttribute("aria-expanded")).toBe("true");
      expect(
        within(menu)
          .getAllByRole("button")
          .map((button) => button.textContent?.trim()),
      ).toEqual(["Return to Run", "Main Menu", "Collection", "Talents", "Options", "End Run", "Quit"]);
      expect(menu.querySelector(".dialog-close")).toBeNull();
      expect(menu.querySelector("h1, h2")).toBeNull();
      expect(document.querySelector(".dialog-overlay")).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Return to Run" }));
      if (dismiss === "Return to Run")
        await user.click(screen.getByRole("button", { name: "Return to Run" }));
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

it("keeps both menus' talent cues in sync with purchases, rejection and category reset", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const game = produce(run(7), (draft) => {
    draft.keywordXP.physical = 10;
    draft.keywordXP.block = 10;
    draft.talents = ["block.second-wind"];
  });
  localStorage.setItem("fauna.save.v1", encodeSave(game));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  const user = userEvent.setup();
  render(<App session={session} />);
  const cue = (available: boolean, origin: "home" | "pause") => {
    const button = screen.getByRole("button", { name: "Talents" });
    expect(button.hasAttribute("aria-describedby")).toBe(available);
    if (available) {
      const description = document.getElementById(button.getAttribute("aria-describedby")!);
      expect(description?.getAttribute("aria-label")).toBe("1 talent point available");
      expect(description?.textContent).toBe(origin === "home" ? "" : "1");
      if (origin === "home") expect(description?.classList.contains("talent-category-notice")).toBe(true);
    } else expect(screen.queryByLabelText("1 talent point available")).toBeNull();
  };
  try {
    for (const origin of ["home", "pause"] as const) {
      if (origin === "pause") {
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Open menu" }));
      }
      cue(true, origin);
      await user.click(screen.getByRole("button", { name: "Talents" }));
      const physical = screen.getByRole("button", { name: "Physical talents" });
      expect(document.getElementById(physical.getAttribute("aria-describedby")!)?.textContent).toBe(
        "1 point available",
      );
      expect(screen.getByRole("button", { name: "Block talents" }).hasAttribute("aria-describedby")).toBe(
        false,
      );
      await user.click(screen.getByRole("button", { name: "Back" }));
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Talents" })),
      );
      expect(session.store.getState().game).toEqual(game);
    }
    await user.click(screen.getByRole("button", { name: "Talents" }));
    await user.click(screen.getByRole("button", { name: "Physical talents" }));
    expect(screen.getByRole("button", { name: "Reset Physical talents" }).hasAttribute("disabled")).toBe(
      true,
    );
    const slam = screen.getByRole("button", { name: "Shield Slam" });
    expect(slam.textContent).toContain("Add half your Block to Physical damage");
    expect(within(slam).getByText("Unlock · 1 point")).toBeTruthy();
    await user.click(slam);
    expect(screen.getByRole("button", { name: "Shield Slam, unlocked" })).toBeTruthy();
    const fists = screen.getByRole("button", { name: "Armored Fists" });
    expect(within(fists).getByText("Requires 1 point")).toBeTruthy();
    const bought = session.store.getState().game;
    await user.click(fists);
    expect(session.store.getState().game).toBe(bought);
    await user.keyboard("{Escape}{Escape}");
    cue(false, "pause");
    await user.click(screen.getByRole("button", { name: "Main Menu" }));
    cue(false, "home");
    await user.click(screen.getByRole("button", { name: "Talents" }));
    await user.click(screen.getByRole("button", { name: "Physical talents" }));
    await user.click(screen.getByRole("button", { name: "Reset Physical talents" }));
    expect(session.store.getState().game.talents).toEqual(["block.second-wind"]);
    expect(session.store.getState().game.keywordXP).toEqual(game.keywordXP);
    expect(screen.getByRole("button", { name: "Reset Physical talents" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Shield Slam" }));
    expect(
      within(screen.getByRole("button", { name: "Shield Slam" })).getByText("Unlock · 1 point"),
    ).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Physical talents" })).toBeTruthy();
    await user.keyboard("{Escape}");
    cue(true, "home");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    cue(true, "pause");
  } finally {
    cleanup();
    await session.dispose();
  }
});

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

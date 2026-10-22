// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { App } from "../../src/ui/App";
import { Rewards } from "../../src/ui/expedition-screens";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { createGame } from "../../src/game/engine";
import { species } from "../../src/game/content";
import { accept, recruitChoice, run, winBattle, starterJourney } from "./helpers";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps the incoming recruit inspectable while browsing replacements, and cancellation preserves the offer", async () => {
  const game = produce(winBattle(run()), (draft) => {
    for (const [index, kind] of (["emberback", "pollenmoth"] as const).entries()) {
      const id = `reserve-${index}`;
      draft.roster.push(kind);
      draft.reserves.push({ id, species: kind, health: species(kind).health, block: 0, attacked: false });
    }
  });
  const send = vi.fn(() => true),
    inspect = vi.fn();
  render(
    <TooltipProvider>
      <Rewards game={game} send={send} inspect={inspect} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  const incoming = game.reward!.recruits[0]!;
  const offer = screen.getByRole("button", { name: `Recruit ${species(incoming).name}` });
  await user.click(offer);
  const comparison = screen.getByRole("region", { name: "Incoming recruit" });
  await user.click(within(comparison).getByRole("button", { name: `Inspect ${species(incoming).name}` }));
  expect(inspect).toHaveBeenCalledWith({ species: incoming });
  expect(send).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByRole("region", { name: "Incoming recruit" })).toBe(comparison);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("region", { name: "Incoming recruit" })).toBeNull();
  expect(send).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: `Recruit ${species(incoming).name}` }),
  );
  await user.click(screen.getByRole("button", { name: `Recruit ${species(incoming).name}` }));
  await user.click(screen.getAllByRole("button", { name: /^Release / })[0]!);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "recruit",
    species: incoming,
    replace: game.team[0]!.id,
  });
});

it("makes Deck available in drafting, rewards and Merchant without committing inspection", async () => {
  const started = accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
    type: "start",
  });
  const reward = winBattle(accept(started, { type: "beginBattle" }));
  const destination = accept(reward, recruitChoice(reward));
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

it("shows committed rest recovery while leaving the next encounter immediately playable", async () => {
  const started = starterJourney(7, "emberback");
  const injured = produce(started, (draft) => {
    draft.team[0]!.health = 10;
  });
  localStorage.setItem("fauna.save.v1", JSON.stringify(accept(injured, { type: "visitCampfire" })));
  const session = createSession(createBrowserPlatform(localStorage));
  await session.load();
  render(<App session={session} />);
  const user = userEvent.setup();
  try {
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Rest" }));
    const rested = session.store.getState().game;
    expect(rested.phase).toBe("teamSelection");
    expect(rested.team[0]!.health).toBe(19);
    const recovery = screen.getByRole("status", { name: "Rest recovery" });
    expect(recovery.textContent).toContain("10 → 19 Health · +9");
    expect(
      within(recovery).getByRole("progressbar", { name: "Emberback Health" }).getAttribute("aria-valuenow"),
    ).toBe("19");
    expect(rested.rng).toBe(injured.rng);
    await user.click(screen.getByRole("button", { name: "Combat" }));
    expect(session.store.getState().game.phase).toBe("battle");
    expect(screen.queryByRole("status", { name: "Rest recovery" })).toBeNull();
    await act(async () => {
      await session.flush();
    });
  } finally {
    await session.dispose();
  }
});

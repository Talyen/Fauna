// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { App } from "../../src/ui/App";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { KEYWORDS, TALENTS, keywordLabel } from "../../src/game/progression";
import { run } from "./helpers";
import type { GameState } from "../../src/game/types";

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
  vi.unstubAllGlobals();
});
async function open(game: GameState) {
  localStorage.setItem("fauna.save.v1", JSON.stringify(game));
  const session = createSession(createBrowserPlatform(localStorage));
  await session.load();
  render(<App session={session} />);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  return session;
}
it("inspects draw and discard piles without changing state or exposing draw order, and returns focus through nested inspection", async () => {
  const session = await open(
    produce(run(), (s) => {
      s.battle!.discard.push(s.battle!.draw.pop()!);
    }),
  );
  try {
    const before = session.store.getState().game;
    const draw = screen.getByRole("button", { name: /^Inspect Draw Pile/ });
    await userEvent.click(draw);
    const pile = screen.getByRole("dialog", { name: "Draw Pile" });
    const cards = within(pile)
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("data-card-id"));
    expect(cards).toHaveLength(before.battle!.draw.length);
    const ids = cards.map((card) => card.dataset.cardId);
    const expected = before.cards
      .filter((card) => before.battle!.draw.includes(card.id))
      .sort((a, b) => a.definitionId.localeCompare(b.definitionId) || a.id.localeCompare(b.id))
      .map((card) => card.id);
    expect(ids).toEqual(expected);
    await userEvent.click(cards[0]!);
    expect(screen.getAllByRole("dialog").at(-1)?.getAttribute("class")).toContain("inspection");
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(cards[0]);
    await userEvent.click(screen.getByRole("button", { name: "Close draw pile" }));
    expect(document.activeElement).toBe(draw);
    await userEvent.click(screen.getByRole("button", { name: /^Inspect Discard Pile/ }));
    expect(
      within(screen.getByRole("dialog", { name: "Discard Pile" }))
        .getAllByRole("button")
        .filter((button) => button.hasAttribute("data-card-id")),
    ).toHaveLength(1);
    expect(session.store.getState().game).toBe(before);
  } finally {
    await act(() => session.dispose());
  }
});
it("shows exact Campfire recovery and commits one persisted Rest without currency or XP rewards", async () => {
  const session = await open(
    produce(run(), (s) => {
      s.phase = "teamSelection";
      s.battle = null;
      s.encounter = 3;
      s.expedition = { pack: 0 };
      s.team[0]!.health = 0;
    }),
  );
  try {
    const before = session.store.getState().game;
    await userEvent.click(screen.getByRole("button", { name: "Visit Campfire" }));
    expect(screen.getByRole("heading", { name: "Campfire" })).toBeTruthy();
    expect(
      screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "0/32 Health · Rest +10"),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Rest" }));
    await session.flush();
    const after = session.store.getState().game;
    expect(after.team[0]!.health).toBe(10);
    expect(after.keywordXP).toEqual(before.keywordXP);
    expect(after.currency).toBe(before.currency);
    expect(screen.getByRole("button", { name: "Visit Campfire" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).team[0].health).toBe(10);
  } finally {
    await act(() => session.dispose());
  }
});

it("exposes pending talent rewards and remaining control turns in creature details", async () => {
  const session = await open(
    produce(run(), (state) => {
      state.team[0]!.combat!.freeNature = true;
      state.team[0]!.combat!.riposte = true;
      state.team[0]!.combat!.rhythm = 10;
      state.battle!.enemies[0]!.combat.controlled = "stun";
      state.battle!.enemies[0]!.combat.controlTurns = 2;
    }),
  );
  try {
    expect(screen.getByRole("button", { name: "Windstep: next Nature card is free" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Riposte: next Physical attack is a guaranteed Critical Hit" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finding Rhythm: +10% Dodge chance" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stunned: 2 turns" })).toBeTruthy();
  } finally {
    await session.dispose();
  }
});

it("opens every expanded talent tree and purchases a later row through the existing controls", async () => {
  const game = produce(run(), (state) => {
    state.keywordXP = Object.fromEntries(KEYWORDS.map((keyword) => [keyword, 10000]));
  });
  localStorage.setItem("fauna.save.v1", JSON.stringify(game));
  const session = createSession(createBrowserPlatform(localStorage));
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Talents", exact: true }));
    for (const keyword of KEYWORDS) {
      await userEvent.click(screen.getByRole("button", { name: `${keywordLabel(keyword)} talents` }));
      const talents = TALENTS.filter((t) => t.keyword === keyword);
      for (const talent of talents)
        expect(screen.getByRole("button", { name: talent.name, exact: true })).toBeTruthy();
      if (keyword === "physical") {
        const later = talents.find((t) => t.row === 1)!;
        expect(screen.getByRole("button", { name: later.name }).getAttribute("aria-disabled")).toBe("true");
        for (const talent of talents.filter((t) => t.row === 0))
          await userEvent.click(screen.getByRole("button", { name: talent.name, exact: true }));
        await userEvent.click(screen.getByRole("button", { name: later.name, exact: true }));
        expect(session.store.getState().game.talents).toContain(later.id);
      }
      await userEvent.click(screen.getByRole("button", { name: "Back", exact: true }));
    }
  } finally {
    await session.dispose();
  }
});

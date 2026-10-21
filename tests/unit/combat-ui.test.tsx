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
    expect(cards).toHaveLength(Math.min(3, before.battle!.draw.length));
    const ids = cards.map((card) => card.dataset.cardId);
    const expected = before.cards
      .filter((card) => before.battle!.draw.includes(card.id))
      .sort((a, b) => a.definitionId.localeCompare(b.definitionId) || a.id.localeCompare(b.id))
      .map((card) => card.id);
    expect(ids).toEqual(expected.slice(0, 3));
    const allIds = [...ids];
    while (!(within(pile).getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled) {
      await userEvent.click(within(pile).getByRole("button", { name: "Next page" }));
      allIds.push(
        ...Array.from(pile.querySelectorAll<HTMLElement>("[data-card-id]"), (el) => el.dataset.cardId),
      );
    }
    expect(allIds).toEqual(expected);
    await userEvent.click(within(pile).getByRole("button", { name: "Previous page" }));
    const firstCard = pile.querySelector<HTMLButtonElement>("[data-card-id]")!;
    await userEvent.click(firstCard);
    expect(screen.getAllByRole("dialog").at(-1)?.getAttribute("class")).toContain("inspection");
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(firstCard);
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

it("keeps all simultaneous combat effects reachable through bounded pages", async () => {
  const session = await open(
    produce(run(), (state) => {
      Object.assign(state.team[0]!.combat!, { armor: 3, thorns: 2, dodge: 10, burn: 1, poison: 1, bleed: 1 });
    }),
  );
  try {
    const effects = document.querySelector(".player-row .combat-status") as HTMLElement;
    const seen = new Set<string>();
    for (;;) {
      effects
        .querySelectorAll<HTMLElement>("[data-status-id]")
        .forEach((el) => seen.add(el.dataset.statusId!));
      const next = within(effects).getByRole("button", { name: "Next page" }) as HTMLButtonElement;
      if (next.disabled) break;
      await userEvent.click(next);
    }
    expect([...seen]).toEqual(["armor", "thorns", "dodge", "burn", "poison", "bleed"]);
    expect(document.activeElement).toBe(within(effects).getByRole("button", { name: "Previous page" }));
  } finally {
    await session.dispose();
  }
});

it.each(KEYWORDS)("opens %s talent pages and preserves purchases and requirements", async (keyword) => {
  const game = produce(run(), (state) => {
    state.keywordXP = Object.fromEntries(KEYWORDS.map((keyword) => [keyword, 10000]));
  });
  localStorage.setItem("fauna.save.v1", JSON.stringify(game));
  const session = createSession(createBrowserPlatform(localStorage));
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Talents" }));
    {
      await userEvent.click(screen.getByRole("button", { name: `${keywordLabel(keyword)} talents` }));
      const talents = TALENTS.filter((t) => t.keyword === keyword);
      const rows = [...new Set(talents.map((talent) => talent.row))];
      for (let index = 0; index < rows.length; index++) {
        for (const talent of talents.filter((entry) => entry.row === rows[index]))
          expect(screen.getByRole("button", { name: talent.name })).toBeTruthy();
        if (index < rows.length - 1) await userEvent.click(screen.getByRole("button", { name: "Next page" }));
      }
      while (!(screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled)
        await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
      if (keyword === "physical") {
        const later = talents.find((t) => t.row === 1)!;
        await userEvent.click(screen.getByRole("button", { name: "Next page" }));
        expect(screen.getByRole("button", { name: later.name }).getAttribute("aria-disabled")).toBe("true");
        await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
        for (const talent of talents.filter((t) => t.row === 0))
          await userEvent.click(screen.getByRole("button", { name: talent.name }));
        await userEvent.click(screen.getByRole("button", { name: "Next page" }));
        await userEvent.click(screen.getByRole("button", { name: later.name }));
        expect(session.store.getState().game.talents).toContain(later.id);
      }
      await userEvent.click(screen.getByRole("button", { name: "Back" }));
    }
  } finally {
    await session.dispose();
  }
});

// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { produce } from "immer";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { KEYWORDS, keywordLabel } from "../../../src/game/progression";
import { TALENTS } from "../../../src/game/content";
import { authoredPack, prepareDestination, run } from "../../support/game";
import { Talents } from "../../../src/ui/talents/talents";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import type { GameState } from "../../../src/game/types";

screenTestEnvironment({ visible: true });

async function open(game: GameState) {
  localStorage.setItem("fauna.save.v1", JSON.stringify(game));
  const session = createSession(createBrowserPlatform(localStorage));
  await session.load();
  render(<App session={session} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  return { session, user };
}
it("inspects draw and discard piles without changing state or exposing draw order, and keeps card details on hover", async () => {
  const { session, user } = await open(
    produce(run(), (s) => {
      s.battle!.discard.push(s.battle!.draw.pop()!);
    }),
  );
  try {
    const before = session.store.getState().game;
    const draw = screen.getByRole("button", { name: /^Inspect Draw Pile/ });
    await user.click(draw);
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
      await user.click(within(pile).getByRole("button", { name: "Next page" }));
      allIds.push(
        ...Array.from(pile.querySelectorAll<HTMLElement>("[data-card-id]"), (el) => el.dataset.cardId),
      );
    }
    expect(allIds).toEqual(expected);
    await user.click(within(pile).getByRole("button", { name: "Previous page" }));
    const firstCard = pile.querySelector<HTMLButtonElement>("[data-card-id]")!;
    await user.click(firstCard);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.hover(within(pile).getByRole("heading", { name: "Draw Pile" }));
    await user.hover(firstCard);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    await user.keyboard("i");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Close draw pile" }));
    expect(document.activeElement).toBe(draw);
    await user.click(screen.getByRole("button", { name: /^Inspect Discard Pile/ }));
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
  const { session, user } = await open(
    produce(run(), (s) => {
      prepareDestination(s);
      s.encounter = 3;
      s.journey!.victories = s.encounter;
      s.expedition = { pack: authoredPack(s.encounter), recruit: null, lastRoom: null };
      s.team[0]!.health = 0;
    }),
  );
  try {
    const before = session.store.getState().game;
    await user.click(screen.getByRole("button", { name: "Visit Campfire" }));
    expect(screen.getByRole("heading", { name: "Campfire" })).toBeTruthy();
    expect(
      screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "0/32 Health · Rest +10"),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Rest" }));
    await session.flush();
    const after = session.store.getState().game;
    expect(after.team[0]!.health).toBe(10);
    expect(after.keywordXP).toEqual(before.keywordXP);
    expect(after.currency).toBe(before.currency);
    expect(screen.queryByRole("button", { name: "Visit Campfire" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).team[0].health).toBe(10);
  } finally {
    await act(() => session.dispose());
  }
});

it("exposes pending talent rewards and remaining control turns in creature details", async () => {
  const { session } = await open(
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
  const { session, user } = await open(
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
      await user.click(next);
    }
    expect([...seen]).toEqual(["armor", "thorns", "dodge", "burn", "poison", "bleed"]);
    expect(document.activeElement).toBe(within(effects).getByRole("button", { name: "Previous page" }));
  } finally {
    await session.dispose();
  }
});

it("reaches every authored talent row without sending commands", () => {
  const game = produce(run(), (state) => {
    state.keywordXP = Object.fromEntries(KEYWORDS.map((keyword) => [keyword, 10000]));
  });
  const send = vi.fn(() => true);
  const view = render(
    <TooltipProvider>
      <Talents game={game} send={send} openMenu={vi.fn()} />
    </TooltipProvider>,
  );
  expect(
    screen.getAllByRole("button", { name: / talents$/ }).map((button) => button.getAttribute("aria-label")),
  ).toEqual(KEYWORDS.map((keyword) => `${keywordLabel(keyword)} talents`));
  for (const keyword of KEYWORDS) {
    fireEvent.click(view.container.querySelector(`[data-talent-keyword="${keyword}"]`)!);
    const tree = within(screen.getByRole("main"));
    const talents = TALENTS.filter((talent) => talent.keyword === keyword);
    const rows = [...new Set(talents.map((talent) => talent.row))];
    for (const [index, row] of rows.entries()) {
      const names: string[] = talents.filter((entry) => entry.row === row).map((talent) => talent.name);
      expect(
        tree
          .getAllByRole("button", { name: (name) => names.includes(name) })
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(names);
      if (index < rows.length - 1) fireEvent.click(tree.getByRole("button", { name: "Next page" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
  }
  expect(send).not.toHaveBeenCalled();
}, 15_000);

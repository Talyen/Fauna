// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { CARDS, species } from "../../src/game/content";
import { encodeSave } from "../../src/game/save";
import { createGame } from "../../src/game/engine";
import { StarterDetails } from "../../src/ui/card-details";
import { App } from "../../src/ui/App";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { run, teamRun } from "./helpers";

beforeEach(() => {
  // jsdom has no layout; this checks focus ownership, not rendered geometry.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("artwork-first inspection", () => {
  it("shows talent-adjusted Mana costs in the starter kit", () => {
    const game = produce(createGame(7), (draft) => {
      draft.talents = ["burn.flashpoint"];
    });
    render(<StarterDetails game={game} kind="emberback" />);
    expect(screen.getByText("Furnace Breath").closest("p")?.textContent).toContain("0 Mana");
    expect(screen.getByText("Ember Charge").closest("p")?.textContent).toContain("1 Mana");
  });

  it.each([0, 1, 2])(
    "previews starter slot %s without committing and restores it after choosing",
    async (slot) => {
      const session = createSession(createBrowserPlatform(localStorage), 7);
      await session.load();
      const user = userEvent.setup();
      render(<App session={session} />);
      try {
        await user.click(screen.getByRole("button", { name: "Play" }));
        const game = session.store.getState().game;
        const kind = game.starterOffers[slot]!;
        const creature = species(kind);
        const opener = screen.getByRole("button", { name: `Inspect ${creature.name}` });
        await user.hover(opener);
        const tooltip = await screen.findByRole("tooltip");
        expect(tooltip.textContent).toContain(creature.trait);
        for (const action of CARDS.filter((entry) => entry.species === kind)) {
          expect(tooltip.textContent).toContain(action.name);
          expect(tooltip.textContent).toContain(`${action.cost} Mana`);
        }
        await user.click(opener);
        const dialog = screen.getByRole("dialog", { name: creature.name });
        expect(dialog.querySelector(".passive-tiers")).toBeNull();
        expect(within(dialog).getByRole("region", { name: "Trait" }).textContent).toContain(
          creature.passiveTiers[0].description,
        );
        await user.click(within(dialog).getByRole("button", { name: "Rank progression" }));
        expect(screen.queryByRole("button", { name: `Choose ${creature.name}` })).toBeNull();
        await user.keyboard("{Escape}");
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rank progression" }));
        expect(session.store.getState().game).toBe(game);
        await user.click(screen.getByRole("button", { name: `Choose ${creature.name}` }));
        expect(session.store.getState().game.selected).toEqual([kind]);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: `Inspect ${creature.name}` }));
      } finally {
        cleanup();
        await session.dispose();
      }
    },
  );

  it("shows the trait and all base abilities directly in Collection, preserves rank browsing and returns focus", async () => {
    localStorage.setItem(
      "fauna.save.v1",
      encodeSave(
        produce(run(7), (draft) => {
          draft.discovery.recruited.mossguard = 4;
          draft.cards[0]!.level = 1;
        }),
      ),
    );
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const game = session.store.getState().game;
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Collection" }));
      const opener = screen.getByRole("button", { name: "Inspect Mossguard" });
      await user.click(opener);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("heading", { name: "Mossguard" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Trait" }).textContent).toContain(
        "Retain 40% more Block between turns",
      );
      for (const card of CARDS.filter((c) => c.species === "mossguard")) {
        const ability = screen.getByRole("region", { name: card.name });
        expect(ability.textContent).toContain(`${card.cost} Mana`);
        expect(ability.querySelector(".action-effect")?.textContent).toBeTruthy();
        expect(within(ability).queryByRole("button")).toBeNull();
      }
      expect(screen.getByRole("region", { name: "Rooted Stomp" }).textContent).toContain(
        "Deal 2 Stun damage to all enemies",
      );
      await user.keyboard("i");
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(screen.getByRole("tab", { name: "Rank progression" }));
      const tiers = screen.getByRole("region", { name: "Overgrowth passive tiers" });
      expect(tiers.textContent).toContain("0 stars");
      for (let rank = 0; rank < 3; rank++)
        await user.click(within(tiers).getByRole("button", { name: "Next page" }));
      expect(tiers.querySelector('[aria-current="step"]')?.textContent).toContain(
        "3 stars · Current rank · Active effect",
      );
      await user.click(screen.getByRole("tab", { name: "Base abilities" }));
      expect(screen.getByRole("region", { name: "Boulder Brace" })).toBeTruthy();
      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(opener);
      expect(session.store.getState().game).toBe(game);
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("keeps modified hand rules and enemy effects on hover without any battle inspection", async () => {
    const fixture = produce(teamRun(7, ["emberback", "emberback", "prismram"]), (game) => {
      game.cards[0]!.level = 1;
      game.keywordXP.physical = 20;
      game.talents = ["physical.shield-slam"];
      game.team[0]!.block = 4;
      game.battle!.enemies[0]!.combat.thorns = 2;
      game.battle!.hand = [game.cards[0]!.id];
      game.battle!.buffer = [];
      game.battle!.draw = game.cards.slice(1).map((card) => card.id);
      game.battle!.discard = [];
    });
    localStorage.setItem("fauna.save.v1", JSON.stringify(fixture));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Continue" }));
      const before = session.store.getState().game;
      const card = screen.getByRole("button", { name: /^Ember Charge \+1,/ });
      await user.hover(card);
      expect((await screen.findByRole("tooltip")).textContent).toContain("Deal 8 Physical damage");
      act(() => card.focus());
      await user.keyboard("i");
      await user.pointer({ target: card, keys: "[MouseRight]" });
      expect(screen.queryByRole("dialog")).toBeNull();
      for (const row of [".enemy-row", ".player-row"]) {
        const creature = document.querySelector<HTMLButtonElement>(`${row} .creature-card`)!;
        await user.click(creature);
        await user.pointer({ target: creature, keys: "[MouseRight]" });
        await user.keyboard("i");
        expect(screen.queryByRole("dialog")).toBeNull();
      }
      await user.hover(document.querySelector<HTMLButtonElement>(".enemy-row .creature-card")!);
      const tooltip = await screen.findByRole("tooltip");
      const enemy = before.battle!.enemies[0]!;
      expect(tooltip.textContent).toContain(enemy.name);
      expect(tooltip.textContent).toContain("Thorns 2");
      expect(tooltip.textContent).not.toContain(`${enemy.health}/${enemy.maxHealth}`);
      expect(tooltip.textContent).not.toContain("Ember Charge");
      expect(session.store.getState().game).toBe(before);
    } finally {
      cleanup();
      await session.dispose();
    }
  });
});

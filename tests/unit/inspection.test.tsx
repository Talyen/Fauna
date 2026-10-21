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
    render(<StarterDetails game={game} kind="emberfox" />);
    expect(screen.getByText("Cinder Strike").closest("p")?.textContent).toContain("0 Mana");
    expect(screen.getByText("Warm Embers").closest("p")?.textContent).toContain("1 Mana");
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

  it("keeps creature and ability information on hover and returns to the selected artwork", async () => {
    localStorage.setItem(
      "fauna.save.v1",
      encodeSave(
        produce(run(7), (draft) => {
          draft.discovery.recruited.mossback = 4;
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
      const opener = screen.getByRole("button", { name: "Inspect Mossback" });
      await user.click(opener);
      const dialog = screen.getByRole("dialog", { name: "Mossback" });
      expect(dialog.querySelector(".card-details")).toBeNull();
      expect(within(dialog).queryByRole("region", { name: "Rooted passive tiers" })).toBeNull();
      expect(within(dialog).getByRole("region", { name: "Abilities" })).toBeTruthy();
      expect(within(dialog).getByRole("region", { name: "Trait" }).textContent).toContain("Rooted");
      const rankOpener = within(dialog).getByRole("button", { name: "Rank progression" });
      await user.click(rankOpener);
      const tiers = within(screen.getByRole("dialog", { name: "Mossback rank progression" })).getByRole(
        "region",
        { name: "Rooted passive tiers" },
      );
      expect(within(tiers).getAllByRole("listitem")).toHaveLength(1);
      expect(tiers.textContent).toContain("0 stars · Active effect");
      for (let rank = 0; rank < 3; rank++)
        await user.click(within(tiers).getByRole("button", { name: "Next page" }));
      expect(tiers.querySelector('[aria-current="step"]')?.textContent).toContain("3 stars · Current rank");
      await user.click(within(tiers).getByRole("button", { name: "Next page" }));
      expect(within(tiers).getAllByRole("listitem")).toHaveLength(1);
      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Rank progression" }));
      expect(within(dialog).queryByRole("button", { name: /Previous action|Next action/ })).toBeNull();
      await user.hover(within(dialog).getByRole("button", { name: "Mossback details" }));
      expect((await screen.findByRole("tooltip")).textContent).toContain("Rooted");
      const thumbnail = within(dialog).getByRole("button", { name: /^Bramble Bash,/ });
      expect(thumbnail.textContent).toBe("");
      await user.hover(thumbnail);
      expect((await screen.findByRole("tooltip")).textContent).toContain("Deal 6 Nature damage.");
      await user.click(thumbnail);
      const actionDialog = screen.getByRole("dialog", { name: "Bramble Bash details" });
      expect(actionDialog.querySelector(".card-details")).toBeNull();
      const pinned = within(actionDialog).getByRole("button", { name: /^Bramble Bash,/ });
      await user.hover(pinned);
      expect((await screen.findByRole("tooltip")).textContent).toContain("Deal 6 Nature damage.");
      await user.click(within(actionDialog).getByRole("button", { name: "Back" }));
      expect(document.activeElement).toBe(
        within(screen.getByRole("dialog")).getByRole("button", { name: /^Bramble Bash,/ }),
      );
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Back" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener);
      expect(session.store.getState().game).toEqual(game);
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("reveals details with native Tab and restores the current ability after keyboard cycling", async () => {
    localStorage.setItem("fauna.save.v1", encodeSave(run(7)));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Collection" }));
      const opener = screen.getByRole("button", { name: "Inspect Mossback" });
      act(() => opener.focus());
      await user.keyboard("{Enter}");
      expect(document.activeElement).toBe(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Back" }),
      );
      await user.tab();
      expect((await screen.findByRole("tooltip")).textContent).toContain("Rooted");
      await user.tab();
      expect((await screen.findByRole("tooltip")).textContent).toContain("Bramble Bash");
      await user.keyboard("{Enter}");
      await user.tab();
      expect((await screen.findByRole("tooltip")).textContent).toContain("Bramble Bash");
      await user.keyboard("d");
      expect((await screen.findByRole("tooltip")).textContent).toContain("Shelter");
      await user.keyboard("{Escape}");
      expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Shelter,/);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener);
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("preserves final modified effects in direct card inspection and closes with Back", async () => {
    const fixture = produce(teamRun(7, ["briartooth", "emberfox", "stormfin"]), (game) => {
      game.cards[0]!.level = 1;
      game.keywordXP.physical = 20;
      game.talents = ["physical.shield-slam"];
      game.team[0]!.block = 4;
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
      const opener = screen.getByRole("button", { name: /^Thornlash \+1,/ });
      act(() => opener.focus());
      await user.keyboard("i");
      const dialog = screen.getByRole("dialog", { name: "Thornlash details" });
      expect(dialog.querySelector(".card-details")).toBeNull();
      await user.tab();
      expect((await screen.findByRole("tooltip")).textContent).toContain("Deal 12 Physical damage.");
      await user.click(within(dialog).getByRole("button", { name: "Back" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener);
      expect(session.store.getState().game).toEqual(fixture);
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("keeps enemy battle state separate from its species kit in hover details", async () => {
    localStorage.setItem("fauna.save.v1", JSON.stringify(run(7)));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const game = session.store.getState().game;
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Continue" }));
      await user.click(screen.getByRole("button", { name: "Inspect Bramble Imp" }));
      const dialog = screen.getByRole("dialog", { name: "Bramble Imp" });
      expect(dialog.querySelector(".card-details")).toBeNull();
      await user.hover(within(dialog).getByRole("button", { name: "Bramble Imp details" }));
      const tooltip = await screen.findByRole("tooltip");
      const enemy = game.battle!.enemies.find((entry) => entry.name === "Bramble Imp")!;
      expect(tooltip.textContent).not.toContain(`${enemy.health}/${enemy.maxHealth} health`);
      expect(tooltip.textContent).toContain("Thorns 2");
      expect(tooltip.textContent).toContain("Species kit · Briartooth");
      expect(tooltip.textContent).toContain(
        "Start each battle with 2 Thorns. When an attack removes Health, retaliate with current Thorns, then lose 1 stack.",
      );
      expect(tooltip.textContent).not.toContain("Thornlash");
      expect(session.store.getState().game).toEqual(game);
    } finally {
      cleanup();
      await session.dispose();
    }
  });
});

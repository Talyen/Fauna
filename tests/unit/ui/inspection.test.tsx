import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { produce } from "immer";
import { CARDS, definition, species } from "../../../src/game/content";
import { encodeSave } from "../../../src/game/save";
import { enemyInspectionValue } from "../../../src/game/ability-rules";
import { freshCombat } from "../../../src/game/combat/index";
import { ActionDetails, CreatureDetails } from "../../../src/ui/shared/cards/card-details";
import { Inspector } from "../../../src/ui/inspection/inspection";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { run, teamRun } from "../../support/game";

screenTestEnvironment({ visible: true });

describe("artwork-first inspection", () => {
  it("keeps named Legendary tooltips to the name and passive without rarity or kit labels", () => {
    const creature = species("oathara");
    const { container } = render(<CreatureDetails kind="oathara" name="The Wanderer" />);
    expect(container.textContent).toBe(
      `The Wanderer${creature.trait}${creature.passiveTiers[0].description}`,
    );
  });

  it("inspects every starter without committing and recruits only through the chosen offer", async () => {
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Play" }));
      const game = session.store.getState().game;
      for (const [slot, kind] of game.starterOffers.entries()) {
        const creature = species(kind);
        const opener = screen.getByRole("button", { name: `Inspect ${creature.name}` });
        await user.hover(opener);
        const tooltip = await screen.findByRole("tooltip");
        expect(tooltip.textContent).toContain(creature.trait);
        for (const action of CARDS.filter((entry) => entry.species === kind)) {
          expect(tooltip.textContent).not.toContain(action.name);
          expect(tooltip.textContent).not.toContain(`${action.cost} Mana`);
        }
        await user.click(opener);
        const dialog = screen.getByRole("dialog", { name: creature.name });
        expect(within(dialog).getByRole("heading", { name: creature.name })).toBeTruthy();
        expect(dialog.querySelector(".creature-card")).toBeNull();
        expect(
          within(dialog).getByRole("region", { name: "Abilities" }).querySelectorAll("img"),
        ).toHaveLength(3);
        expect(within(dialog).queryByRole("button", { name: "Back" })).toBeNull();
        expect(within(dialog).getByRole("button", { name: "Close inspection" })).toBeTruthy();
        expect(within(dialog).getByRole("region", { name: "Trait" }).textContent).toContain(
          creature.passiveTiers[0].description,
        );
        expect(
          within(dialog).getByRole("img", { name: "0 of 5 stars" }).querySelectorAll("svg"),
        ).toHaveLength(5);
        expect(dialog.querySelectorAll('[data-earned="true"]')).toHaveLength(0);
        expect(within(dialog).queryByRole("button", { name: /Choose|Recruit|Rank progression/ })).toBeNull();
        if (slot === 0) await user.keyboard("{Escape}");
        else if (slot === 1) await user.click(screen.getByRole("button", { name: "Close inspection" }));
        else await user.click(document.querySelector<HTMLElement>(".inspection-overlay")!);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(opener);
        expect(session.store.getState().game).toBe(game);
      }
      const kind = game.starterOffers.at(-1)!;
      await user.click(screen.getByRole("button", { name: `Recruit ${species(kind).name}` }));
      expect(session.store.getState().game.selected).toEqual([kind]);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(session.store.getState().game.phase).toBe("teamSelection");
      await user.click(screen.getByRole("button", { name: "Combat" }));
      expect(session.store.getState().game.phase).toBe("battle");
      expect(screen.getByRole("region", { name: "Enemy row" })).toBeTruthy();
      await session.flush();
      expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).phase).toBe("battle");
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("updates passive rules and stars together without stale ranks or gameplay commands", async () => {
    const initial = run(7);
    localStorage.setItem("fauna.save.v1", encodeSave(initial));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const store = createStore(() => session.store.getState());
    const command = vi.spyOn(session, "command");
    try {
      render(
        <TooltipProvider>
          <Inspector
            item={{ species: "mossguard" }}
            session={{ ...session, store }}
            controls={{ current: null }}
            onClose={() => {}}
          />
        </TooltipProvider>,
      );
      const details = render(<CreatureDetails progression={initial} kind="mossguard" name="Guardian" />);
      // Reuse mounted consumers and return to rank zero to expose stale progression and accumulated stars.
      for (const rank of [0, 3, 5, 0]) {
        const game = produce(initial, (draft) => {
          draft.discovery.recruited.mossguard = rank + 1;
        });
        act(() => store.setState({ game }));
        details.rerender(<CreatureDetails progression={game} kind="mossguard" name="Guardian" />);
        const stars = screen.getByRole("img", { name: `${rank} of 5 stars` });
        expect(stars.querySelectorAll("svg")).toHaveLength(5);
        expect(stars.querySelectorAll('[data-earned="true"]')).toHaveLength(rank);
        const rules = species("mossguard").passiveTiers[rank]!.description;
        expect(screen.getByRole("region", { name: "Trait" }).textContent).toContain(rules);
        expect(details.container.textContent).toBe(`GuardianOvergrowth${rules}`);
        expect(details.container.querySelector(".effect-shine-icon")).toBeTruthy();
        for (const selector of [".creature-trait-name .effect-shine-text", ".effect-shine-icon-fill"])
          expect(details.container.querySelector(selector)?.getAttribute("style")).toContain(
            "--keyword-block",
          );
        expect(store.getState().game).toBe(game);
      }
      expect(command).not.toHaveBeenCalled();
      await session.flush();
      expect(localStorage.getItem("fauna.save.v1")).toBe(encodeSave(initial));
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("uses the shared inspector for Collection with base abilities, current stars and nested return focus", async () => {
    localStorage.setItem(
      "fauna.save.v1",
      encodeSave(
        produce(run(7), (draft) => {
          draft.discovery.recruited.mossguard = 4;
          draft.cards[0]!.level = 1;
          draft.keywordXP.stun = 100;
          draft.keywordXP.burn = 10;
          draft.talents = ["burn.flashpoint"];
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
      expect(opener.textContent).toBe("");
      await user.hover(opener);
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip.textContent).toContain("Mossguard");
      expect(tooltip.textContent).toContain("Retain 40% more Block between turns");
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(opener);
      const dialog = screen.getByRole("dialog", { name: "Mossguard" });
      expect(within(dialog).getByRole("heading", { name: "Mossguard" })).toBeTruthy();
      expect(within(dialog).getByRole("region", { name: "Trait" }).textContent).toContain(
        "Retain 40% more Block between turns",
      );
      expect(within(dialog).getByRole("img", { name: "3 of 5 stars" })).toBeTruthy();
      expect(within(dialog).queryByRole("tab")).toBeNull();
      for (const card of CARDS.filter((c) => c.species === "mossguard")) {
        const ability = within(dialog).getByRole("button", { name: new RegExp(`^${card.name},`) });
        expect(ability.getAttribute("aria-label")).toContain(`${card.cost} mana`);
        expect(ability.textContent).toBe("");
      }
      const stomp = within(dialog).getByRole("button", { name: /^Rooted Stomp,/ });
      expect(stomp.getAttribute("aria-label")).toContain("Deal 2 Stun damage to all enemies");
      await user.click(stomp);
      expect(screen.getByRole("dialog", { name: "Rooted Stomp details" })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close inspection" }));
      await user.keyboard("d");
      expect(screen.getByRole("dialog", { name: "Moss Renewal details" })).toBeTruthy();
      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(
        within(screen.getByRole("dialog")).getByRole("button", { name: /^Moss Renewal,/ }),
      );
      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(opener);
      await user.click(screen.getByRole("button", { name: "Inspect Emberback" }));
      expect(screen.getByRole("button", { name: /^Furnace Breath,/ }).getAttribute("aria-label")).toContain(
        "1 mana",
      );
      await user.keyboard("{Escape}");
      expect(session.store.getState().game).toBe(game);
    } finally {
      cleanup();
      await session.dispose();
    }
  });

  it("keeps modified hand rules and only the enemy passive on hover without battle inspection", async () => {
    const fixture = produce(teamRun(7, ["emberback", "reedstag", "prismram"]), (game) => {
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
      expect(tooltip.textContent).not.toContain("Thorns 2");
      expect(tooltip.textContent).toBe(
        `${enemy.name}${species(enemy.species).trait}${species(enemy.species).passiveTiers[0].description}`,
      );
      expect(tooltip.textContent).not.toContain(`${enemy.health}/${enemy.maxHealth}`);
      expect(tooltip.textContent).not.toContain("Ember Charge");
      expect(session.store.getState().game).toBe(before);
    } finally {
      cleanup();
      await session.dispose();
    }
  });
});

it("shows room-scaled enemy primary and supplemental effects using combat values", () => {
  const authored = definition("captoad-guard");
  const enemy = { species: "captoad" as const, power: 1.5, combat: freshCombat() };
  render(
    <ActionDetails
      card={{ id: "inspect", definitionId: authored.id, ownerId: "enemy-0", level: 0 }}
      ownerName="Captoad"
      enemy
      enemyPower={enemy.power}
      enemyValue={enemyInspectionValue(enemy, authored)}
    />,
  );
  expect(document.querySelector(".action-effect")?.textContent).toBe("Gain 5 Block; Restore 5 Health");
});

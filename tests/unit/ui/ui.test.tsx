import { screenTestEnvironment } from "../../support/ui";
import { playPreviewModel } from "../../../src/ui/battle/play-preview-model";
import { TargetPreview } from "../../../src/ui/battle/target-preview";
import { species } from "../../../src/game/content";
import { freshCombat, ensureCombat, hit } from "../../../src/game/combat/index";
import { ActionCard } from "../../../src/ui/shared/cards/cards";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { produce } from "immer";
import { createGame } from "../../../src/game/engine";
import { authoredPack, accept, run, teamRun, starterJourney, winBattle } from "../../support/game";
import { encounterSource } from "../../../src/game/encounters";

// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
screenTestEnvironment();

describe("player interface", () => {
  it("keeps overflow invisible and unplayable while filling a hand slot after a play", async () => {
    const game = produce(run(), (d) => {
      d.battle!.hand = d.cards.slice(0, 6).map((card) => card.id);
      d.battle!.buffer = d.cards.slice(6).map((card) => card.id);
      d.battle!.draw = [];
      d.battle!.discard = [];
    });
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(document.querySelectorAll(".hand .action-card")).toHaveLength(6);
    expect(screen.queryByText(/buffer/i)).toBeNull();
    await user.click(document.querySelector<HTMLButtonElement>('.hand .action-card[data-effect="attack"]')!);
    expect(session.store.getState().game.battle!.hand).toContain(game.battle!.buffer[0]);
    expect(session.store.getState().game.battle!.buffer).toHaveLength(2);
    expect(document.querySelectorAll(".hand .action-card")).toHaveLength(6);
    await user.click(screen.getByRole("button", { name: "End turn" }));
    expect(session.store.getState().game.battle!.buffer).toEqual([]);
    expect(document.querySelectorAll(".hand .action-card")).toHaveLength(6);
    await session.dispose();
  });
  it("shows earnings before recruitment without committing or granting rewards again", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const started = starterJourney(7, "emberback");
    const battle = produce(accept(started, { type: "beginBattle" }), (d) => {
      d.keywordXP.physical = 23;
    });
    const game = winBattle(battle);
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Victory", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Choose a Recruit" })).toBeNull();
    expect(document.querySelectorAll(".recruit-options .creature-card")).toHaveLength(0);
    expect(screen.getByText("20", { selector: ".sr-only" })).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Last battle earnings").querySelector(".animated-number .number-value")
          ?.textContent,
      ).toBe("20"),
    );
    const progress = screen.getByRole("progressbar", { name: "Physical level 2 progress" });
    expect(progress.getAttribute("aria-valuenow")).toBe("14");
    expect(progress.getAttribute("aria-valuemax")).toBe("30");
    expect(screen.queryByText(/keyword XP|talent point|4 \/ 40 XP/)).toBeNull();
    const committed = session.store.getState().game;
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(session.store.getState().game).toBe(committed);
    expect(screen.queryByLabelText("Last battle earnings")).toBeNull();
    expect(screen.getByRole("heading", { name: "Choose a Recruit", level: 1 })).toBeTruthy();
    expect(document.querySelectorAll(".recruit-options .creature-card")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    const incoming = game.reward!.recruits[0]!;
    const offer = screen.getByRole("button", { name: `Recruit ${species(incoming).name}` });
    await waitFor(() => expect(document.activeElement).toBe(offer));
    const artwork = screen.getByRole("button", { name: `Inspect ${species(incoming).name}` });
    await user.click(artwork);
    expect(screen.getByRole("dialog", { name: species(incoming).name })).toBeTruthy();
    expect(session.store.getState().game).toBe(committed);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(artwork));
    await user.click(offer);
    expect(session.store.getState().game.discovery.recruited[incoming]).toBe(
      (game.discovery.recruited[incoming] ?? 0) + 1,
    );
    expect(session.store.getState().game.phase).toBe("teamSelection");
    expect(screen.queryByRole("heading", { name: "Choose a Boon" })).toBeNull();
    await session.dispose();
  });
  it("shows journey gains only when ending the journey and preserves permanent gains", async () => {
    const started = accept(
      accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }),
      { type: "start" },
    );
    const battle = produce(accept(started, { type: "beginBattle" }), (d) => {
      d.battleXP = { nature: 24 };
    });
    const game = accept(battle, { type: "abandon" });
    localStorage.setItem("fauna.save.v1", JSON.stringify(battle));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: "End journey" }));
    expect(screen.getByRole("heading", { name: "Returned home" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.getByLabelText("Journey gains").textContent).toContain("Lv 2");
    const progress = screen.getByRole("progressbar", { name: "Nature level 2 progress" });
    expect(progress.getAttribute("aria-valuenow")).toBe("14");
    expect(progress.getAttribute("aria-valuemax")).toBe("30");
    expect(screen.queryByText(/\+24 XP|talent point|4 \/ 40 XP/)).toBeNull();
    expect(screen.queryByLabelText("Final team")).toBeNull();
    expect(screen.queryByLabelText("New creature unlocks")).toBeNull();
    expect(screen.queryByLabelText("Boons collected")).toBeNull();
    expect(screen.queryByText(/battles won/)).toBeNull();
    expect(session.store.getState().game).toEqual(game);
    await user.click(screen.getByRole("button", { name: "Main menu" }));
    expect(screen.queryByRole("button", { name: "Journey results" })).toBeNull();
    cleanup();
    render(<App session={session} />);
    expect(screen.queryByRole("button", { name: "Journey results" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Returned home" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(session.store.getState().game.journey).toBeNull();
    expect(session.store.getState().game.keywordXP.nature).toBe(24);
    await session.dispose();
  });
  it.each([0, 3, 7])("starts encounter %s directly without an enemy preview", async (encounter) => {
    const game = produce(
      accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
        type: "start",
      }),
      (draft) => {
        draft.encounter = encounter;
        draft.journey!.victories = draft.encounter;
        draft.expedition!.pack = authoredPack(draft.encounter);
        draft.journey!.victories = encounter;
      },
    );
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("region", { name: "Enemy row" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Inspect / })).toBeNull();
    const enter = screen.getByRole("button", {
      name: encounter === 0 ? "Combat" : `Boss: ${encounterSource(game).enemies[0]!.name}`,
    });
    expect(screen.getByRole("heading", { name: `Encounter ${encounter + 1} of 8` })).toBeTruthy();
    if (encounter !== 0) {
      const boss = encounterSource(game).enemies[0]!;
      expect(screen.getByRole("heading", { name: boss.name })).toBeTruthy();
      await user.hover(enter);
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip.textContent).toContain(boss.name);
      expect(tooltip.textContent).toContain(species(boss.species).passiveTiers[0].description);
      await user.unhover(enter);
      expect(session.store.getState().game).toEqual(game);
    }
    enter.focus();
    await user.keyboard("i");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(session.store.getState().game).toEqual(game);
    await user.keyboard("{Enter}");
    expect(session.store.getState().game.phase).toBe("battle");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "Enemy row" })).toBeTruthy();
    expect(session.store.getState().game.battle!.enemies.map((enemy) => enemy.species)).toEqual(
      encounterSource(game).enemies.map((enemy) => enemy.species),
    );
    await session.dispose();
  });
  it("starts a resumed completed draft without requiring another confirmation", async () => {
    const fresh = createGame(7);
    const chosen = fresh.starterOffers[0]!;
    const drafted = accept(fresh, { type: "draft", species: chosen });
    localStorage.setItem("fauna.save.v1", JSON.stringify(drafted));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue" }));
    expect(session.store.getState().game.phase).toBe("teamSelection");
    expect(
      [...session.store.getState().game.team, ...session.store.getState().game.reserves].map(
        (unit) => unit.species,
      ),
    ).toEqual([chosen]);
    expect(screen.queryByRole("button", { name: "Begin journey" })).toBeNull();
    await session.flush();
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).phase).toBe("teamSelection");
    await session.dispose();
  });
  it("begins a later journey after selecting every available unique starter", async () => {
    const fresh = createGame(7);
    const starter = fresh.starterOffers[0]!;
    const started = accept(accept(fresh, { type: "draft", species: starter }), { type: "start" });
    const returned = accept(started, { type: "abandon" });
    localStorage.setItem("fauna.save.v1", JSON.stringify(returned));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.queryByRole("button", { name: "Begin journey" })).toBeNull();
    expect(session.store.getState().game.phase).toBe("draft");
    await user.click(screen.getByRole("button", { name: `Recruit ${species(starter).name}` }));
    expect(session.store.getState().game.phase).toBe("teamSelection");
    expect(session.store.getState().game.team.map((unit) => unit.species)).toEqual([starter]);
    await session.dispose();
  });
  it("keeps creature details focused on identity and rules through pointer, keyboard and replacement inspection", async () => {
    const game = produce(teamRun(7, ["mossguard", "emberback", "prismram"]), (d) => {
      d.team[0]!.health = 7;
      d.team[1]!.health = 19;
      d.team[1]!.block = 4;
      d.discovery.encountered.push("reedstag");
      d.discovery.recruited.reedstag = 1;
      d.reserves.push({
        id: "reserve-copy",
        species: "reedstag",
        health: 11,
        block: 2,
        combat: freshCombat(),
        attacked: false,
      });
    });
    const user = userEvent.setup();
    const inspect = async (creature: HTMLElement, name: string) => {
      for (const input of ["hover", "keyboard"]) {
        if (input === "hover") await user.hover(creature);
        else {
          await user.tab();
          act(() => creature.focus());
        }
        await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain(name));
        expect(screen.getByRole("tooltip").textContent).not.toMatch(/\d+\/\d+ health|\d+ block/i);
        if (input === "hover")
          await user.hover(
            creature.closest('[role="dialog"]') ?? screen.getByRole("main", { name: "Battlefield" }),
          );
      }
    };
    for (const fixture of [
      game,
      produce(game, (draft) => {
        draft.team[2]!.health = 0;
      }),
    ]) {
      localStorage.setItem("fauna.save.v1", JSON.stringify(fixture));
      const session = createSession(createBrowserPlatform(localStorage), 7);
      await session.load();
      const view = render(<App session={session} />);
      try {
        await user.click(screen.getByRole("button", { name: "Continue" }));
        if (fixture.team[2]!.health > 0) {
          for (const [id, name, block] of [
            ["ally-0", "Mossguard", 0],
            ["ally-1", "Emberback", 4],
          ] as const) {
            const frame = document.querySelector<HTMLElement>(`.player-row [data-actor-id="${id}"]`)!;
            await inspect(frame.querySelector<HTMLButtonElement>("button")!, name);
            if (block) expect(frame.querySelector(`[aria-label="Block ${block}"]`)).toBeTruthy();
          }
        } else {
          expect(screen.queryByRole("button", { name: "Swap" })).toBeNull();
          await inspect(screen.getByRole("button", { name: "Reedstag, backup" }), "Reedstag");
          expect(
            document.querySelector('[data-actor-id="reserve-copy"] [aria-label="Block 2"]'),
          ).toBeTruthy();
        }
        expect(session.store.getState().game).toEqual(fixture);
      } finally {
        view.unmount();
        await session.dispose();
      }
    }
  });
});
it("allows play and explains unavailable saving when browser storage access is denied", async () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  try {
    const session = createSession(createBrowserPlatform());
    await session.load();
    render(<App session={session} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Progress cannot be saved");
    expect(session.store.getState().loadFailed).toBe(true);
    await session.dispose();
  } finally {
    Object.defineProperty(window, "localStorage", original);
  }
});

it("previews Block depletion, exact health loss and knockout without visible HP totals", () => {
  const before = produce(run(), (d) => {
    d.team[0]!.health = 3;
    d.team[0]!.block = 5;
    d.battle!.enemies.forEach((enemy, i) => {
      enemy.targetId = "ally-0";
      enemy.power = 8;
      if (i > 0) enemy.health = 0;
    });
  });
  const after = produce(before, (d) => {
    ensureCombat(d.team[0]!).deathDoorUsed = true;
    d.rng = 1;
    hit(d, d.battle!.enemies[0]!, d.team[0]!, 8, "nature", []);
  });
  const result = { accepted: true as const, state: after, events: [] };
  render(<TargetPreview forecast={playPreviewModel(before, result).units.get("ally-0")} />);
  expect(screen.getByLabelText("Block 5 to 0")).toBeTruthy();
  expect(screen.getByLabelText("Knockout")).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Health" }).getAttribute("aria-valuenow")).toBe("0");
  expect(document.querySelector(".health-number")).toBeNull();
});

it("keeps unavailable cards inspectable and denies activation without explanatory text", async () => {
  const game = run(),
    click = vi.fn(),
    deny = vi.fn(),
    inspect = vi.fn();
  render(
    <TooltipProvider>
      <ActionCard
        card={game.cards[0]!}
        ownerName="Mossguard"
        disabled
        onClick={click}
        onDenied={deny}
        onInspect={inspect}
      />
    </TooltipProvider>,
  );
  const button = screen.getByRole("button");
  await userEvent.click(button);
  expect(deny).toHaveBeenCalledWith(button);
  expect(click).not.toHaveBeenCalled();
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(screen.queryByText("Not enough mana.")).toBeNull();
  await userEvent.pointer({ target: button, keys: "[MouseRight]" });
  expect(inspect).toHaveBeenCalledOnce();
});

import { TargetPreview } from "../../../src/ui/battle/target-preview";
import { species, BOONS } from "../../../src/game/content";
import { freshCombat, combat, hit } from "../../../src/game/combat/index";
import { assetUrl } from "../../../src/ui/shared/assets";
import { ActionCard } from "../../../src/ui/shared/cards/cards";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { produce } from "immer";
import { createGame } from "../../../src/game/engine";
import {
  authoredPack,
  accept,
  run,
  teamRun,
  starterJourney,
  winBattle,
  bossReward,
  fullRosterReward,
} from "../../support/game";
import { encounterSource } from "../../../src/game/encounters";

// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { gamepadActions } from "../../../src/ui/shared/navigation/input";
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
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
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
  it("offers illustrated portrait boon cards with external names and commits the chosen boon", async () => {
    const game = bossReward();
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Choose a Boon", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    for (const id of game.reward!.boons) {
      const boon = BOONS.find((entry) => entry.id === id)!;
      const card = screen.getByRole("button", { name: `Choose ${boon.name}` });
      const image = card.querySelector("img")!;
      expect(image.getAttribute("src")).toBe(assetUrl(`boon.${id}`));
      expect(image.getAttribute("width")).toBe("600");
      expect(image.getAttribute("height")).toBe("800");
      expect(card.textContent).toBe("");
      expect(screen.getByRole("heading", { name: boon.name })).toBeTruthy();
    }
    const chosen = game.reward!.boons[0]!;
    await user.click(
      screen.getByRole("button", { name: `Choose ${BOONS.find((entry) => entry.id === chosen)!.name}` }),
    );
    expect(session.store.getState().game.boons).toEqual([chosen]);
    expect(session.store.getState().game.phase).toBe("teamSelection");
    await session.dispose();
  });
  it("shows earnings before recruitment without committing or granting rewards again", async () => {
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
    await user.click(screen.getByRole("button", { name: /^Recruit / }));
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
  it("drafts through accessible buttons and commits the battle before feedback", async () => {
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.queryByRole("button", { name: "Begin journey" })).toBeNull();
    const chosen = session.store.getState().game.starterOffers[0]!;
    const name = species(chosen).name;
    await user.click(screen.getByRole("button", { name: `Inspect ${name}` }));
    expect(session.store.getState().game.selected).toEqual([]);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: `Recruit ${name}` }));
    expect(session.store.getState().game.selected).toEqual([chosen]);
    expect(session.store.getState().game.phase).toBe("teamSelection");
    await user.click(screen.getByRole("button", { name: "Combat" }));
    expect(session.store.getState().game.phase).toBe("battle");
    expect(screen.getByRole("region", { name: "Enemy row" })).toBeTruthy();
    await act(async () => {
      await session.flush();
    });
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).phase).toBe("battle");
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
    expect(session.store.getState().game.roster).toEqual([chosen]);
    expect(screen.queryByRole("button", { name: "Begin journey" })).toBeNull();
    await session.flush();
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).phase).toBe("teamSelection");
    await session.dispose();
  });
  it("requires all three collection recruits before beginning a later journey", async () => {
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
    for (let round = 0; round < 3; round++) {
      expect(session.store.getState().game.phase).toBe("draft");
      expect(screen.getByRole("heading", { name: "Choose your starter" })).toBeTruthy();
      await user.click(screen.getAllByRole("button", { name: `Recruit ${species(starter).name}` })[0]!);
      expect(session.store.getState().game.selected).toHaveLength(round + 1);
      expect(screen.queryByRole("dialog")).toBeNull();
    }
    expect(session.store.getState().game.phase).toBe("teamSelection");
    expect(session.store.getState().game.team).toHaveLength(3);
    await session.dispose();
  });
  it.each(["hover", "keyboard"])(
    "shows each creature copy with current Block and no Health totals using %s",
    async (input) => {
      const game = produce(teamRun(7, ["mossguard", "mossguard", "prismram"]), (d) => {
        d.team[0]!.health = 7;
        d.team[1]!.health = 19;
        d.team[1]!.block = 4;
        d.roster.push("mossguard");
        d.reserves.push({
          id: "reserve-copy",
          species: "mossguard",
          health: 11,
          block: 2,
          combat: freshCombat(),
          attacked: false,
        });
      });
      localStorage.setItem("fauna.save.v1", JSON.stringify(game));
      let session = createSession(createBrowserPlatform(localStorage), 7);
      await session.load();
      render(<App session={session} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Continue" }));
      if (input === "keyboard") await user.tab();
      for (const [id, block] of [
        ["ally-0", 0],
        ["ally-1", 4],
      ] as const) {
        const creature = document.querySelector<HTMLButtonElement>(
          `.player-row [data-actor-id="${id}"] button`,
        )!;
        if (input === "hover") await user.hover(creature);
        else act(() => creature.focus());
        const tooltip = (await screen.findByRole("tooltip")).textContent!;
        expect(tooltip).not.toMatch(/\d+\/\d+ health/i);
        if (block) expect(tooltip).toContain(`${block} block`);
        else expect(tooltip).not.toMatch(/\d+ block/);
        if (input === "hover") await user.unhover(creature);
      }
      const fallen = produce(game, (draft) => {
        draft.team[2]!.health = 0;
      });
      cleanup();
      await session.dispose();
      localStorage.setItem("fauna.save.v1", JSON.stringify(fallen));
      session = createSession(createBrowserPlatform(localStorage), 7);
      await session.load();
      render(<App session={session} />);
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(screen.queryByRole("button", { name: "Swap" })).toBeNull();
      const reserve = screen.getByRole("button", { name: "Mossguard, backup" });
      if (input === "hover") await user.hover(reserve);
      else {
        await user.tab();
        act(() => reserve.focus());
      }
      const reserveTooltip = (await screen.findByRole("tooltip")).textContent!;
      expect(reserveTooltip).toContain("2 block");
      expect(reserveTooltip).not.toMatch(/\d+\/\d+ health/i);
      expect(session.store.getState().game).toEqual(fallen);
      await session.dispose();
    },
  );
  it("maps standard controller buttons and sticks to semantic actions", () => {
    const buttons = Array.from({ length: 16 }, (_, i) => ({
      pressed: [0, 2, 3, 12].includes(i),
      touched: false,
      value: 0,
    }));
    expect(gamepadActions({ buttons, axes: [0.8, 0] })).toEqual(["confirm", "inspect", "endTurn", "up"]);
    expect(gamepadActions({ buttons: [], axes: [0.1, -0.1] })).toEqual([]);
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
    combat(d.team[0]!).deathDoorUsed = true;
    d.rng = 1;
    hit(d, d.battle!.enemies[0]!, d.team[0]!, 8, "nature", []);
  });
  const result = { accepted: true as const, state: after, events: [] };
  render(<TargetPreview before={before} result={result} targetId="ally-0" />);
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

it("omits health from creature hover details while retaining block and the passive", async () => {
  const { CreatureDetails } = await import("../../../src/ui/shared/cards/card-details");
  render(<CreatureDetails kind="mossguard" block={4} />);
  expect(screen.getByText("4 block")).toBeTruthy();
  expect(screen.queryByText(/health/i)).toBeNull();
  expect(
    screen.getByText(
      (_, element) =>
        element?.tagName === "P" && element.textContent === "Retain 10% more Block between turns",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Rooted Stomp/)).toBeNull();
  expect(screen.queryByText(/Shelter/)).toBeNull();
  expect(screen.queryByText(/Moss Renewal/)).toBeNull();
});

it("keeps the team after committing a recruit to Collection and resumes the result", async () => {
  const game = fullRosterReward();
  localStorage.setItem("fauna.save.v1", JSON.stringify(game));
  const session = createSession(createBrowserPlatform(localStorage), 42);
  await session.load();
  render(<App session={session} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Recruit Emberback" }));
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  await session.flush();
  const next = session.store.getState().game;
  expect(next.phase).toBe("teamSelection");
  expect(next.roster).toEqual(game.roster);
  expect(next.discovery.recruited.emberback).toBe((game.discovery.recruited.emberback ?? 0) + 1);
  expect(screen.queryByRole("heading", { name: "Choose a Recruit" })).toBeNull();
  await session.dispose();
  const resumed = createSession(createBrowserPlatform(localStorage), 42);
  await resumed.load();
  expect(resumed.store.getState().game.phase).toBe("teamSelection");
  expect(resumed.store.getState().game.roster).toEqual(game.roster);
  await resumed.dispose();
});

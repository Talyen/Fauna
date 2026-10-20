import { ActionCard } from "../../src/ui/cards";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { accept, run, winBattle, bossReward } from "./helpers";
import { encounterSource, location } from "../../src/game/destinations";
import { RELICS } from "../../src/game/progression";
import { TargetPreview } from "../../src/ui/target-preview";
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/ui/App";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { gamepadActions } from "../../src/ui/input";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("player interface", () => {
  it("keeps overflow invisible and unplayable while filling a hand slot after a play", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const game = produce(run(), (d) => {
      d.battle!.hand = d.cards.slice(0, 5).map((card) => card.id);
      d.battle!.buffer = d.cards.slice(5).map((card) => card.id);
      d.battle!.draw = [];
      d.battle!.discard = [];
    });
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(document.querySelectorAll(".hand .action-card")).toHaveLength(5);
    expect(screen.queryByText(/buffer/i)).toBeNull();
    await user.click(document.querySelector<HTMLButtonElement>('.hand .action-card[data-effect="attack"]')!);
    await user.click(document.querySelector<HTMLButtonElement>(".enemy-row .creature-card")!);
    expect(session.store.getState().game.battle!.hand).toContain(game.battle!.buffer[0]);
    expect(session.store.getState().game.battle!.buffer).toHaveLength(3);
    expect(document.querySelectorAll(".hand .action-card")).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "End turn", exact: true }));
    expect(session.store.getState().game.battle!.buffer).toEqual([]);
    expect(document.querySelectorAll(".hand .action-card")).toHaveLength(5);
    await session.dispose();
  });
  it("offers blank portrait relic cards with external names and commits the chosen relic", async () => {
    const game = bossReward();
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(screen.getByRole("heading", { name: "Reward", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue", exact: true })).toBeNull();
    for (const id of game.reward!.relics) {
      const relic = RELICS.find((entry) => entry.id === id)!;
      const card = screen.getByRole("button", { name: `Choose ${relic.name}`, exact: true });
      const image = card.querySelector("img")!;
      expect(image.getAttribute("src")).toBe("./art/relic-placeholder.svg");
      expect(image.getAttribute("width")).toBe("600");
      expect(image.getAttribute("height")).toBe("800");
      expect(card.textContent).toBe("");
      expect(screen.getByRole("heading", { name: relic.name, exact: true })).toBeTruthy();
    }
    const chosen = game.reward!.relics[0]!;
    await user.click(
      screen.getByRole("button", { name: `Choose ${RELICS.find((entry) => entry.id === chosen)!.name}` }),
    );
    expect(session.store.getState().game.relics).toEqual([chosen]);
    expect(session.store.getState().game.phase).toBe("teamSelection");
    await session.dispose();
  });
  it("shows compact battle earnings beside recruitment without an acknowledgement screen", async () => {
    const started = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
    const game = winBattle(accept(started, { type: "beginBattle" }));
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(screen.getByRole("heading", { name: "Reward", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeTruthy();
    expect(document.querySelectorAll(".recruit-options .creature-card")).toHaveLength(3);
    expect(screen.getByLabelText("Last battle earnings").textContent).toContain("+20 currency");
    expect(screen.queryByRole("button", { name: "Continue", exact: true })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Skip", exact: true }));
    expect(session.store.getState().game.phase).toBe("teamSelection");
    expect(screen.queryByRole("heading", { name: "Choose a relic" })).toBeNull();
    await session.dispose();
  });
  it("reopens saved journey gains and starts fresh without losing permanent gains", async () => {
    const started = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
    const battle = produce(accept(started, { type: "beginBattle" }), (d) => {
      d.battleXP = { nature: 24 };
    });
    const game = accept(battle, { type: "abandon" });
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Journey results", exact: true }));
    expect(screen.getByRole("heading", { name: "Returned home" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New journey", exact: true })).toBeNull();
    expect(screen.getByLabelText("Journey gains").textContent).toContain("Lv 2");
    const progress = screen.getByRole("progressbar", { name: "Nature level 2 progress" });
    expect(progress.getAttribute("aria-valuenow")).toBe("4");
    expect(progress.getAttribute("aria-valuemax")).toBe("40");
    expect(screen.queryByText(/\+24 XP|talent point|4 \/ 40 XP/)).toBeNull();
    expect(screen.queryByLabelText("Final team")).toBeNull();
    expect(screen.queryByLabelText("New creature unlocks")).toBeNull();
    expect(screen.queryByLabelText("Relics collected")).toBeNull();
    expect(screen.queryByText(/battles won/)).toBeNull();
    expect(session.store.getState().game).toEqual(game);
    await user.click(screen.getByRole("button", { name: "Main menu", exact: true }));
    expect(screen.getByRole("button", { name: "Journey results" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "New journey", exact: true }));
    expect(session.store.getState().game.journey).toBeNull();
    expect(session.store.getState().game.keywordXP.nature).toBe(24);
    await session.dispose();
  });
  it("browses a destination, enemy and action in one dialog without committing or rerolling", async () => {
    const game = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
    const destination = game.expedition!.offers[0]!.location;
    const pack = encounterSource(game, destination);
    await user.click(screen.getByRole("button", { name: `Inspect ${location(destination)!.name}` }));
    await user.click(screen.getByRole("button", { name: `Inspect ${pack.enemies[0]!.name}` }));
    await user.click(document.querySelector<HTMLButtonElement>(".inspection-thumbnails button")!);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Begin battle" })).toBeTruthy();
    expect(session.store.getState().game).toEqual(game);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(session.store.getState().game).toEqual(game);
    await session.dispose();
  });
  it("drafts through accessible buttons and commits the battle before feedback", async () => {
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "New journey" }));
    const enter = screen.getByRole("button", { name: "Begin journey" });
    expect((enter as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Inspect Mossback" }));
    expect(session.store.getState().game.selected).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Choose Mossback" }));
    expect(session.store.getState().game.selected).toEqual(["mossback"]);
    await user.click(enter);
    expect(session.store.getState().game.phase).toBe("teamSelection");
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    await user.click(screen.getAllByRole("button", { name: /^Inspect / })[0]!);
    await user.click(screen.getByRole("button", { name: "Begin battle" }));
    expect(session.store.getState().game.phase).toBe("battle");
    expect(screen.getByRole("region", { name: "Enemy row" })).toBeTruthy();
    await act(async () => {
      await session.flush();
    });
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).phase).toBe("battle");
    await session.dispose();
  });
  it("maps standard controller buttons and sticks to semantic actions", () => {
    const buttons = Array.from({ length: 16 }, (_, i) => ({
      pressed: [0, 2, 3, 12].includes(i),
      touched: false,
      value: 0,
    }));
    expect(gamepadActions({ buttons, axes: [0.8, 0] })).toEqual([
      "confirm",
      "inspect",
      "endTurn",
      "right",
      "up",
    ]);
    expect(gamepadActions({ buttons: [], axes: [0.1, -0.1] })).toEqual([]);
  });
});
it("opens a recoverable error screen when browser storage access itself is denied", async () => {
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
    expect(screen.getByRole("button", { name: "Retry loading" })).toBeTruthy();
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
      enemy.damage = 8;
      if (i > 0) enemy.health = 0;
    });
  });
  const result = dispatch(before, { type: "endTurn" });
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
        ownerName="Mossback"
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

it("keeps creature hover details compact while retaining health, effects and the passive", async () => {
  const { CreatureDetails } = await import("../../src/ui/card-details");
  render(<CreatureDetails kind="mossback" health={17} block={4} marks={2} />);
  expect(screen.getByText("17/32 health · 4 block · 2 marks")).toBeTruthy();
  expect(
    screen.getByText(
      (_, element) => element?.tagName === "P" && element.textContent === "Guard cards grant 2 extra block.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Bramble Bash/)).toBeNull();
  expect(screen.queryByText(/Shelter/)).toBeNull();
  expect(screen.queryByText(/Forest Mantle/)).toBeNull();
});

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { BattleScreen } from "../../../src/ui/battle/battle-screen";
import type { Controls } from "../../../src/ui/shared/navigation/input";
import { TargetPreview } from "../../../src/ui/battle/target-preview";
import { assetUrl } from "../../../src/ui/shared/assets";
import { moveFocus } from "../../../src/ui/shared/navigation/input";
import { previewCard } from "../../../src/game/engine";
import { produce } from "immer";
import * as content from "../../../src/game/content";
import { requireBattle, teamRun } from "../../support/game";

beforeEach(() => {
  // Keep chosen-ally targeting covered even though the current kits use self or group guards.
  const original = content.definition;
  vi.spyOn(content, "definition").mockImplementation((id) =>
    id === "prismram-guard"
      ? {
          ...original(id),
          effect: "guard",
          target: undefined,
          value: 6,
          effects: [{ kind: "status", status: "dodge", amount: 10 }],
        }
      : original(id),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  document.documentElement.style.setProperty("--target-denial-duration", "2400ms");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.focus;
});
function fixture() {
  return produce(teamRun(7, ["prismram", "emberback", "pollenmoth"]), (game) => {
    game.battle!.hand = game.cards.map((card) => card.id);
    game.battle!.draw = [];
    game.battle!.mana = 4;
  });
}
function open(game = fixture(), navigation = false) {
  const send = vi.fn(() => true);
  const controls: Controls = { current: null };
  document.documentElement.dataset.focus = navigation ? "visible" : "hidden";
  const view = render(
    <TooltipProvider>
      <BattleScreen
        game={requireBattle(game)}
        send={send}
        controls={controls}
        bursts={[]}
        controller={false}
        navigateFocus={navigation}
        onDenied={vi.fn()}
      />
    </TooltipProvider>,
  );
  const card = (effect: string) =>
    view.container.querySelector<HTMLButtonElement>(`.hand [data-effect="${effect}"]`)!;
  return { ...view, send, controls, card };
}
it("activates Seedling Circle for the whole allied row without requiring a recipient", async () => {
  const game = produce(teamRun(1, ["ringpalm", "mossguard", "prismram"]), (draft) => {
    const circle = draft.cards.find((card) => card.definitionId === "ringpalm-teamProtection")!;
    draft.battle!.hand = [circle.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((card) => card.id !== circle.id).map((card) => card.id);
  });
  const { container, send, card } = open(game);
  await userEvent.click(card("teamProtection"));
  expect(container.querySelectorAll(".player-row [data-active-target]")).toHaveLength(3);
  expect(container.querySelectorAll(".player-row .target-preview")).toHaveLength(3);
  expect(send).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /^Play/ }));
  expect(send.mock.calls).toEqual([[{ type: "play", cardId: game.battle!.hand[0]! }]]);
});
it("mouse selection waits for hover, clears on leave, switches cards, and cancels without commands", async () => {
  const { container, send, card } = open();
  await userEvent.click(card("attack"));
  expect(screen.getByText("Prismram · Choose an enemy")).toBeTruthy();
  expect(container.querySelector(".target-preview")).toBeNull();
  expect(container.querySelector(".target-line")).toBeNull();
  expect(container.querySelectorAll(".enemy-row [data-valid-target]")).toHaveLength(3);
  const enemy = container.querySelector<HTMLButtonElement>(".enemy-row .creature-card")!;
  await userEvent.hover(enemy);
  expect(container.querySelector(".target-preview")).toBeTruthy();
  expect(container.querySelector(".target-line")).toBeTruthy();
  await userEvent.unhover(enemy);
  expect(container.querySelector(".target-preview")).toBeNull();
  await userEvent.click(card("guard"));
  expect(screen.getByText("Prismram · Choose an ally")).toBeTruthy();
  expect(container.querySelectorAll(".player-row [data-valid-target]")).toHaveLength(3);
  expect(container.querySelector(".enemy-row [data-valid-target]")).toBeNull();
  await userEvent.click(card("guard"));
  expect(container.querySelector("[data-selected-card]")?.getAttribute("data-selected-card")).toBe("");
  await userEvent.click(card("attack"));
  fireEvent.pointerDown(container.querySelector("main")!, { button: 0 });
  expect(container.querySelector("[data-selected-card]")?.getAttribute("data-selected-card")).toBe("");
  expect(send).not.toHaveBeenCalled();
});
it("navigation previews and remembers a recipient, cancels back to the card, and activates exactly once", async () => {
  const { container, controls, send, card } = open(fixture(), true);
  fireEvent.click(card("attack"));
  expect(container.querySelector(".target-preview")).toBeTruthy();
  act(() => {
    controls.current!("right");
  });
  const target = document.activeElement as HTMLElement;
  expect(target.closest("[data-actor-id]")?.getAttribute("data-actor-id")).toBe("enemy-1");
  act(() => {
    controls.current!("back");
  });
  expect(document.activeElement).toBe(card("attack"));
  fireEvent.click(card("attack"));
  expect(document.activeElement).toBe(target);
  await userEvent.keyboard("{Enter}");
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith({
    type: "play",
    cardId: card("attack").dataset.cardId,
    targetId: "enemy-1",
  });
  expect(container.querySelector(".target-preview")).toBeNull();
});
it("a sole living recipient still requires activation and team actions preview every living ally", async () => {
  const game = produce(fixture(), (state) => {
    state.battle!.enemies.slice(1).forEach((unit) => {
      unit.health = 0;
    });
  });
  const { container, send, card } = open(game);
  await userEvent.click(card("attack"));
  expect(send).not.toHaveBeenCalled();
  expect(container.querySelectorAll(".enemy-row [data-valid-target]")).toHaveLength(1);
  await userEvent.click(container.querySelector<HTMLButtonElement>(".enemy-row .creature-card")!);
  expect(send).toHaveBeenCalledTimes(1);
  await userEvent.click(card("teamGuard"));
  expect(container.querySelectorAll(".player-row [data-active-target]")).toHaveLength(3);
  expect(container.querySelectorAll(".player-row .target-preview")).toHaveLength(3);
  expect(send).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: /^Play/ }));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1]).toEqual([{ type: "play", cardId: card("teamGuard").dataset.cardId }]);
});
it("explains unavailable Mana and control while leaving state unchanged", async () => {
  const game = produce(fixture(), (state) => {
    state.battle!.mana = 0;
    state.team[1]!.combat!.controlled = "freeze";
    state.team[2]!.combat!.skipped = true;
  });
  const { container, send, card } = open(game);
  await userEvent.click(card("attack"));
  expect(screen.getByText("Not enough Mana.")).toBeTruthy();
  const frozen = container.querySelector<HTMLButtonElement>('.hand [data-card-id^="ally-1:"]')!;
  await userEvent.click(frozen);
  expect(screen.getByText(/cannot act while Frozen/)).toBeTruthy();
  await userEvent.click(container.querySelector<HTMLButtonElement>('.hand [data-card-id^="ally-2:"]')!);
  expect(screen.getByText("Pollenmoth cannot act this turn.")).toBeTruthy();
  expect(send).not.toHaveBeenCalled();
});
it("forecasts Block absorption, Health damage and Stun buildup from the authoritative preview without mutating RNG", () => {
  const before = produce(fixture(), (game) => {
    game.battle!.enemies[0]!.block = 1;
    game.rng = 1;
    game.battle!.enemies[0]!.combat.dodge = 0;
  });
  // Magma Stomp has a buildup consequence as well as immediate damage.
  const card = before.cards.find((card) => card.definitionId === "emberback-magma-stomp")!;
  const rng = before.rng;
  const result = previewCard(before, card.id, "enemy-0");
  render(<TargetPreview before={before} result={result} targetId="enemy-0" />);
  expect(screen.getByText(/absorbed/)).toBeTruthy();
  expect(screen.getByText(/Stun/, { selector: ".rule-keyword" })).toBeTruthy();
  expect(before.rng).toBe(rng);
  expect(before.battle!.enemies[0]!.block).toBe(1);
});

it("shows the acting creature's secondary effects separately from the chosen ally", async () => {
  const { container, card, send } = open();
  await userEvent.click(card("guard"));
  await userEvent.hover(
    container.querySelector<HTMLButtonElement>('[data-actor-id="ally-1"] .creature-card')!,
  );
  const actor = container.querySelector('[data-actor-id="ally-0"]')!;
  const recipient = container.querySelector('[data-actor-id="ally-1"]')!;
  expect(actor.querySelector(".target-preview")?.textContent).toContain("Dodge 0 → 10");
  expect(recipient.querySelector(".target-preview")?.textContent).toContain("0 → 6");
  expect(actor.hasAttribute("data-acting")).toBe(true);
  expect(actor.hasAttribute("data-active-target")).toBe(false);
  expect(recipient.hasAttribute("data-active-target")).toBe(true);
  expect(send).not.toHaveBeenCalled();
});

it("moves between battle rows and reaches hand-side controls with directional input", () => {
  const { container, card } = open(
    produce(fixture(), (game) => {
      Object.assign(game.team[0]!.combat!, { armor: 1, dodge: 10, thorns: 2, burn: 1, poison: 1 });
    }),
  );
  card("attack").focus();
  moveFocus("up");
  expect(document.activeElement?.matches(".player-row .creature-card")).toBe(true);
  moveFocus("up");
  expect(document.activeElement?.closest(".enemy-row")).not.toBeNull();
  moveFocus("down");
  moveFocus("down");
  const toolbar = container.querySelector(".hand-toolbar")!;
  expect(toolbar.contains(document.activeElement)).toBe(true);
  const controls = [...toolbar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const reached = new Set<Element | null>();
  for (let i = 0; i < controls.length; i++) {
    reached.add(document.activeElement);
    moveFocus("right");
  }
  for (const control of controls) expect(reached.has(control)).toBe(true);
});

it.each(["emberback-furnace-breath", "emberback-magma-stomp", "mossguard-attack"])(
  "previews every enemy for %s and confirms without choosing one target",
  async (id) => {
    const game = produce(teamRun(1, ["emberback", "mossguard", "prismram"]), (draft) => {
      const chosen = draft.cards.find((card) => card.definitionId === id)!;
      draft.battle!.hand = [chosen.id];
      draft.battle!.buffer = [];
      draft.battle!.discard = [];
      draft.battle!.draw = draft.cards.filter((card) => card.id !== chosen.id).map((card) => card.id);
    });
    const { container, card, send, controls } = open(game, true);
    const before = structuredClone(game);
    expect(card("attack").querySelector("img")?.getAttribute("src")).toBe(
      assetUrl(content.definition(id).artwork!),
    );
    await userEvent.click(card("attack"));
    expect(
      screen.getByText(`${id.startsWith("mossguard") ? "Mossguard" : "Emberback"} · All enemies`),
    ).toBeTruthy();
    expect(container.querySelectorAll(".enemy-row .target-preview")).toHaveLength(3);
    expect(container.querySelectorAll(".enemy-row [data-active-target]")).toHaveLength(3);
    expect(container.querySelector(".target-line")).toBeNull();
    const confirm = screen.getByRole("button", { name: "Play · Enter" });
    expect(document.activeElement).toBe(confirm);
    act(() => {
      controls.current!("back");
    });
    expect(send).not.toHaveBeenCalled();
    expect(game).toEqual(before);
    expect(document.activeElement).toBe(card("attack"));
    await userEvent.click(card("attack"));
    await userEvent.keyboard("{Enter}");
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: "play", cardId: game.battle!.hand[0]! });
  },
);

it.each([
  ["mossguard-guard", "guard", "Self", 1],
  ["mossguard-heal", "heal", "All allies", 3],
] as const)("previews and confirms %s without selecting an ally", async (id, effect, recipient, count) => {
  const game = produce(teamRun(1, ["mossguard", "emberback", "prismram"]), (draft) => {
    const chosen = draft.cards.find((card) => card.definitionId === id)!;
    draft.battle!.hand = [chosen.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((card) => card.id !== chosen.id).map((card) => card.id);
    draft.team.forEach((ally) => {
      ally.health -= 3;
    });
  });
  const { container, card, send } = open(game, true);
  await userEvent.click(card(effect));
  expect(screen.getByText(`Mossguard · ${recipient}`)).toBeTruthy();
  expect(container.querySelectorAll(".player-row [data-active-target]")).toHaveLength(count);
  expect(container.querySelectorAll(".player-row .target-preview")).toHaveLength(count);
  expect(container.querySelector(".target-line")).toBeNull();
  expect(send).not.toHaveBeenCalled();
  await userEvent.keyboard("{Enter}");
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "play", cardId: game.battle!.hand[0]! });
});

it.each(["attack", "heal"])("confirms Pollenmoth's automatic %s without manual targeting", (effect) => {
  const game = produce(teamRun(7, ["pollenmoth", "mossguard", "prismram"]), (draft) => {
    draft.team[0]!.health -= 5;
    draft.battle!.hand = draft.cards.map((card) => card.id);
    draft.battle!.draw = [];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
  });
  const { container, send } = open(game, true);
  const cardId = game.cards.find((card) => card.definitionId === `pollenmoth-${effect}`)!.id;
  fireEvent.click(container.querySelector(`[data-card-id="${cardId}"]`)!);
  expect(container.querySelector(".confirm-play")).toBeTruthy();
  expect(container.querySelectorAll("[data-valid-target]")).toHaveLength(0);
  expect(container.querySelector(".target-preview")).toBeTruthy();
  fireEvent.click(container.querySelector(".confirm-play")!);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith({ type: "play", cardId });
});

it("confirms Bogbound Leap without asking for an ally target", async () => {
  const game = produce(teamRun(1, ["captoad"]), (draft) => {
    const leap = draft.cards.find((card) => card.definitionId === "captoad-swap")!;
    draft.battle!.hand = [leap.id];
    draft.battle!.draw = draft.cards.filter((card) => card.id !== leap.id).map((card) => card.id);
  });
  const { send, card } = open(game);
  const leap = card("swap");
  await userEvent.click(leap);
  expect(send).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", { name: /^Play/ });
  expect(confirm.hasAttribute("disabled")).toBe(false);
  await userEvent.click(confirm);
  expect(send).toHaveBeenCalledWith({ type: "play", cardId: leap.dataset.cardId });
});

it("Mirage Step selects only Dunefox, previews its shared Dodge, and confirms without an ally target", async () => {
  const game = produce(teamRun(7, ["dunefox", "mossguard", "captoad"]), (draft) => {
    const step = draft.cards.find((card) => card.definitionId === "dunefox-dodge")!;
    draft.battle!.hand = [step.id];
    draft.battle!.draw = draft.cards.filter((card) => card.id !== step.id).map((card) => card.id);
    draft.battle!.discard = [];
    draft.battle!.buffer = [];
  });
  const { container, send, card } = open(game);
  await userEvent.click(card("dodge"));
  expect(container.querySelectorAll(".player-row [data-valid-target]")).toHaveLength(1);
  expect(container.querySelectorAll(".target-preview")).toHaveLength(3);
  expect(
    screen.getByRole("status", { name: /Target preview for Mossguard/ }).getAttribute("aria-label"),
  ).toContain("Dodge 0.75 → 5.25");
  await userEvent.click(screen.getByRole("button", { name: /Play ·/ }));
  expect(send).toHaveBeenCalledWith({ type: "play", cardId: game.battle!.hand[0]! });
});

it("Bloom Cradle previews self-healing and confirms without choosing an ally", async () => {
  const game = produce(teamRun(1, ["bloomquail", "mossguard", "prismram"]), (draft) => {
    const chosen = draft.cards.find((card) => card.definitionId === "bloomquail-draw")!;
    draft.battle!.hand = [chosen.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((card) => card.id !== chosen.id).map((card) => card.id);
    draft.team[0]!.health -= 4;
    draft.team[1]!.health = 1;
  });
  const { container, card, send } = open(game, true);
  await userEvent.click(card("draw"));
  expect(screen.getByText("Bloomquail · Self")).toBeTruthy();
  expect(container.querySelectorAll(".player-row [data-active-target]")).toHaveLength(1);
  expect(container.querySelector(".target-preview")?.getAttribute("aria-label")).toContain("Health 22 to 24");
  await userEvent.keyboard("{Enter}");
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "play", cardId: game.battle!.hand[0]! });
});

it("targets Neradora itself for Undertow Knot and previews the separate Water Thorns pool", async () => {
  const game = produce(teamRun(1, ["neradora", "mossguard", "prismram"]), (draft) => {
    const knot = draft.cards.find((card) => card.definitionId === "neradora-undertow-knot")!;
    draft.battle!.hand = [knot.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((card) => card.id !== knot.id).map((card) => card.id);
  });
  const { container, send, card } = open(game);
  await userEvent.click(card("waterThorns"));
  expect(container.querySelectorAll(".player-row [data-active-target]")).toHaveLength(1);
  expect(container.querySelectorAll(".player-row .target-preview")).toHaveLength(1);
  expect(container.querySelector(".target-preview")?.textContent).toContain("Water Thorns 0 → 3");
  await userEvent.click(screen.getByRole("button", { name: /^Play/ }));
  expect(send.mock.calls).toEqual([[{ type: "play", cardId: game.battle!.hand[0]! }]]);
});

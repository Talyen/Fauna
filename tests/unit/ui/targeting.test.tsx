import { screenTestEnvironment } from "../../support/ui";
import { playPreviewModel } from "../../../src/ui/battle/play-preview-model";
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { BattleScreen } from "../../../src/ui/battle/battle-screen";
import type { Controls } from "../../../src/ui/shared/navigation/input";
import { TargetPreview } from "../../../src/ui/battle/target-preview";
import { moveFocus } from "../../../src/ui/shared/navigation/input";
import { previewCard } from "../../../src/game/engine";
import { produce } from "immer";
import * as content from "../../../src/game/content";
import { requireBattle, teamRun } from "../../support/game";
import { summonPendulums } from "../../../src/game/combat/legendary";
import { wisterelleBattle } from "../../support/wisterelle";

screenTestEnvironment({ visible: true });

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
  document.documentElement.style.setProperty("--target-denial-duration", "2400ms");
});
afterEach(() => {
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
  const card = (effectOrId: string) => {
    const instance = game.cards.find((card) => card.definitionId === effectOrId);
    return view.container.querySelector<HTMLButtonElement>(
      instance ? `.hand [data-card-id="${instance.id}"]` : `.hand [data-effect="${effectOrId}"]`,
    )!;
  };
  return { ...view, send, controls, card };
}
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
it("navigates Legendary targets by their visible fixed slots even if summon records are reordered", () => {
  const game = produce(fixture(), (state) => {
    const battle = requireBattle(state);
    battle.battle.enemies = [battle.battle.enemies[0]!];
    const boss = battle.battle.enemies[0]!;
    boss.species = "chronora";
    summonPendulums(battle, boss, "enemy", [], 2, true);
    battle.battle.minions!.reverse();
  });
  const { container, controls, card, send } = open(game, true);
  const bossId = game.battle!.enemies[0]!.id;
  const leftId = `pendulum-${bossId}-0`;
  const rightId = `pendulum-${bossId}-1`;
  const focusedId = () => document.activeElement?.closest("[data-actor-id]")?.getAttribute("data-actor-id");
  fireEvent.click(card("attack"));
  expect(focusedId()).toBe(leftId);
  expect(container.querySelector(`[data-actor-id="${leftId}"]`)?.getAttribute("data-battle-slot")).toBe(
    "left",
  );
  expect(container.querySelector(`[data-actor-id="${rightId}"]`)?.getAttribute("data-battle-slot")).toBe(
    "right",
  );
  act(() => {
    controls.current!("right");
  });
  expect(focusedId()).toBe(bossId);
  act(() => {
    controls.current!("right");
  });
  expect(focusedId()).toBe(rightId);
  act(() => {
    controls.current!("back");
  });
  expect(document.activeElement).toBe(card("attack"));
  expect(send).not.toHaveBeenCalled();
});

it("navigates legal backup targets in the same order they are displayed", () => {
  const game = wisterelleBattle();
  const { controls, card, send } = open(game, true);
  fireEvent.click(card("wisterelle-forgotten-junction"));
  const buttons = screen.getAllByRole("button", { name: /^Swap in .* from backup$/ });
  expect(buttons).toHaveLength(2);
  expect(document.activeElement).toBe(buttons[0]);
  act(() => {
    controls.current!("right");
  });
  expect(document.activeElement).toBe(buttons[1]);
  fireEvent.click(buttons[1]!);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "play",
    cardId: card("wisterelle-forgotten-junction").dataset.cardId,
    targetId: buttons[1]!.getAttribute("data-backup-target"),
  });
});

it("plays a chosen-target card immediately when only one recipient is legal", async () => {
  const game = produce(fixture(), (state) => {
    state.battle!.enemies.slice(1).forEach((unit) => {
      unit.health = 0;
    });
  });
  const { container, send, card } = open(game);
  await userEvent.click(card("attack"));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "play",
    cardId: card("attack").dataset.cardId,
    targetId: game.battle!.enemies[0]!.id,
  });
  expect(container.querySelector(".target-preview")).toBeNull();
  expect(container.querySelector(".battle-screen")?.getAttribute("data-selected-card")).toBe("");
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
  render(<TargetPreview forecast={playPreviewModel(before, result).units.get("enemy-0")} />);
  expect(screen.getByText(/absorbed/)).toBeTruthy();
  expect(screen.getByText(/Stun/, { selector: ".rule-keyword" })).toBeTruthy();
  expect(before.rng).toBe(rng);
  expect(before.battle!.enemies[0]!.block).toBe(1);
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

// Authored targeting lives in ability-contracts; the screen needs self, team and enemy-area activation.
it.each([
  ["ringpalm", "ringpalm-teamProtection"],
  ["emberback", "emberback-furnace-breath"],
  ["mossguard", "mossguard-guard"],
] as const)("plays %s's %s immediately without selecting or confirming a recipient", async (kind, id) => {
  const game = produce(teamRun(7, [kind, "prismram"]), (draft) => {
    const chosen = draft.cards.find((card) => card.definitionId === id)!;
    draft.battle!.hand = [chosen.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((card) => card.id !== chosen.id).map((card) => card.id);
    draft.team[0]!.health -= 3;
  });
  const { container, send } = open(game);
  await userEvent.click(container.querySelector<HTMLButtonElement>(".hand .action-card")!);
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "play", cardId: game.battle!.hand[0]! });
  expect(container.querySelector(".battle-screen")?.getAttribute("data-selected-card")).toBe("");
  expect(container.querySelector(".target-preview")).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
});

it("plays an automatic card on Enter without a confirmation control", async () => {
  const { card, send } = open(fixture(), true);
  card("pollenmoth-teamGuard").focus();
  await userEvent.keyboard("{Enter}");
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "play",
    cardId: card("pollenmoth-teamGuard").dataset.cardId,
  });
});

it("plays an automatic card directly while replacing a pending chosen target", async () => {
  const { container, card, send } = open();
  await userEvent.click(card("attack"));
  await userEvent.click(card("pollenmoth-teamGuard"));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "play",
    cardId: card("pollenmoth-teamGuard").dataset.cardId,
  });
  expect(container.querySelector(".battle-screen")?.getAttribute("data-selected-card")).toBe("");
});

it("keeps automatic cards unavailable when Mana is insufficient", async () => {
  const { card, send } = open(
    produce(fixture(), (game) => {
      game.battle!.mana = 0;
    }),
  );
  await userEvent.click(card("pollenmoth-teamGuard"));
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText("Not enough Mana.")).toBeTruthy();
});

it("previews actor and ally effects separately, then commits only the activated ally", async () => {
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
  await userEvent.click(recipient.querySelector<HTMLButtonElement>(".creature-card")!);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "play",
    cardId: card("guard").dataset.cardId,
    targetId: "ally-1",
  });
});

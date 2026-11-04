// @vitest-environment jsdom
import { expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { createSession } from "../../../src/application/session";
import { soleReplacement } from "../../../src/application/battle-policy";
import { freshCombat } from "../../../src/game/combat/index";
import { dispatch } from "../../../src/game/engine";
import { setBattleCards } from "../../support/cards";
import { encodeSave } from "../../../src/game/save";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { App } from "../../../src/ui/App";
import { addBackups, run } from "../../support/game";
import { screenTestEnvironment } from "../../support/ui";

screenTestEnvironment({ visible: true });

function fixture(two: boolean) {
  return produce(run(7), (draft) => {
    draft.team[0]!.health = 0;
    addBackups(draft, {
      id: "backup-moth",
      species: "pollenmoth",
      health: 20,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
    if (two)
      addBackups(draft, {
        id: "backup-toad",
        species: "captoad",
        health: 20,
        block: 0,
        attacked: false,
        combat: freshCombat(),
      });
  });
}

it("resumes a single forced backup without a prompt and saves the swap once", async () => {
  const initial = fixture(false);
  expect(soleReplacement(initial, false)).toEqual({
    type: "swap",
    activeId: "ally-0",
    reserve: "backup-moth",
    autoEndTurn: false,
  });
  localStorage.setItem("fauna.save.v1", encodeSave(initial));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(session.store.getState().game.team[0]!.id).toBe("backup-moth"));
    expect(screen.queryByRole("dialog", { name: "Choose a replacement" })).toBeNull();
    expect(document.activeElement?.matches(".hand .action-card, .end-turn")).toBe(true);
    const next = session.store.getState().game;
    expect(next.revision).toBe(initial.revision + 1);
    expect(next.battle!.turn).toBe(initial.battle!.turn);
    expect(next.battle!.mana).toBe(initial.battle!.mana);
    await session.flush();
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).team[0].id).toBe("backup-moth");
  } finally {
    cleanup();
    await session.dispose();
  }
});

it("respects the disabled automatic End turn preference during a forced swap", async () => {
  const initial = produce(fixture(false), (draft) => {
    draft.battle!.mana = 0;
  });
  localStorage.setItem("fauna.auto-end-turn", "false");
  localStorage.setItem("fauna.save.v1", encodeSave(initial));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(session.store.getState().game.team[0]!.id).toBe("backup-moth"));
    expect(session.store.getState().game.battle!.turn).toBe(initial.battle!.turn);
    expect(session.store.getState().game.battle!.mana).toBe(0);
  } finally {
    cleanup();
    await session.dispose();
  }
});

it("still asks when two living backups can be chosen", async () => {
  const initial = fixture(true);
  expect(soleReplacement(initial, true)).toBeNull();
  localStorage.setItem("fauna.save.v1", encodeSave(initial));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose a replacement" });
    expect(dialog).toBeTruthy();
    expect(session.store.getState().game).toEqual(initial);
    await userEvent.click(screen.getByRole("button", { name: "Captoad, backup" }));
    expect(session.store.getState().game.team[0]!.id).toBe("backup-toad");
  } finally {
    cleanup();
    await session.dispose();
  }
});

it("automatically fills the final knockout after the player chooses the first backup", async () => {
  const initial = produce(fixture(true), (draft) => {
    draft.team[1]!.health = 0;
  });
  localStorage.setItem("fauna.save.v1", encodeSave(initial));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(await screen.findByRole("button", { name: "Captoad, backup" }));
    await waitFor(() => expect(session.store.getState().game.team[1]!.id).toBe("backup-moth"));
    const next = session.store.getState().game;
    expect(next.team[0]!.id).toBe("backup-toad");
    expect(next.revision).toBe(initial.revision + 2);
    expect(screen.queryByRole("dialog", { name: "Choose a replacement" })).toBeNull();
    await session.flush();
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).team[1].id).toBe("backup-moth");
  } finally {
    cleanup();
    await session.dispose();
  }
});

it("ends after the last card even with Mana remaining, while preserving manual and free plays", () => {
  const initial = produce(run(), (draft) => {
    const guard = draft.cards.find((card) => card.definitionId === "mossguard-guard")!;
    setBattleCards(draft, [guard.id]);
    draft.battle!.mana = 4;
  });
  const cardId = initial.battle!.hand[0]!;
  const manual = dispatch(initial, { type: "play", cardId, autoEndTurn: false });
  const automatic = dispatch(initial, { type: "play", cardId, autoEndTurn: true });
  expect(manual.accepted).toBe(true);
  expect(manual.state.battle!.mana).toBe(3);
  expect(manual.state.battle!.turn).toBe(initial.battle!.turn);
  expect(automatic.accepted).toBe(true);
  expect(automatic.state.battle!.turn).toBe(initial.battle!.turn + 1);

  const withFreeFood = produce(initial, (draft) => {
    draft.battle!.mana = 1;
    draft.boons.push("blossom-cake-stand");
    const food = {
      id: "copy-0",
      definitionId: "food-mana-berries",
      ownerId: null,
      temporary: true as const,
      level: 0,
    };
    draft.cards.push(food);
    draft.battle!.copySerial = 1;
    draft.battle!.hand.push(food.id);
  });
  const next = dispatch(withFreeFood, { type: "play", cardId, autoEndTurn: true });
  expect(next.accepted).toBe(true);
  expect(next.state.battle!.mana).toBe(0);
  expect(next.state.battle!.turn).toBe(initial.battle!.turn);
  expect(next.state.battle!.hand).toContain("copy-0");
});

it.each([true, false])("respects auto-end preference %s on resuming an unplayable turn", async (enabled) => {
  const initial = produce(run(7), (draft) => {
    draft.battle!.mana = 0;
  });
  localStorage.setItem("fauna.auto-end-turn", String(enabled));
  localStorage.setItem("fauna.save.v1", encodeSave(initial));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    if (enabled) {
      await waitFor(() =>
        expect(session.store.getState().game.battle!.turn).toBeGreaterThan(initial.battle!.turn),
      );
      await session.flush();
      expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).battle.turn).toBeGreaterThan(
        initial.battle!.turn,
      );
    } else {
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(session.store.getState().game.battle!.turn).toBe(initial.battle!.turn);
    }
  } finally {
    cleanup();
    await session.dispose();
  }
});

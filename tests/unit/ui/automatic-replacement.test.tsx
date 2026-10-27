// @vitest-environment jsdom
import { expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { createSession } from "../../../src/application/session";
import { soleReplacement } from "../../../src/application/battle-policy";
import { freshCombat } from "../../../src/game/combat/index";
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

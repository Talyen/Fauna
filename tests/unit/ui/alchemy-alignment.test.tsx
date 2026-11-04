// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { screenTestEnvironment } from "../../support/ui";
import { accept, starterJourney, run } from "../../support/game";
import { createGame, dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { definition, species } from "../../../src/game/content";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { App } from "../../../src/ui/App";
import { useDevicePreferences } from "../../../src/ui/settings/preferences";
import { offensiveCardValue } from "../../../src/ui/shared/cards/action-display";

screenTestEnvironment({ visible: true });
it("persists completed starter selection and requires Continue exactly once", async () => {
  const initial = createGame(7);
  const drafted = accept(initial, { type: "draft", species: initial.starterOffers[0]! });
  localStorage.setItem("fauna.save.v1", encodeSave(drafted));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
  expect(session.store.getState().game).toEqual(drafted);
  await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
  await session.flush();
  expect(session.store.getState().game.phase).toBe("teamSelection");
  expect(session.store.getState().game.team).toHaveLength(1);
  await session.dispose();
});
it("saves the healed Campfire result and rejects repeated Rest after reload", () => {
  const initial = produce(starterJourney(3, "captoad"), (draft) => {
    draft.team[0]!.health = 1;
  });
  const rested = accept(accept(initial, { type: "visitCampfire" }), { type: "rest" });
  const resumed = decodeSave(encodeSave(rested));
  expect(resumed.phase).toBe("campfire");
  expect(resumed.encounter).toBe(initial.encounter);
  expect(dispatch(resumed, { type: "rest" }).accepted).toBe(false);
  const continued = accept(resumed, { type: "leaveCampfire" });
  expect(continued.phase).toBe("teamSelection");
  expect(continued.encounter).toBe(initial.encounter + 1);
  expect(continued.team[0]!.health).toBe(rested.team[0]!.health);
});
it("supports category and all-category refunds without changing XP", () => {
  const initial = produce(run(), (draft) => {
    draft.keywordXP.burn = 100;
    draft.keywordXP.mana = 100;
    draft.talents = ["burn.flashpoint", "mana.wellspring"];
  });
  const category = accept(initial, { type: "resetTalents", keyword: "burn" });
  expect(category.talents).toEqual(["mana.wellspring"]);
  const all = accept(category, { type: "resetTalents" });
  expect(all.talents).toEqual([]);
  expect(all.keywordXP).toEqual(initial.keywordXP);
});
it("uses pre-defense offensive values without consuming combat state or RNG", () => {
  const game = produce(run(), (draft) => {
    const attack = draft.cards.find((entry) => definition(entry.definitionId).effect === "attack")!;
    const battle = draft.battle!;
    battle.draw.push(...battle.hand.filter((id) => id !== attack.id));
    battle.draw = battle.draw.filter((id) => id !== attack.id);
    battle.discard = battle.discard.filter((id) => id !== attack.id);
    battle.buffer = battle.buffer.filter((id) => id !== attack.id);
    battle.hand = [attack.id];
  });
  const card = game.cards.find((entry) => definition(entry.definitionId).effect === "attack")!;
  const owner = game.team.find((entry) => entry.id === card.ownerId)!;
  const before = encodeSave(game);
  const first = offensiveCardValue(card, owner, game);
  expect(first).toBeGreaterThan(0);
  expect(offensiveCardValue(card, owner, game)).toBe(first);
  expect(encodeSave(game)).toBe(before);
});
it("opens a battle enemy kit without committing gameplay", async () => {
  const game = run();
  localStorage.setItem("fauna.save.v1", encodeSave(game));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Continue", exact: true }));
  const enemy = game.battle!.enemies[0]!;
  await user.click(
    within(screen.getByRole("region", { name: "Enemy row" })).getByRole("button", {
      name: enemy.name,
      exact: true,
    }),
  );
  expect(screen.getByRole("dialog", { name: species(enemy.species).name })).toBeTruthy();
  expect(session.store.getState().game).toEqual(game);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  await session.dispose();
});
it("clears all local save slots and persists fresh progress in the serialized save lane", async () => {
  const old = encodeSave(run());
  for (const suffix of ["", ".backup1", ".backup2"]) localStorage.setItem(`fauna.save.v1${suffix}`, old);
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  session.clearProgress();
  await session.flush();
  expect(session.store.getState().game.phase).toBe("draft");
  expect(decodeSave(localStorage.getItem("fauna.save.v1")!).team).toEqual([]);
  expect(localStorage.getItem("fauna.save.v1.backup1")).toBeNull();
  expect(localStorage.getItem("fauna.save.v1.backup2")).toBeNull();
  await waitFor(() => expect(session.store.getState().saveStatus).toBe("saved"));
  await session.dispose();
});
it("shows save failure and retries the same committed outcome before accepting more progress", async () => {
  let fail = true;
  const platform = createBrowserPlatform(localStorage);
  const write = platform.saves.write;
  platform.saves.write = async (...args) => {
    if (fail) throw new Error("Disk unavailable");
    await write(...args);
  };
  const session = createSession(platform, 7);
  await session.load();
  render(<App session={session} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Play", exact: true }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Couldn’t save"));
  const committed = session.store.getState().game;
  await user.click(screen.getAllByRole("button", { name: /^Recruit / })[0]!);
  expect(session.store.getState().game).toBe(committed);
  fail = false;
  await user.click(screen.getByRole("button", { name: "Retry", exact: true }));
  await session.flush();
  expect(session.store.getState().game).toBe(committed);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(decodeSave(localStorage.getItem("fauna.save.v1")!)).toEqual(committed);
  await session.dispose();
});

it("uses volume controls after removing the separate Sound switch", () => {
  localStorage.setItem("fauna.audio.v1", JSON.stringify({ enabled: false, master: 35 }));
  const { result, unmount } = renderHook(() => useDevicePreferences());
  expect(result.current[0].audio.enabled).toBe(true);
  expect(result.current[0].audio.master).toBe(35);
  unmount();
});

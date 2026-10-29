import { produce } from "immer";
import { expect, it } from "vitest";
import { createSession } from "../../../src/application/session";
import { createGame, dispatch } from "../../../src/game/engine";
import { inspectCardPlay } from "../../../src/game/play-queries";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept, authoredPack, prepareDestination, requireBattle, run } from "../../support/game";
import { orifableBattle } from "../../support/orifable";

it("offers the next controlled turn when shared Food can still be played", () => {
  const game = produce(orifableBattle(true), (draft) => {
    for (const unit of [...draft.team, ...draft.battle.enemies]) {
      unit.combat!.controlled = "freeze";
      unit.combat!.controlTurns = 2;
    }
    // The next draw contains Food even though every creature must skip its action
    draft.battle.draw = draft.cards.filter((card) => card.ownerId === null).map((card) => card.id);
    draft.battle.hand = draft.cards
      .filter((card) => card.ownerId !== null)
      .map((card) => card.id)
      .slice(0, 6);
    draft.battle.discard = draft.cards
      .filter((card) => ![...draft.battle.draw, ...draft.battle.hand].includes(card.id))
      .map((card) => card.id);
  });
  expect(decodeSave(encodeSave(game))).toEqual(game);

  const next = requireBattle(accept(game, { type: "endTurn" }));

  expect(next.battle!.turn).toBe(game.battle.turn + 1);
  expect(next.team.every((unit) => unit.combat!.skipped && unit.combat!.controlled === "freeze")).toBe(true);
  const apple = next.cards.find((card) => card.definitionId === "food-apple")!;
  expect(inspectCardPlay(next, apple.id).allowed).toBe(true);
  const fed = accept(next, {
    type: "play",
    cardId: apple.id,
    targetId: next.team[0]!.id,
    autoEndTurn: false,
  });
  expect(fed.team[0]!.health).toBeGreaterThan(next.team[0]!.health);
  expect(decodeSave(encodeSave(fed))).toEqual(fed);
});

it("recovers a backup instead of accepting an already-owned pending Boon", async () => {
  const destination = produce(run(), (draft) => {
    prepareDestination(draft);
    draft.encounter = 9;
    draft.journey!.victories = 9;
    draft.expedition.pack = authoredPack(9);
  });
  const good = dispatch(accept(destination, { type: "beginBattle" }), { type: "devWinBattle" }, true).state;
  expect(good.phase).toBe("recruit");
  expect(good.reward!.boons.length).toBeGreaterThan(0);
  const corrupt = produce(good, (draft) => {
    draft.boons.push(draft.reward!.boons[0]!);
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
  const session = createSession({
    desktop: false,
    saves: {
      readCandidates: async () => [
        { source: "primary", data: encodeSave(corrupt) },
        { source: "backup", data: encodeSave(good) },
      ],
      write: async () => {},
    },
  });
  try {
    await session.load();
    expect(session.store.getState().game).toEqual(good);
    const recruited = accept(good, { type: "recruit", species: good.reward!.recruits[0]! });
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
  } finally {
    await session.dispose();
  }
});

it("rejects revision exhaustion without replacing the last resumable checkpoint", () => {
  const ready = produce(createGame(42), (draft) => {
    draft.revision = Number.MAX_SAFE_INTEGER - 2;
  });
  const last = accept(ready, { type: "draft", species: ready.starterOffers[0]! });
  expect(last.revision).toBe(Number.MAX_SAFE_INTEGER - 1);
  expect(decodeSave(encodeSave(last))).toEqual(last);

  for (const command of [{ type: "start" }, { type: "newRun", seed: 1 }] as const) {
    const rejected = dispatch(last, command);
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(last);
    expect(rejected.events).toEqual([]);
    expect(rejected.state.rng).toBe(last.rng);
    expect(decodeSave(encodeSave(rejected.state))).toEqual(last);
  }
});

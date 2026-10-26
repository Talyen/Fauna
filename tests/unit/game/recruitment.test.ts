import {
  authoredPack,
  swapFixture,
  prepareDestination,
  accept,
  run,
  teamRun,
  winBattle,
  fullRosterReward,
} from "../../support/game";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";

describe("recruiting unique creatures", () => {
  it("offers exactly the three defeated enemies, including repeated species and roster members", () => {
    for (const pack of COMBAT_PACKS) expect(pack).toHaveLength(3);
    const started = teamRun(7, ["prismram"]);
    const battle = accept(
      produce(started, (d) => {
        prepareDestination(d);
        d.encounter = 4;
        d.journey!.victories = d.encounter;
        d.journey!.victories = 4;
        d.expedition = {
          recruit: null,
          lastRoom: null,
          pack: authoredPack(
            d.encounter,
            COMBAT_PACKS.findIndex((pack) => pack[0] === "prismram" && pack[1] === "prismram"),
          ),
        };
      }),
      { type: "beginBattle" },
    );
    const reward = winBattle(battle);
    expect(reward.reward!.recruits).toEqual(["prismram", "prismram", "emberback"]);
    expect(decodeSave(encodeSave(reward))).toEqual(reward);
    expect(() =>
      decodeSave(
        encodeSave(
          produce(reward, (d) => {
            d.reward!.recruits.pop();
          }),
        ),
      ),
    ).toThrow();
    const next = accept(reward, { type: "recruit", species: "prismram" });
    expect([...next.team, ...next.reserves].map((unit) => unit.species)).toEqual(["prismram"]);
    expect(new Set(next.team.map((c) => c.id)).size).toBe(1);
    expect(next.discovery.recruited.prismram).toBe(2);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("swaps and remembers distinct creatures without merging card ownership, health or identity", () => {
    let s = accept(winBattle(run()), { type: "recruit", species: "pollenmoth" });
    const copy = s.reserves[0]!;
    expect(copy.id).not.toBe("ally-1");
    s = swapFixture(s, { type: "swap", activeId: "ally-1", reserve: copy.id });
    expect(s.team.map((unit) => unit.id)[1]).toBe(copy.id);
    s = accept(decodeSave(encodeSave(s)), { type: "beginBattle" });
    s = produce(s, (d) => {
      d.team[1]!.health = 9;
      d.team[1]!.attacked = true;
      d.reserves[0]!.health = 17;
    });
    const zones = [s.battle!.hand, s.battle!.draw, s.battle!.discard];
    s = swapFixture(s, { type: "swap", activeId: copy.id, reserve: "ally-1" });
    expect(s.team[1]!.id).toBe("ally-1");
    expect(s.team[1]!.health).toBe(17);
    expect(s.reserves[0]!.health).toBe(9);
    expect(s.reserves[0]!.attacked).toBe(true);
    expect(s.cards.filter((c) => c.ownerId === "ally-1")).toHaveLength(3);
    expect(s.cards.some((c) => c.ownerId === copy.id)).toBe(false);
    expect([s.battle!.hand, s.battle!.draw, s.battle!.discard]).toEqual(zones);
    expect(s.team.map((unit) => unit.id)[1]).toBe("ally-1");
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it("recruiting an existing species keeps its identity, Health, cards and roster slots", () => {
    const reward = winBattle(run());
    const next = accept(reward, { type: "recruit", species: "emberback" });
    expect(next.team).toEqual(reward.team);
    expect(next.reserves).toEqual(reward.reserves);
    expect(next.cards).toEqual(reward.cards);
    expect(next.discovery.recruited.emberback).toBe(2);
    expect(next.phase).toBe("teamSelection");
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
});

it("banks a full-roster recruit once, before the saved team decision", () => {
  const reward = fullRosterReward();
  expect(dispatch(reward, { type: "confirmRecruit" }).accepted).toBe(false);
  const selected = accept(reward, { type: "recruit", species: "emberback" });
  expect(selected.phase).toBe("recruit");
  expect(selected.discovery.recruited.emberback).toBe((reward.discovery.recruited.emberback ?? 0) + 1);
  expect([...selected.team, ...selected.reserves].map((unit) => unit.species)).toEqual(
    [...reward.team, ...reward.reserves].map((unit) => unit.species),
  );
  expect(selected.team).toEqual(reward.team);
  expect(selected.reserves).toEqual(reward.reserves);
  expect(selected.cards).toEqual(reward.cards);
  expect(selected.team.map((unit) => unit.id)).toEqual(reward.team.map((unit) => unit.id));
  expect(selected.rng).toBe(reward.rng);
  const resumed = decodeSave(encodeSave(selected));
  expect(resumed).toEqual(selected);
  for (const kind of reward.reward.recruits) {
    const repeated = dispatch(resumed, { type: "recruit", species: kind });
    expect(repeated.accepted).toBe(false);
    expect(repeated.state).toBe(resumed);
    expect(repeated.state.rng).toBe(resumed.rng);
  }
  const invalid = dispatch(resumed, { type: "confirmRecruit", replace: "missing" });
  expect(invalid.accepted).toBe(false);
  expect(invalid.state).toBe(resumed);
  const kept = accept(resumed, { type: "confirmRecruit" });
  expect(kept.phase).toBe("teamSelection");
  expect([...kept.team, ...kept.reserves].map((unit) => unit.species)).toEqual(
    [...reward.team, ...reward.reserves].map((unit) => unit.species),
  );
  expect(kept.team).toEqual(reward.team);
  expect(kept.reserves).toEqual(reward.reserves);
  expect(kept.cards).toEqual(reward.cards);
  expect(kept.team.map((unit) => unit.id)).toEqual(reward.team.map((unit) => unit.id));
  expect(kept.discovery).toEqual(selected.discovery);
  expect(decodeSave(encodeSave(kept))).toEqual(kept);
  expect(dispatch(kept, { type: "confirmRecruit" }).state).toBe(kept);
});

it("rejects impossible saved recruitment selections", () => {
  const reward = fullRosterReward();
  const selected = accept(reward, { type: "recruit", species: "emberback" });
  for (const broken of [
    produce(selected, (draft) => {
      if (draft.phase === "recruit") draft.reward.selectedRecruit = "memento";
    }),
    produce(selected, (draft) => {
      delete draft.discovery.recruited.emberback;
    }),
  ])
    expect(() => decodeSave(encodeSave(broken))).toThrow();
});

it.each([3, 7])(
  "keeping the team after Boss recruitment at encounter %s preserves reward ordering",
  (encounter) => {
    const ready = produce(teamRun(42, ["prismram"]), (game) => {
      game.encounter = encounter;
      prepareDestination(game);
      game.expedition = { pack: authoredPack(game.encounter), recruit: null, lastRoom: "boss" };
    });
    const reward = fullRosterReward(winBattle(accept(ready, { type: "beginBattle" })));
    const selected = accept(reward, { type: "recruit", species: reward.reward.recruits[0]! });
    const next = accept(decodeSave(encodeSave(selected)), { type: "confirmRecruit" });
    expect(next.phase).toBe(encounter === 7 ? "victory" : "boon");
    expect([...next.team, ...next.reserves].map((unit) => unit.species)).toEqual(
      [...reward.team, ...reward.reserves].map((unit) => unit.species),
    );
    expect(next.discovery).toEqual(selected.discovery);
    expect(next.currency).toBe(reward.currency);
    expect(decodeSave(encodeSave(next))).toEqual(next);
    expect(dispatch(next, { type: "confirmRecruit" }).accepted).toBe(false);
  },
);

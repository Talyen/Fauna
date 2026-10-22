import { swapFixture } from "../../support/game";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { prepareDestination, accept, run, teamRun, winBattle } from "../../support/game";

describe("recruiting creature copies", () => {
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
          pack: COMBAT_PACKS.findIndex((pack) => pack[0] === "prismram" && pack[1] === "prismram"),
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
    expect(next.roster).toEqual(["prismram", "prismram"]);
    expect(new Set(next.team.map((c) => c.id)).size).toBe(2);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("swaps and remembers the chosen copy without merging card ownership, health or identity", () => {
    let s = accept(winBattle(run()), { type: "recruit", species: "emberback" });
    const copy = s.reserves[0]!;
    expect(copy.id).not.toBe("ally-1");
    s = swapFixture(s, { type: "swap", activeId: "ally-1", reserve: copy.id });
    expect(s.lineup[1]).toBe(copy.id);
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
    expect(s.lineup[1]).toBe("ally-1");
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it("releases only the chosen copy at five and updates its lineup entry", () => {
    let s = accept(winBattle(), { type: "recruit", species: "emberback" });
    s = accept(s, { type: "beginBattle" });
    s = accept(winBattle(s), { type: "recruit", species: "mossguard" });
    const copies = s.reserves.map((c) => c.id);
    s = accept(s, { type: "beginBattle" });
    // Replay an ordinary combat for the replacement decision.
    s = winBattle(
      accept(
        produce(s, (d) => {
          prepareDestination(d);
          d.encounter = 0;
          d.journey!.victories = d.encounter;
          d.journey!.victories = 0;
        }),
        { type: "beginBattle" },
      ),
    );
    expect(dispatch(s, { type: "skipRecruit" }).accepted).toBe(true);
    expect(dispatch(s, { type: "skipRecruit" }).state.roster).toEqual(s.roster);
    expect(dispatch(s, { type: "recruit", species: "emberback" }).accepted).toBe(false);
    expect(s.discovery.recruited.emberback).toBe(2);
    s = accept(s, { type: "recruit", species: "emberback", replace: "ally-1" });
    expect(s.discovery.recruited.emberback).toBe(3);
    expect(s.discovery.recruited.mossguard).toBe(2);
    const all = [...s.team, ...s.reserves];
    expect(all.some((c) => c.id === "ally-1")).toBe(false);
    expect(copies.every((id) => all.some((c) => c.id === id))).toBe(true);
    expect(all.filter((c) => c.species === "emberback")).toHaveLength(2);
    expect(s.lineup[1]).toBe(s.team[1]!.id);
    expect(new Set(all.map((c) => c.id)).size).toBe(5);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
});

it("declining recruitment preserves collection ranks, card ownership and lineup across resume", () => {
  const state = winBattle(run());
  const result = dispatch(state, { type: "skipRecruit" });
  expect(result.accepted).toBe(true);
  expect(result.state.phase).toBe("teamSelection");
  expect(result.state.roster).toEqual(state.roster);
  expect(result.state.lineup).toEqual(state.lineup);
  expect(result.state.cards).toEqual(state.cards);
  expect(result.state.discovery).toEqual(state.discovery);
  expect(result.state.currency).toBe(state.currency);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  const repeated = dispatch(result.state, { type: "skipRecruit" });
  expect(repeated.accepted).toBe(false);
  expect(repeated.state).toBe(result.state);
});

it.each([3, 7])(
  "declining Boss recruitment at encounter %s preserves the remaining reward flow",
  (encounter) => {
    const ready = produce(teamRun(42, ["prismram"]), (game) => {
      game.encounter = encounter;
      prepareDestination(game);
      game.expedition = { pack: 0, recruit: null, lastRoom: "boss" };
    });
    const reward = winBattle(accept(ready, { type: "beginBattle" }));
    expect(reward.phase).toBe("recruit");
    const next = accept(decodeSave(encodeSave(reward)), { type: "skipRecruit" });
    expect(next.phase).toBe(encounter === 7 ? "victory" : "boon");
    expect(next.roster).toEqual(reward.roster);
    expect(next.discovery).toEqual(reward.discovery);
    expect(next.currency).toBe(reward.currency);
    expect(decodeSave(encodeSave(next))).toEqual(next);
    expect(dispatch(next, { type: "skipRecruit" }).accepted).toBe(false);
  },
);

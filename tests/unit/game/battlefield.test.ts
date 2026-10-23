import { expect, it } from "vitest";
import { battlefield } from "../../../src/game/battlefield";
import { summonEcho } from "../../../src/game/combat/legendary";
import { requireBattle, teamRun } from "../../support/game";

it.each(["player", "enemy"] as const)(
  "returns an independently reorderable %s row without summons",
  (side) => {
    const state = requireBattle(teamRun(42, ["memento", "mossguard"]));
    const row = side === "player" ? state.team : state.battle.enemies;
    const result = battlefield(state, side);
    expect(result).toEqual(row);
    expect(result[0]).toBe(row[0]);
    result.reverse();
    result.pop();
    expect(battlefield(state, side)).toEqual(row);
  },
);

it("appends summons in authored order only while their owner is alive on that side", () => {
  const state = structuredClone(requireBattle(teamRun(42, ["memento", "memento"])));
  const [first, second] = state.team;
  const enemy = state.battle.enemies[0]!;
  summonEcho(state, first!, "player", 6, []);
  summonEcho(state, enemy, "enemy", 6, []);
  summonEcho(state, second!, "player", 8, []);
  const [firstEcho, enemyEcho, secondEcho] = state.battle.minions!;
  expect(battlefield(state, "player")).toEqual([...state.team, firstEcho, secondEcho]);
  expect(battlefield(state, "enemy")).toEqual([...state.battle.enemies, enemyEcho]);
  first!.health = 0;
  enemy.health = 0;
  expect(battlefield(state, "player")).toEqual([...state.team, secondEcho]);
  expect(battlefield(state, "enemy")).toEqual(state.battle.enemies);
  first!.health = 1;
  expect(battlefield(state, "player")).toEqual([...state.team, firstEcho, secondEcho]);
});

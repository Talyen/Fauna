import { expect, it } from "vitest";
import { produce } from "immer";
import { createJourneyActor, boonValue } from "../../../src/tooling/journey-policy";
import { createBattleProgress } from "../../../src/tooling/battle-progress";
import { dispatch } from "../../../src/game/engine";
import { teamRun, winBattle } from "../../support/game";
import type { BoonId, SpeciesId } from "../../../src/game/content";
const actor = () => createJourneyActor({ seed: 42, starter: "mossguard", policy: "heuristic" });

function shelf(boons: BoonId[], prices = boons.map(() => 20)) {
  return produce(winBattle(teamRun(42, ["mossguard"])), (game) => {
    Object.assign(game, {
      phase: "support",
      reward: null,
      currency: 40,
      support: {
        id: "merchant",
        kind: "merchant",
        encounter: 0,
        resolved: false,
        purchased: null,
        stock: boons.map((boon, index) => ({ slot: `slot-${index}`, boon, price: prices[index] })),
      },
    });
  });
}
it("buys a usable affordable Boon rather than the first slot, without changing saved stock or RNG", () => {
  const state = shelf(["brass-censer", "ironwood-buckler", "resonant-chimes"], [20, 20, 40]);
  const before = JSON.stringify(state);
  const selected = actor()(state);
  expect(selected.command).toEqual({ type: "buyBoon", visit: "merchant", slot: "slot-1" });
  expect(selected.reason).toContain("Ironwood Buckler");
  expect(JSON.stringify(state)).toBe(before);
  const bought = dispatch(state, selected.command);
  expect(bought.accepted).toBe(true);
  expect(bought.state.boons).toContain("ironwood-buckler");
  expect(bought.state.currency).toBe(20);
  expect(bought.state.support!.stock).toEqual(state.support!.stock);
});
it("saves Gold when every affordable slot lacks a roster trigger", () => {
  const state = shelf(["brass-censer", "frozen-pocketwatch", "resonant-chimes"], [20, 20, 40]);
  const poor = produce(state, (game) => {
    game.currency = 25;
  });
  expect(actor()(poor).command).toEqual({ type: "leaveSupport", visit: "merchant" });
  expect(boonValue(poor, "brass-censer")).toBe(0);
  expect(boonValue(poor, "ironwood-buckler")).toBeGreaterThan(0);
});
it("uses the same compatibility checks for free Boon rewards", () => {
  const state = produce(shelf(["brass-censer"]), (game) => {
    Object.assign(game, {
      phase: "boon",
      support: null,
      reward: {
        recruits: [],
        boons: ["brass-censer", "ironwood-buckler"],
        xp: {},
        currency: 0,
        outcome: "next",
      },
    });
  });
  expect(actor()(state).command).toEqual({ type: "chooseBoon", boon: "ironwood-buckler" });
  const incompatible = produce(state, (game) => {
    game.reward!.boons = ["brass-censer"];
  });
  expect(actor()(incompatible).command).toEqual({ type: "skipBoon" });
});
it("recruits complementary damage instead of another support-only kit", () => {
  const state = produce(winBattle(teamRun(42, ["mossguard"])), (game) => {
    game.reward!.recruits = ["cadenza", "emberback"];
  });
  expect(actor()(state).command).toEqual({ type: "recruit", species: "emberback" });
});
it.each(["cadenza", "mossguard", "emberback"] as SpeciesId[])(
  "protects unique Purge and Armor bypass while recruiting %s",
  (kind) => {
    const full = produce(teamRun(42, ["mossguard", "rookhaven", "cadenza"]), (game) => {
      game.reserves.push(
        { ...game.team[0]!, id: "backup-1" },
        { ...game.team[0]!, id: "backup-2", health: 0 },
      );
      game.roster.push("mossguard", "mossguard");
    });
    const state = produce(winBattle(full), (game) => {
      game.reward!.recruits = [kind];
    });
    const before = JSON.stringify(state);
    const selected = actor()(state);
    expect(selected.command).toMatchObject({ type: "recruit", species: kind });
    expect(selected.command).not.toHaveProperty("replace", state.team[1]!.id);
    expect(JSON.stringify(state)).toBe(before);
    const result = dispatch(state, selected.command);
    expect(result.accepted).toBe(true);
    expect(result.state.roster).toContain("rookhaven");
  },
);
it("reports long absence of enemy Health progress without mistaking Minion damage for a boss defeat", () => {
  const initial = teamRun(42, ["mossguard"]);
  const progress = createBattleProgress();
  progress.observe(initial);
  const later = produce(initial, (game) => {
    game.battle!.turn += 10;
  });
  progress.observe(later);
  expect(progress.snapshot()).toMatchObject({ stalled: true, turnsWithoutHealthProgress: 10 });
  const damaged = produce(later, (game) => {
    game.battle!.enemies[0]!.health--;
  });
  progress.observe(damaged);
  expect(progress.snapshot()).toMatchObject({ stalled: false, turnsWithoutHealthProgress: 0 });
  const healed = produce(damaged, (game) => {
    game.battle!.enemies[0]!.health++;
    game.battle!.turn++;
  });
  progress.observe(healed);
  expect(progress.snapshot()).toMatchObject({ turnsWithoutHealthProgress: 1 });
  progress.observe(winBattle(initial));
  expect(progress.snapshot()).toBeNull();
});

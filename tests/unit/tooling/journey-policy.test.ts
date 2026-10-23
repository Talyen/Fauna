import { expect, it } from "vitest";
import { produce } from "immer";
import { createJourneyActor, boonValue } from "../../../src/tooling/journey-policy";
import { createBattleProgress } from "../../../src/tooling/battle-progress";
import { ownedCards } from "../../../src/game/team";
import { dispatch } from "../../../src/game/engine";
import { teamRun, winBattle } from "../../support/game";
import { species, type BoonId, type SpeciesId } from "../../../src/game/content";
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
    const confirmation = actor()(result.state);
    expect(confirmation.command).not.toHaveProperty("replace", state.team[1]!.id);
    const confirmed = dispatch(result.state, confirmation.command);
    expect(confirmed.accepted).toBe(true);
    expect([...confirmed.state.team, ...confirmed.state.reserves].map((unit) => unit.species)).toContain(
      "rookhaven",
    );
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

it("improves a reserve instead of replacing a healthy Legendary with weaker solo damage", () => {
  const base = winBattle(teamRun(42, ["prismram"]));
  const state = produce(base, (game) => {
    game.team[0]!.species = "memento";
    game.team[0]!.health = 60;
    game.cards = ownedCards(game.team[0]!.id, "memento");
    game.discovery.recruited.memento = 1;

    game.reserves = (["captoad", "emberback", "bloomquail", "cadenza"] as const).map((kind, index) => ({
      ...game.team[0]!,
      id: `reserve-${index}`,
      species: kind,
      health: 10,
    }));
    game.reward!.recruits = ["prismram"];
  });
  const selected = actor()(state);
  expect(selected.command).toMatchObject({ type: "recruit", species: "prismram" });
  expect(selected.command).not.toHaveProperty("replace", state.team[0]!.id);
  const result = dispatch(state, selected.command);
  expect(result.accepted).toBe(true);
  expect(result.state.team.map((unit) => unit.id)).toEqual(state.team.map((unit) => unit.id));
  const confirmation = actor()(result.state);
  expect(confirmation.command).not.toHaveProperty("replace", state.team[0]!.id);
  const confirmed = dispatch(result.state, confirmation.command);
  expect(confirmed.accepted).toBe(true);
  expect(confirmed.state.team[0]!.species).toBe("memento");
});

it("releases a reserve when a Legendary recruit would otherwise collapse a stronger deployed team", () => {
  const full = produce(teamRun(42, ["emberback", "prismram", "rookhaven"]), (game) => {
    game.reserves = [
      { ...game.team[0]!, id: "reserve-1", species: "cadenza", health: 0 },
      { ...game.team[0]!, id: "reserve-2", species: "mossguard", health: 0 },
    ];
  });
  const state = produce(winBattle(full), (game) => {
    game.reward!.recruits = ["memento"];
  });
  const selected = actor()(state);
  expect(selected.command).toMatchObject({ type: "recruit", species: "memento" });
  const result = dispatch(state, selected.command);
  expect(result.accepted).toBe(true);
  const confirmation = actor()(result.state);
  expect(
    confirmation.command.type === "confirmRecruit" && confirmation.command.replace?.startsWith("reserve-"),
  ).toBe(true);
  const confirmed = dispatch(result.state, confirmation.command);
  expect(confirmed.accepted).toBe(true);
  expect(confirmed.state.team.map((unit) => unit.id)).toEqual(state.team.map((unit) => unit.id));
});

it("keeps the team after recruitment when the full healthy roster and passive ranks cannot improve", () => {
  const base = winBattle(teamRun(42, ["prismram"]));
  const state = produce(base, (game) => {
    game.team[0]!.species = "memento";
    game.team[0]!.health = 60;
    game.cards = ownedCards(game.team[0]!.id, "memento");

    for (const kind of ["memento", "captoad", "emberback", "bloomquail", "cadenza"] as const)
      game.discovery.recruited[kind] = 6;
    game.reserves = (["captoad", "emberback", "bloomquail", "cadenza"] as const).map((kind, index) => ({
      ...game.team[0]!,
      id: `reserve-${index}`,
      species: kind,
      health: species(kind).health,
    }));
    game.reward!.recruits = ["cadenza"];
  });
  const command = actor()(state).command;
  expect(command).toEqual({ type: "recruit", species: "cadenza" });
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  const confirmation = actor()(result.state);
  expect(confirmation.command).toEqual({ type: "confirmRecruit" });
  const confirmed = dispatch(result.state, confirmation.command);
  expect(confirmed.accepted).toBe(true);
  expect([...confirmed.state.team, ...confirmed.state.reserves].map((unit) => unit.species)).toEqual(
    [...state.team, ...state.reserves].map((unit) => unit.species),
  );
  expect(confirmed.state.team.map((unit) => unit.id)).toEqual(state.team.map((unit) => unit.id));
});

import { expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../../src/game/engine";
import { SPECIES, species } from "../../../src/game/content";
import { canRecruitDestination, canVisitCampfire, canVisitMerchant } from "../../../src/game/destinations";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept, starterJourney, winBattle, recruitChoice } from "../../support/game";

function offer(size = 1) {
  let game = starterJourney(7, "mossguard");
  while (game.roster.length < size) {
    game = produce(game, (draft) => {
      draft.expedition!.recruit = "emberback";
      draft.expedition!.lastRoom = "combat";
    });
    game = accept(game, { type: "recruitDestination", species: "emberback" });
  }
  return produce(game, (draft) => {
    draft.expedition!.recruit = size < 5 ? "cadenza" : null;
    draft.expedition!.lastRoom = "combat";
  });
}

it.each([1, 2, 3, 4])(
  "recruits directly into a %s-creature roster without advancing or rerolling",
  (size) => {
    const before = offer(size);
    const command = { type: "recruitDestination", species: "cadenza" } as const;
    const result = dispatch(decodeSave(encodeSave(before)), command);
    expect(result.accepted).toBe(true);
    const next = result.state;
    expect(next.phase).toBe("teamSelection");
    expect(next.encounter).toBe(before.encounter);
    expect(next.rng).toBe(before.rng);
    expect(next.expedition).toEqual({ ...before.expedition, recruit: null, lastRoom: "recruit" });
    expect(next.currency).toBe(before.currency);
    expect(next.journey).toEqual(before.journey);
    expect(next.roster).toHaveLength(size + 1);
    expect(next.lineup).toHaveLength(Math.min(size + 1, 3));
    const newcomer = [...next.team, ...next.reserves].find((creature) => creature.species === "cadenza")!;
    expect(newcomer.health).toBe(species("cadenza").health);
    expect(next.discovery.recruited.cadenza).toBe(1);
    expect(next.discovery.encountered).toContain("cadenza");
    expect(result.events.some((event) => event.kind === "reward")).toBe(true);
    expect(decodeSave(encodeSave(next))).toEqual(next);
    expect(dispatch(next, command).state).toBe(next);
  },
);

it("rejects other species, full rosters and recruitment during combat without changing state or RNG", () => {
  const game = offer();
  expect(dispatch(game, { type: "recruitDestination", species: "emberback" }).state).toBe(game);
  for (const state of [offer(5), accept(game, { type: "beginBattle" })]) {
    expect(canRecruitDestination(state)).toBe(false);
    expect(dispatch(state, { type: "recruitDestination", species: "cadenza" }).state).toBe(state);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  }
  const full = offer(5);
  const won = winBattle(accept(full, { type: "beginBattle" }));
  const next = accept(won, recruitChoice(won));
  expect(next.expedition!.recruit).toBeNull();
  expect(canRecruitDestination(next)).toBe(false);
});

it("preserves offers through Campfire and reload, then suppresses consecutive Campfires", () => {
  const before = produce(offer(), (draft) => {
    draft.team[0]!.health = 0;
  });
  const visiting = accept(before, { type: "visitCampfire" });
  const rested = accept(decodeSave(encodeSave(visiting)), { type: "rest" });
  expect(rested.expedition!.recruit).toBe(before.expedition!.recruit);
  expect(rested.expedition!.pack).toBe(before.expedition!.pack);
  expect(rested.rng).toBe(before.rng);
  expect(canVisitCampfire(rested)).toBe(false);
  expect(dispatch(rested, { type: "visitCampfire" }).state).toBe(rested);
  expect(canRecruitDestination(rested)).toBe(true);
  const recruited = accept(rested, { type: "recruitDestination", species: "cadenza" });
  expect(canVisitCampfire(recruited)).toBe(true);
  expect(decodeSave(encodeSave(accept(recruited, { type: "abandon" })))).toBeTruthy();
});

it("rolls Recruit and affordable Merchants independently at equal frequency across the entire species pool", () => {
  let recruits = 0,
    merchants = 0,
    together = 0;
  const offered = new Set<string>();
  for (let seed = 1; seed <= 1000; seed++) {
    const initial = createGame(seed);
    let game = accept(initial, { type: "draft", species: initial.starterOffers[0]! });
    game = produce(game, (draft) => {
      draft.currency = 100;
    });
    game = accept(game, { type: "start" });
    const recruit = game.expedition!.recruit;
    if (recruit) {
      recruits++;
      offered.add(recruit);
    }
    if (canVisitMerchant(game)) merchants++;
    if (recruit && canVisitMerchant(game)) together++;
  }
  expect(recruits).toBeGreaterThan(180);
  expect(recruits).toBeLessThan(320);
  expect(merchants).toBeGreaterThan(180);
  expect(merchants).toBeLessThan(320);
  expect(together).toBeGreaterThan(20);
  expect([...offered].sort()).toEqual(SPECIES.map((creature) => creature.id).sort());
  expect(starterJourney(7, "mossguard").support).toBeNull();
});

it("rejects malformed saved offers and does not collect unclaimed creatures on abandonment", () => {
  const before = offer();
  expect(() =>
    decodeSave(JSON.stringify({ ...before, expedition: { ...before.expedition, recruit: "unknown" } })),
  ).toThrow();
  const ended = accept(before, { type: "abandon" });
  expect(ended.expedition!.recruit).toBeNull();
  expect(ended.discovery.recruited.cadenza).toBeUndefined();
  expect(decodeSave(encodeSave(ended))).toEqual(ended);
});

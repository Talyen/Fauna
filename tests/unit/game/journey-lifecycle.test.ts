import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { produce } from "immer";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { BattleState, Command, GameState, RewardState } from "../../../src/game/types";

// Preserve undefined separately from missing keys, while making one trace step readable per line.
function traceLine(value: unknown): string {
  const canonical = (entry: unknown): unknown =>
    entry === undefined
      ? { $undefined: true }
      : Array.isArray(entry)
        ? entry.map(canonical)
        : entry && typeof entry === "object"
          ? Object.fromEntries(
              Object.entries(entry)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, canonical(item)]),
            )
          : entry;
  return JSON.stringify(canonical(value));
}

// The captured commands and expected states have one owner, independent of later policy revisions.
// Removing the former final Boss changes encounter packs, rewards, and subsequent seeded choices.
// Earlier recordings remain in journey-baseline-pre-team-weighting.tsv and journey-baseline-pre-expansion.tsv.
const baselines = new Map<number, string[]>();
for (const line of readFileSync(new URL("./fixtures/journey-baseline.tsv", import.meta.url), "utf8")
  .trimEnd()
  .split("\n")) {
  const separator = line.indexOf("\t");
  const seed = Number(line.slice(0, separator));
  const entries = baselines.get(seed) ?? [];
  entries.push(line.slice(separator + 1));
  baselines.set(seed, entries);
}

// Compare gameplay, RNG and ordered output across the current journey rules.
function fingerprint(state: GameState, events: unknown) {
  const { version: _version, battle, ...rest } = state;
  const projected = {
    ...rest,
    journey: state.journey
      ? {
          ...Object.fromEntries(Object.entries(state.journey).filter(([key]) => key !== "unlocks")),
          lastBattle: state.journey.lastBattle
            ? { xp: state.journey.lastBattle.xp, currency: state.journey.lastBattle.currency }
            : null,
        }
      : null,
    battle: state.phase === "battle" ? battle : null,
    team: state.team.map(({ combat, block, ...unit }) =>
      state.phase === "battle" ? { ...unit, combat, block } : unit,
    ),
    reserves: state.reserves.map(({ combat, block, ...unit }) =>
      state.phase === "battle" ? { ...unit, combat, block } : unit,
    ),
    events,
  };
  // Preserve the dormant Water Thorns field from the original recorded combat shape.
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(
              "thorns" in value && "temporaryDodge" in value ? { ...value, waterThorns: 0 } : value,
            )
              .filter(
                ([key, entry]) =>
                  !(key === "metronomeActor" && entry === null) &&
                  !(key === "fireThorns" && entry === 0) &&
                  !(key === "encoreProgress" && entry === 0) &&
                  !(["oasisLeech", "acrobatReady", "moonseedReady", "toothpickReady"].includes(key) && entry === false) &&
                  !(key === "slipperCard" && entry === null) &&
                  !(key === "puzzleProgress" && Array.isArray(entry) && entry.length === 0) &&
                  !(
                    key === "repeatNext" &&
                    entry &&
                    typeof entry === "object" &&
                    "player" in entry &&
                    "enemy" in entry &&
                    entry.player === false &&
                    entry.enemy === false
                  ),
              )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return createHash("sha256")
    .update(JSON.stringify(canonical(projected)))
    .digest("hex");
}

import { accept, starterJourney, winBattle } from "../../support/game";
import { generateEncounterPack } from "../../../src/game/encounters";

describe("journey lifecycle behavior baseline", () => {
  it.each([3, 10, 98])("preserves seeded commands and outputs for seed %s", (seed) => {
    let state = createGame(seed);
    const trace: unknown[] = [];
    const baseline = baselines.get(seed)!;
    const plays = baseline.flatMap((line) => {
      const [command] = JSON.parse(line) as [
        | {
            type?: string;
            cardId?: string;
            targetId?: string | { $undefined: true };
            autoEndTurn?: boolean;
          }
        | string,
      ];
      return typeof command === "object" && command.type === "play"
        ? [
            {
              ...command,
              type: "play" as const,
              cardId: command.cardId!,
              targetId: typeof command.targetId === "string" ? command.targetId : undefined,
            },
          ]
        : [];
    });
    const step = (command: Command, development = false) => {
      const before = state;
      const result = dispatch(state, command, development);
      if (result.accepted) state = result.state;
      else {
        expect(result.state).toBe(before);
        expect(result.state.rng).toBe(before.rng);
      }
      expect(decodeSave(encodeSave(state))).toEqual(state);
      trace.push([command, result.accepted, state.phase, fingerprint(state, result.events)]);
    };
    step({ type: "endTurn" });
    step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "start" });
    for (let room = 0; room < 8; room++) {
      if (state.support && state.support.stock.some((slot) => slot.price <= state.currency)) {
        const visit = state.support;
        const slot = visit.stock.find((offer) => offer.price <= state.currency)!;
        step({ type: "enterSupport", visit: visit.id });
        step({ type: "buyBoon", visit: visit.id, slot: slot.slot });
        step({ type: "buyBoon", visit: visit.id, slot: slot.slot });
        step({ type: "leaveSupport", visit: visit.id });
      }
      if (state.expedition?.recruit && state.team.length + state.reserves.length < 5)
        step({ type: "recruitDestination", species: state.expedition.recruit });
      step({ type: "beginBattle" });
      const command = plays[room];
      if (command) {
        const preview = previewCard(state, command.cardId, command.targetId);
        expect(state).toEqual(decodeSave(encodeSave(state)));
        trace.push(["preview", preview.accepted, fingerprint(preview.state, preview.events)]);
        step(command);
      }
      if (state.phase === "battle") step({ type: "endTurn" });
      if (state.phase === "battle") step({ type: "devWinBattle" }, true);
      step({ type: "endTurn" });
      if (state.phase === "recruit") {
        step({
          type: "recruit",
          species: state.reward!.recruits[0]!,
        });
      }
      if (state.phase === "recruit" && state.reward.selectedRecruit !== undefined)
        step({ type: "confirmRecruit", replace: state.team.map((unit) => unit.id)[0]! });
      if (state.phase === "boon") step({ type: "chooseBoon", boon: state.reward!.boons[0]! });
      if (state.phase === "victory" || state.phase === "defeat") break;
      state = produce(state, (draft) => {
        draft.team[0]!.health = 1;
      });
      step({ type: "visitCampfire" });
      if (state.phase === "campfire") step({ type: room % 2 ? "leaveCampfire" : "rest" });
    }
    expect(state.phase).toBe("victory");
    step({ type: "newRun", seed: seed + 1 });
    step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "abandon" });
    while (state.phase === "draft" && state.starterOffers.length)
      step({ type: "draft", species: state.starterOffers[0]! });
    step({ type: "start" });
    step({ type: "abandon" });
    expect(trace.map(traceLine)).toEqual(baseline);
  });
});

it("completes the final Boss reward after removing the former Legendary", () => {
  const ready = produce(starterJourney(7, "captoad"), (draft) => {
    draft.encounter = 7;
    draft.journey!.victories = 7;
    draft.expedition!.pack = generateEncounterPack(draft);
  });
  expect(ready.expedition!.pack).toEqual(["memento"]);
  const battle = accept(decodeSave(encodeSave(ready)), { type: "beginBattle" });
  expect(battle.battle!.enemies[0]!.species).toBe("memento");
  const won = winBattle(battle);
  expect(won.reward!.recruits).toEqual(["memento"]);
  const recruited = accept(decodeSave(encodeSave(won)), { type: "recruit", species: "memento" });
  expect(recruited.phase).toBe("victory");
  expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
});

it("uses a valid ordinary final Boss when Memento is on the roster", () => {
  const ready = produce(starterJourney(7, "memento"), (draft) => {
    draft.encounter = 7;
    draft.journey!.victories = 7;
    draft.expedition!.pack = generateEncounterPack(draft);
  });
  expect(ready.expedition!.pack).toHaveLength(1);
  expect(ready.expedition!.pack![0]).not.toBe("memento");
  const battle = accept(decodeSave(encodeSave(ready)), { type: "beginBattle" });
  const result = dispatch(battle, { type: "devWinBattle" }, true);
  expect(result.accepted).toBe(true);
  const won = result.state;
  expect(won.reward!.recruits).toEqual(ready.expedition!.pack);
  expect(accept(won, { type: "recruit", species: won.reward!.recruits[0]! }).phase).toBe("victory");
});

it("keeps a completed receipt detached from recruitment and rejects repeated settlement", () => {
  const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
  expect(won.phase).toBe("recruit");
  expect(won.battle).toBeNull();
  const receipt = won.journey!.lastBattle;
  expect(Object.isFrozen(receipt)).toBe(true);
  const saved = encodeSave(won);
  const resumed = decodeSave(saved);
  const next = accept(resumed, { type: "recruit", species: resumed.reward!.recruits[0]! });
  expect(next.journey!.lastBattle).toEqual(receipt);
  expect(next.currency).toBe(won.currency);
  expect(next.keywordXP).toEqual(won.keywordXP);
  expect(next.battle).toBeNull();
  expect(decodeSave(encodeSave(next))).toEqual(next);
  expect(encodeSave(won)).toBe(saved);
  for (const command of [
    { type: "endTurn" },
    { type: "devWinBattle" },
    { type: "recruit", species: won.reward!.recruits[0]! },
  ] as const) {
    const rejected = dispatch(next, command, true);
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(next);
    expect(rejected.events).toEqual([]);
  }
});

it("rejects phase payload mismatches and contradictory completed receipts", () => {
  const ready = starterJourney(3, "captoad");
  const battle = accept(ready, { type: "beginBattle" });
  const won = winBattle(battle);
  const cases = [
    { ...ready, phase: "battle" },
    { ...battle, reward: won.reward },
    { ...won, battle: battle.battle },
    { ...won, reward: null },
    { ...won, journey: null },
    { ...won, phase: "boon" },
    { ...won, reward: { ...won.reward, currency: won.reward!.currency + 1 } },
    { ...won, journey: { ...won.journey, lastBattle: { ...won.journey!.lastBattle, encounter: 7 } } },
    { ...won, version: 68 },
  ];
  for (const candidate of cases) expect(() => decodeSave(JSON.stringify(candidate))).toThrow();
});

it("preserves the returned result before combat and after a completed reward", () => {
  const ready = starterJourney(3, "captoad");
  const won = winBattle(accept(ready, { type: "beginBattle" }));
  for (const state of [ready, won]) {
    const returned = accept(state, { type: "abandon" });
    expect(returned.journey!.outcome).toBe("returned");
    expect(returned.reward).toBeNull();
    expect(returned.battle).toBeNull();
    expect(returned.currency).toBe(state.currency);
    expect(returned.journey!.lastBattle).toEqual(state.journey!.lastBattle);
    expect(decodeSave(encodeSave(returned))).toEqual(returned);
  }
});

it("exposes required phase payloads in the shared schema types", () => {
  expectTypeOf<BattleState["battle"]>().toEqualTypeOf<NonNullable<GameState["battle"]>>();
  expectTypeOf<BattleState["reward"]>().toEqualTypeOf<null>();
  expectTypeOf<RewardState["battle"]>().toEqualTypeOf<null>();
  expectTypeOf<RewardState["reward"]>().toEqualTypeOf<NonNullable<RewardState["reward"]>>();
});

it("resumes a return home from the final Recruit reward without losing the earned victory", () => {
  const ready = produce(starterJourney(3, "captoad"), (draft) => {
    draft.encounter = 7;
    draft.journey!.victories = 7;
    draft.expedition!.pack = generateEncounterPack(draft);
  });
  const won = winBattle(accept(ready, { type: "beginBattle" }));
  expect(won.phase).toBe("recruit");
  expect(decodeSave(encodeSave(won))).toEqual(won);
  const returned = accept(won, { type: "abandon" });
  expect(returned.journey!.outcome).toBe("returned");
  expect(returned.journey!.lastBattle).toEqual(won.journey!.lastBattle);
  expect(returned.wins).toBe(won.wins);
  expect(returned.currency).toBe(won.currency);
  expect(decodeSave(encodeSave(returned))).toEqual(returned);
});

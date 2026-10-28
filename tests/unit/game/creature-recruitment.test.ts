import { produce } from "immer";
import { expect, it } from "vitest";
import {
  CARDS,
  FIRST_RUN_STARTERS,
  SPECIES,
  definition,
  species,
  type SpeciesId,
} from "../../../src/game/content";
import { createGame, dispatch } from "../../../src/game/engine";
import { COMBAT_PACKS, generateEncounterPack } from "../../../src/game/encounters";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameState } from "../../../src/game/types";
import { almanelleBattle } from "../../support/almanelle";
import {
  accept,
  authoredPack,
  prepareDestination,
  starterJourney,
  teamRun,
  winBattle,
} from "../../support/game";

// Keep the original starter seed and exclusions: the recruit must be a new roster member.
function firstJourney(kind: SpeciesId) {
  const initial = createGame(7);
  return accept(
    accept(initial, { type: "draft", species: initial.starterOffers.find((offer) => offer !== kind)! }),
    { type: "start" },
  );
}
function progressedJourney() {
  return teamRun(1, ["mossguard", "emberback", "prismram"]);
}
function knownRecruit(kind: SpeciesId, lead: SpeciesId) {
  return produce(teamRun(42, [lead, "emberback", "mossguard"]), (draft) => {
    draft.discovery.encountered.push(kind);
    draft.discovery.recruited[kind] = 1;
  });
}

const cases: {
  kind: SpeciesId;
  start: (kind: SpeciesId) => GameState;
  obsoleteVersion?: number;
  copies?: 2;
}[] = [
  { kind: "emberback", start: firstJourney },
  { kind: "pollenmoth", start: firstJourney },
  { kind: "prismram", start: firstJourney, obsoleteVersion: 24 },
  { kind: "reedstag", start: firstJourney, obsoleteVersion: 27 },
  { kind: "cindernewt", start: firstJourney, obsoleteVersion: 28 },
  { kind: "bloomquail", start: firstJourney, obsoleteVersion: 32 },
  { kind: "chimecricket", start: firstJourney },
  { kind: "dawncall", start: firstJourney },
  { kind: "ringpalm", start: firstJourney },
  { kind: "shadebrim", start: progressedJourney },
  { kind: "rookhaven", start: progressedJourney },
  { kind: "stillara", start: progressedJourney },
  { kind: "cadenza", start: progressedJourney },
  { kind: "almanelle", copies: 2, start: almanelleBattle },
  { kind: "parhelion", copies: 2, start: (kind) => knownRecruit(kind, "stillara") },
  { kind: "dulcera", copies: 2, start: (kind) => knownRecruit(kind, "almanelle") },
];

it.each(SPECIES.filter((entry) => !entry.legendary))(
  "discovers and recruits $id from an encounter and resumes the complete kit",
  ({ id }) => {
    const pack = COMBAT_PACKS.find((candidate) => candidate.some((kind) => kind === id));
    const encounter = pack ? pack.findIndex((kind) => kind === id) : 0;
    const authored: readonly SpeciesId[] = pack?.slice(0, encounter + 1) ?? [id];
    const starter = FIRST_RUN_STARTERS.find((kind) => !authored.includes(kind));
    expect(starter).toBeDefined();
    if (!starter) throw new Error(`No starter available outside ${id}'s encounter`);
    // Species without a fixed pack are reachable when an authored pack conflicts with the roster.
    const conflict = COMBAT_PACKS.find((candidate) => candidate[0] === starter);
    if (!pack && !conflict) throw new Error(`No authored encounter conflicts with ${starter}`);
    const ready = produce(starterJourney(7, starter), (draft) => {
      draft.encounter = encounter;
      draft.journey!.victories = encounter;
      if (pack) draft.expedition = { recruit: null, lastRoom: null, pack: [...authored] };
      else {
        const eligible = SPECIES.filter((entry) => !entry.legendary && entry.id !== starter);
        const index = eligible.findIndex((entry) => entry.id === id);
        observeDecisions(draft, () => (index + 0.5) / eligible.length);
        draft.expedition = { recruit: null, lastRoom: null, pack: generateEncounterPack(draft, conflict!) };
      }
    });
    const offered = ready.expedition!.pack!;
    expect(offered).toContain(id);
    const battle = accept(decodeSave(encodeSave(ready)), { type: "beginBattle" });
    expect(battle.battle!.enemies.map((enemy) => enemy.species)).toEqual(offered);
    expect(battle.discovery.encountered).toContain(id);
    const won = dispatch(decodeSave(encodeSave(battle)), { type: "devWinBattle" }, true);
    expect(won.accepted).toBe(true);
    expect(won.state.reward!.recruits).toEqual(offered);
    const recruited = accept(decodeSave(encodeSave(won.state)), { type: "recruit", species: id });
    const creature = recruited.team.find((unit) => unit.species === id);
    expect(creature).toBeDefined();
    expect(recruited.discovery.recruited[id]).toBe(1);
    const kit = recruited.cards
      .filter((card) => card.ownerId === creature!.id)
      .map((card) => card.definitionId);
    expect(kit).toHaveLength(3);
    expect(kit).toEqual(CARDS.filter((card) => card.species === id).map((card) => card.id));
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
  },
);

it("settles a known encounter once and keeps its earnings through saved recruitment", () => {
  const ready = produce(starterJourney(7, "captoad"), (draft) => {
    draft.expedition = { recruit: null, lastRoom: null, pack: ["emberback"] };
  });
  const battle = produce(accept(decodeSave(encodeSave(ready)), { type: "beginBattle" }), (draft) => {
    draft.battleXP = { nature: 4, block: 2 };
  });
  expect(battle.battle!.enemies.map((enemy) => enemy.species)).toEqual(["emberback"]);
  const beforeDenied = encodeSave(battle);
  const denied = dispatch(battle, { type: "devWinBattle" });
  expect(denied.accepted).toBe(false);
  expect(denied.state).toBe(battle);
  expect(denied.events).toEqual([]);
  expect(encodeSave(battle)).toBe(beforeDenied);

  const result = dispatch(decodeSave(encodeSave(battle)), { type: "devWinBattle" }, true);
  expect(result.accepted).toBe(true);
  const won = result.state;
  expect(won.phase).toBe("recruit");
  expect(won.battle).toBeNull();
  expect(won.currency).toBe(20);
  expect(won.keywordXP).toMatchObject({ nature: 4, block: 2 });
  expect(won.journey).toMatchObject({
    victories: 1,
    currency: 20,
    xp: { nature: 4, block: 2 },
    lastBattle: { encounter: 0, outcome: "next", currency: 20, xp: { nature: 4, block: 2 } },
  });
  expect(won.reward).toMatchObject({
    outcome: "next",
    currency: 20,
    xp: { nature: 4, block: 2 },
    recruits: ["emberback"],
    boons: [],
  });
  expect(won.journey!.xp).toEqual({ nature: 4, block: 2 });
  expect(won.reward!.xp).toEqual({ nature: 4, block: 2 });
  const beforeRepeated = encodeSave(won);
  const repeated = dispatch(won, { type: "devWinBattle" }, true);
  expect(repeated.accepted).toBe(false);
  expect(repeated.state).toBe(won);
  expect(repeated.events).toEqual([]);
  expect(encodeSave(won)).toBe(beforeRepeated);

  const recruited = accept(decodeSave(encodeSave(won)), { type: "recruit", species: "emberback" });
  expect(recruited.phase).toBe("teamSelection");
  expect(recruited.team.map((unit) => unit.species)).toEqual(["captoad", "emberback"]);
  expect(recruited.discovery.recruited.emberback).toBe(1);
  expect(recruited.currency).toBe(20);
  expect(recruited.journey!.lastBattle).toEqual(won.journey!.lastBattle);
  expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
  const beforeDuplicate = encodeSave(recruited);
  const duplicate = dispatch(recruited, { type: "recruit", species: "emberback" });
  expect(duplicate.accepted).toBe(false);
  expect(duplicate.state).toBe(recruited);
  expect(duplicate.events).toEqual([]);
  expect(encodeSave(recruited)).toBe(beforeDuplicate);
});

it.each(cases)(
  "discovers, recruits and resumes $kind through its authored encounter",
  ({ kind, start, obsoleteVersion, copies = 1 }) => {
    const initial = start(kind);
    expect(initial.discovery.recruited[kind] ?? 0).toBe(copies - 1);
    const ready = produce(initial, (draft) => {
      if (draft.phase === "battle") prepareDestination(draft);
      const packIndex = COMBAT_PACKS.findIndex((pack) => pack[0] === kind);
      expect(packIndex).toBeGreaterThanOrEqual(0);
      draft.expedition = { recruit: null, lastRoom: null, pack: authoredPack(draft.encounter, packIndex) };
    });
    const battle = accept(ready, { type: "beginBattle" });
    expect(battle.discovery.encountered).toContain(kind);
    expect(battle.battle!.enemies[0]!.species).toBe(kind);
    if (kind === "emberback") expect(battle.battle!.enemies[0]!.combat.armor).toBe(0);
    expect(decodeSave(encodeSave(battle))).toEqual(battle);

    const reward = winBattle(battle);
    expect(reward.reward!.recruits).toContain(kind);
    const recruited = accept(reward, { type: "recruit", species: kind });
    expect(recruited.discovery.recruited[kind]).toBe(copies);
    const creature = [...recruited.team, ...recruited.reserves].find((unit) => unit.species === kind)!;
    expect(creature).toBeDefined();
    const active = start === firstJourney || kind === "almanelle";
    expect(recruited.team.some((unit) => unit.id === creature.id)).toBe(active);
    if (start === firstJourney) expect(recruited.team[1]!.species).toBe(kind);
    expect(
      recruited.cards
        .filter((card) => card.ownerId === creature.id)
        .map((card) => definition(card.definitionId).species),
    ).toEqual(active ? [kind, kind, kind] : []);
    expect(recruited.cards.filter((card) => definition(card.definitionId).species === kind)).toHaveLength(
      active ? 3 : 0,
    );
    expect(CARDS.filter((card) => card.species === kind).map((card) => card.cost)).toEqual([1, 1, 1]);
    expect(species(kind).passiveTiers).toHaveLength(6);
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
    if (obsoleteVersion !== undefined)
      expect(() => decodeSave(JSON.stringify({ ...recruited, version: obsoleteVersion }))).toThrow();
  },
);

it("retains creature-specific recruitment catalog contracts", () => {
  expect(FIRST_RUN_STARTERS).toContain("ringpalm");
  expect(species("dawncall").health).toBe(24);
});

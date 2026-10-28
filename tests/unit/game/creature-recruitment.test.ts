import { produce } from "immer";
import { expect, it } from "vitest";
import { CARDS, FIRST_RUN_STARTERS, definition, species, type SpeciesId } from "../../../src/game/content";
import { createGame } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameState } from "../../../src/game/types";
import { almanelleBattle } from "../../support/almanelle";
import { accept, authoredPack, prepareDestination, teamRun, winBattle } from "../../support/game";

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

import { setBattleCards } from "../../support/cards";
import { produce } from "immer";
import { expect, it } from "vitest";
import { definition, type SpeciesId } from "../../../src/game/content";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { requireBattle, teamRun } from "../../support/game";

function reactionBattle(kind: SpeciesId, effect: string, deathDoorUsed = true) {
  return produce(requireBattle(teamRun(42, [kind, "mossguard", "prismram"])), (draft) => {
    const actor = draft.team[0]!;
    actor.health = 1;
    actor.combat!.deathDoorUsed = deathDoorUsed;
    const card = draft.cards.find((entry) => definition(entry.definitionId).effect === effect)!;
    setBattleCards(draft, [card.id]);
    draft.boons = ["story-puzzle-cube"];
    draft.battle.enemies[0]!.combat.armor = 1;
    draft.rng = 42;
  });
}

it.each(["dawncall", "reverie"] as const)(
  "%s stops group Cleanse and remaining card effects after its returned Poison breaks Molten Shell",
  (kind) => {
    const before = produce(
      reactionBattle(kind, kind === "dawncall" ? "teamCleanse" : "nightmareHarvest"),
      (draft) => {
        draft.boons.push("orbit-armillary");
        draft.battle.puzzleProgress = ["burn", "bleed"];
        for (const ally of draft.team) {
          ally.combat!.poison = 1;
          ally.combat!.statusSources.poison = draft.battle.enemies[0]!.id;
        }
      },
    );
    expect(decodeSave(encodeSave(before))).toEqual(before);

    const result = dispatch(before, { type: "play", cardId: before.battle.hand[0]!, autoEndTurn: false });

    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.health).toBe(0);
    expect(result.state.team.slice(1).map((ally) => ally.combat!.poison)).toEqual([1, 1]);
    expect(result.state.team.slice(1).map((ally) => ally.combat!.burn)).toEqual([1, 1]);
    expect(result.state.battle!.mana).toBe(before.battle.mana - 1);
    expect(result.state.battle!.hand).toEqual([]);
    expect(previewCard(before, before.battle.hand[0]!)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  },
);

it.each([
  ["glintstride", "teamBlind"],
  ["coralcurl", "swap"],
] as const)("%s stops spreading Blind after Puzzle Cube knocks out its caster", (kind, effect) => {
  const before = produce(reactionBattle(kind, effect), (draft) => {
    draft.battle.puzzleProgress = ["burn", "poison"];
  });
  expect(decodeSave(encodeSave(before))).toEqual(before);

  const result = dispatch(before, { type: "play", cardId: before.battle.hand[0]!, autoEndTurn: false });

  expect(result.accepted).toBe(true);
  expect(result.state.team.find((ally) => ally.id === before.team[0]!.id)!.health).toBe(0);
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.blind)).toEqual([true, false, false]);
  expect(previewCard(before, before.battle.hand[0]!)).toEqual(result);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it.each(["stun", "freeze"] as const)(
  "does not deliver %s damage rewards after the triggering control reaction knocks out its source",
  (status) => {
    const before = produce(reactionBattle("dawncall", "teamCleanse"), (draft) => {
      draft.boons.push(
        "orbit-armillary",
        "undertow-castanets",
        status === "stun" ? "thunderstone" : "icy-heart",
      );
      draft.battle.puzzleProgress = ["burn", "poison"];
      const actor = draft.team[0]!;
      const enemy = draft.battle.enemies[0]!;
      const other = status === "stun" ? "freeze" : "stun";
      actor.combat![status] = 1;
      actor.combat!.statusSources[status] = enemy.id;
      enemy.combat[other] = enemy.maxHealth / 2 - 1;
      enemy.combat.statusSources[other] = actor.id;
    });
    expect(decodeSave(encodeSave(before))).toEqual(before);

    const result = dispatch(before, { type: "play", cardId: before.battle.hand[0]!, autoEndTurn: false });

    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.health).toBe(0);
    expect(result.state.battle!.enemies[0]!.combat.controlled).toBe(status);
    expect(result.state.battle!.enemies[0]!.health).toBe(before.battle.enemies[0]!.health);
    expect(previewCard(before, before.battle.hand[0]!)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  },
);

it("stops Thunderstone if Thunder Conch's Blind reaction knocks out the source", () => {
  const before = produce(reactionBattle("dawncall", "teamCleanse"), (draft) => {
    draft.boons.push("orbit-armillary", "undertow-castanets", "thunderstone", "thunder-conch");
    draft.battle.puzzleProgress = ["poison"];
    const actor = draft.team[0]!;
    const enemy = draft.battle.enemies[1]!;
    actor.combat!.stun = 1;
    actor.combat!.statusSources.stun = enemy.id;
    enemy.combat.freeze = enemy.maxHealth / 2 - 1;
    enemy.combat.statusSources.freeze = actor.id;
  });
  expect(decodeSave(encodeSave(before))).toEqual(before);

  const result = dispatch(before, { type: "play", cardId: before.battle.hand[0]!, autoEndTurn: false });

  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.health).toBe(0);
  expect(result.state.battle!.enemies[0]!.combat.blind).toBe(true);
  expect(result.state.battle!.enemies[1]!.combat.controlled).toBe("stun");
  expect(result.state.battle!.enemies[1]!.health).toBe(before.battle.enemies[1]!.health);
  expect(result.state.battle!.enemies[2]!.combat.blind).toBe(false);
  expect(previewCard(before, before.battle.hand[0]!)).toEqual(result);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("continues the card when Molten Shell only triggers Death's Door", () => {
  const before = produce(reactionBattle("dawncall", "teamCleanse", false), (draft) => {
    draft.boons.push("orbit-armillary");
    draft.battle.puzzleProgress = ["burn", "bleed"];
    for (const ally of draft.team) {
      ally.combat!.poison = 1;
      ally.combat!.statusSources.poison = draft.battle.enemies[0]!.id;
    }
  });

  const result = dispatch(before, { type: "play", cardId: before.battle.hand[0]!, autoEndTurn: false });

  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.health).toBe(1);
  expect(result.state.team[0]!.combat!.grace).toBeGreaterThan(0);
  expect(result.state.team.map((ally) => ally.combat!.poison)).toEqual([0, 1, 1]);
  expect(result.state.team.slice(1).map((ally) => ally.combat!.burn)).toEqual([0, 0]);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

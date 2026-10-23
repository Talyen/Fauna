import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, SPECIES, definition, BOONS, TALENTS } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import { freshCombat } from "../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../src/game/engine";
import { retainedBlock } from "../../../src/game/ability-rules";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { battleChoices } from "../../../src/application/battle-policy";
import { KEYWORD_DEFINITIONS } from "../../../src/game/keywords";
import { GLOSSARY } from "../../../src/game/glossary";
import { teamRun } from "../../support/game";

function ready(id: string) {
  return produce(teamRun(1, ["mossguard", "emberback", "prismram"]), (game) => {
    game.rng = 1;
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    for (const enemy of game.battle!.enemies) {
      enemy.block = 0;
      enemy.combat = freshCombat();
      enemy.combat.controlled = "freeze";
      enemy.combat.controlTurns = 1;
    }
  });
}

it("braces only Mossguard and rejects a different recipient without spending Mana or RNG", () => {
  const game = ready("mossguard-guard");
  const cardId = game.battle!.hand[0]!;
  const rejected = dispatch(game, { type: "play", cardId, targetId: "ally-1" });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
  const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.team.map((ally) => ally.block)).toEqual([6, 0, 0]);
  expect(result.state.battle!.mana).toBe(game.battle!.mana - 1);
  expect(battleChoices(game, false)[0]).toEqual({
    type: "play",
    cardId,
    targetId: undefined,
    autoEndTurn: false,
  });
  expect(cardText(definition("mossguard-guard"))).toBe("Gain 6 Block");
});

it("stomps every living enemy once, awards Stun XP once and previews without mutating state", () => {
  const game = produce(ready("mossguard-attack"), (draft) => {
    draft.battle!.enemies[1]!.health = 0;
    draft.battle!.enemies[0]!.combat.controlled = null;
    draft.battle!.enemies[0]!.combat.controlTurns = 0;
  });
  const before = encodeSave(game);
  const cardId = game.battle!.hand[0]!;
  const preview = previewCard(game, cardId);
  const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
    game.battle!.enemies.map((enemy) => Math.max(0, enemy.health - 2)),
  );
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.stun)).toEqual([2, 0, 0]);
  expect(result.state.battleXP.stun).toBe(1);
  expect(preview.events).toEqual(result.events);
  expect(preview.state).toEqual(result.state);
  expect(encodeSave(game)).toBe(before);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  expect(cardText(definition("mossguard-attack"))).toBe("Deal 2 Stun damage to all enemies");
});

it("renews the living deployed team including self, caps healing and leaves knockouts and reserves alone", () => {
  const game = produce(ready("mossguard-heal"), (draft) => {
    draft.team[0]!.health -= 5;
    draft.team[1]!.health -= 1;
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[0]!, id: "reserve", health: 10 });
    draft.roster.push("mossguard");
  });
  const cardId = game.battle!.hand[0]!;
  const command = { type: "play", cardId, autoEndTurn: false } as const;
  const pending = dispatch(game, command);
  expect(pending.accepted).toBe(false);
  expect(pending.state).toBe(game);
  // With no living replacement, the remaining deployed creatures may act normally
  const withoutReplacement = produce(game, (draft) => {
    draft.reserves[0]!.health = 0;
  });
  const result = dispatch(withoutReplacement, command);
  expect(result.accepted).toBe(true);
  expect(result.state.team.map((ally) => ally.health)).toEqual([29, 30, 0]);
  expect(result.state.reserves).toEqual(withoutReplacement.reserves);
  expect(result.state.battleXP.health).toBe(1);
  expect(result.state.battle!.mana).toBe(game.battle!.mana - 1);
  expect(previewCard(withoutReplacement, cardId).state).toEqual(result.state);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  expect(cardText(definition("mossguard-heal"))).toBe("Restore 2 Health to all allies");
});

it.each([1, 2, 3, 4, 5, 6])("retains Overgrowth Block at copy count %i across turns and resume", (copies) => {
  const game = produce(ready("mossguard-guard"), (draft) => {
    draft.discovery.recruited.mossguard = copies;
    draft.team.forEach((ally) => {
      ally.block = 100;
    });
    draft.reserves.push({ ...draft.team[0]!, id: "reserve", block: 100 });
    draft.roster.push("mossguard");
    draft.battle!.enemies.forEach((enemy) => {
      enemy.combat.controlled = "stun";
      enemy.combat.controlTurns = 1;
    });
  });
  const resumed = decodeSave(encodeSave(game));
  const result = dispatch(resumed, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.state.team.map((ally) => ally.block)).toEqual([50 + copies * 5, 50, 50]);
  expect(result.state.reserves[0]!.block).toBe(50 + copies * 5);
  expect(retainedBlock(game.team[0]!)).toBe(55); // Enemy species use the base tier
  expect(retainedBlock({ species: "mossguard", block: 7 }, game)).toBe(
    Math.round((7 * (100 + copies * 10)) / 200),
  );
});

it("keeps effect descriptions free of periods and rejects obsolete development saves", () => {
  const descriptions = [
    ...CARDS.map((card) => cardText(card)),
    ...SPECIES.flatMap((entry) => entry.passiveTiers.flatMap((tier) => (tier ? [tier.description] : []))),
    ...TALENTS.map((talent) => talent.text),
    ...BOONS.map((boon) => boon.text),
    ...Object.values(KEYWORD_DEFINITIONS).map((keyword) => keyword.description),
    ...GLOSSARY.map((entry) => entry.definition),
  ];
  expect(descriptions.every((text) => !text.includes("."))).toBe(true);
  expect(() => decodeSave(JSON.stringify({ ...ready("mossguard-guard"), version: 23 }))).toThrow();
});

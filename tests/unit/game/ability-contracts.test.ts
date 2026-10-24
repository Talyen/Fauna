import { createHash } from "node:crypto";
import { produce } from "immer";
import { expect, it } from "vitest";
import { CARDS, FOOD_CARDS, definition, type SpeciesId } from "../../../src/game/content";
import { PEARL } from "../../../src/game/content/creatures/memento";
import { cardTargeting, cardText, enemyCard, enemyCanUse } from "../../../src/game/card-rules";
import { definitionKeywords } from "../../../src/game/keywords";
import { primaryAbilityValue, abilityExtras } from "../../../src/game/combat/ability-values";
import { availablePlays } from "../../../src/game/play-queries";
import { dispatch, previewCard } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { requireBattle, teamRun } from "../../support/game";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Recorded before moving ability policies or handlers. Never regenerate these to accept a refactor.
it("preserves authored text, targeting, scaling, keywords and enemy adaptations", () => {
  expect(
    [...CARDS, PEARL, ...FOOD_CARDS].map((card) => ({
      id: card.id,
      digest: digest({
        targeting: cardTargeting(card),
        keywords: definitionKeywords(card),
        enemy: enemyCard(card),
        enemySupported: enemyCanUse(card),
        variants: [1, 1.6].flatMap((power) =>
          [0, 2].map((level) => ({
            text: cardText(card, level, undefined, power),
            resolvedText: cardText(card, level, 19, power),
            value: primaryAbilityValue(card, card.value + level * 2, power),
            extras: abilityExtras(card, power),
          })),
        ),
      }),
    })),
  ).toMatchSnapshot();
});

const scenarios: { name: string; species: SpeciesId; effect: string; reflection?: boolean }[] = [
  { name: "recipient healing and cleanse", species: "reedstag", effect: "heal" },
  { name: "recovery and recipient healing", species: "almanelle", effect: "recover" },
  { name: "generated Food", species: "orifable", effect: "createFood" },
  { name: "generated Pearls", species: "memento", effect: "createPearls" },
  { name: "random attack", species: "pollenmoth", effect: "attack" },
  { name: "reflected attack and extras", species: "emberback", effect: "attack", reflection: true },
  { name: "group protection", species: "ringpalm", effect: "teamProtection" },
  { name: "attack reflection grant", species: "oathara", effect: "reflectAttack" },
];

it.each(scenarios)("preserves commands, previews, save/resume and rankings: $name", (scenario) => {
  const game = requireBattle(produce(teamRun(42, [scenario.species]), (draft) => {
    const card = draft.cards.find((entry) => definition(entry.definitionId).effect === scenario.effect)!;
    expect(card).toBeDefined();
    draft.battle!.hand = [card.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    draft.team[0]!.health = 5;
    draft.team[0]!.combat!.poison = 2;
    if (scenario.reflection) {
      for (const enemy of draft.battle!.enemies) enemy.combat.attackReflection = true;
    }
  }));
  const before = encodeSave(game);
  const command = availablePlays(game, false)[0]!.commands[0]!;
  const result = dispatch(game, command);
  expect(result.accepted).toBe(true);
  expect(dispatch(decodeSave(before), command)).toEqual(result);
  expect(result.state.rng).toBe(dispatch(game, command).state.rng);
  const preview = previewCard(game, command.cardId, command.targetId);
  const rejection = dispatch(game, { ...command, cardId: "missing" });
  expect(rejection.accepted).toBe(false);
  expect(rejection.state).toBe(game);
  expect(encodeSave(game)).toBe(before);
  expect({
    command,
    committed: digest(result),
    preview: digest(preview),
    rankings: rankedBattleChoices(game, false),
    enemyTurn: digest(dispatch(game, { type: "endTurn" })),
  }).toMatchSnapshot();
});

import { expect, it } from "vitest";
import { cardCost } from "../../../src/game/ability-rules";
import { teamRun } from "../../support/game";

it.each([
  ["reedstag", "reedstag-guard", "freeNature", 0],
  ["reedstag", "reedstag-heal", "freeNature", 1],
  ["pollenmoth", "pollenmoth-attack", "freeLight", 0],
  ["pollenmoth", "pollenmoth-teamGuard", "freeLight", 1],
  ["emberback", "emberback-attack", "freeCard", 0],
] as const)("%s's %s respects the owner and keyword of %s", (kind, definitionId, flag, expected) => {
  const state = structuredClone(teamRun(42, [kind, kind]));
  const [actor, other] = state.team;
  const card = state.cards.find((card) => card.definitionId === definitionId)!;
  expect(cardCost(card, state)).toBe(1);
  other!.combat![flag] = true;
  expect(cardCost(card, state)).toBe(1);
  actor!.combat![flag] = true;
  const before = JSON.stringify(state);
  expect(cardCost(card, state)).toBe(expected);
  expect(JSON.stringify(state)).toBe(before);
});

it("Flashpoint discounts only Burn cards until spent, alongside independent creature rewards", () => {
  const state = structuredClone(teamRun(42, ["emberback", "reedstag"]));
  const burn = state.cards.find((card) => card.definitionId === "emberback-furnace-breath")!;
  const nature = state.cards.find((card) => card.definitionId === "reedstag-attack")!;
  state.talents = ["burn.flashpoint"];
  expect(cardCost(burn, state)).toBe(0);
  expect(cardCost(nature, state)).toBe(1);
  state.battle!.freeBurnUsed = true;
  expect(cardCost(burn, state)).toBe(1);
  state.team[1]!.combat!.freeNature = true;
  expect(cardCost(nature, state)).toBe(0);
  state.team[0]!.combat!.freeCard = true;
  expect(cardCost(burn, state)).toBe(0);
});

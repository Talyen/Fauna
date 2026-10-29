import { produce } from "immer";
import { expect, it } from "vitest";
import { SPECIES, speciesCards } from "../../../src/game/content";
import { bossDeck } from "../../../src/game/combat/legendary";
import { shuffle } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { ownedCards } from "../../../src/game/team";
import { accept, authoredPack, prepareDestination, requireBattle, run, teamRun } from "../../support/game";

function bossBattle() {
  const destination = produce(run(), (state) => {
    prepareDestination(state);
    state.encounter = 9;
    state.journey!.victories = 9;
    state.expedition.pack = authoredPack(9);
  });
  return requireBattle(accept(destination, { type: "beginBattle" }));
}

it("preserves each creature's ordered permanent slots and boss shuffle decisions", () => {
  for (const creature of SPECIES) {
    const expected = speciesCards(creature.id).flatMap((card) =>
      Array.from({ length: creature.legendary ? 2 : 1 }, (_, copy) => ({
        id: `owner:${card.id}${copy ? ":2" : ""}`,
        definitionId: card.id,
        ownerId: "owner",
        level: 0,
      })),
    );
    expect(ownedCards("owner", creature.id)).toEqual(expected);
  }
  const battle = bossBattle();
  const actualState = structuredClone(battle);
  const expectedState = structuredClone(battle);
  const enemy = actualState.battle.enemies[0]!;
  const ids = speciesCards(enemy.species).flatMap((card) => [card.id, card.id]);
  const expected = shuffle(expectedState, ids);
  expect(bossDeck(actualState, enemy).draw).toEqual(expected);
  expect(actualState.rng).toBe(expectedState.rng);
});

it("resumes intact kits but rejects substituted or missing permanent cards on either side", () => {
  const player = requireBattle(teamRun(42, ["memento"]));
  expect(decodeSave(encodeSave(player))).toEqual(player);
  const playerCorrupt = produce(player, (state) => {
    state.cards[0]!.definitionId = state.cards[2]!.definitionId;
  });
  expect(() => decodeSave(encodeSave(playerCorrupt))).toThrow();
  const foreignCard = produce(player, (state) => {
    state.cards[0]!.definitionId = speciesCards("emberback")[0]!.id;
  });
  expect(() => decodeSave(encodeSave(foreignCard))).toThrow();

  const boss = bossBattle();
  expect(decodeSave(encodeSave(boss))).toEqual(boss);
  const foreignAbility = produce(boss, (state) => {
    state.battle.enemies[0]!.lastAbility = speciesCards("emberback")[0]!.id;
  });
  expect(() => decodeSave(encodeSave(foreignAbility))).toThrow();
  const corrupted = produce(boss, (state) => {
    const deck = state.battle.enemies[0]!.deck!;
    deck.draw[0] = "memento-pearl";
    deck.pearls++;
  });
  expect(() => decodeSave(encodeSave(corrupted))).toThrow();
});

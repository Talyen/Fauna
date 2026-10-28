import { expect, it } from "vitest";
import { produce } from "immer";
import { immediateArtwork, likelyArtwork, startupBaseArtwork } from "../../../../src/ui/startup/artwork";
import prepared from "../../../../src/assets/prepared.json" with { type: "json" };
import { createGame } from "../../../../src/game/engine";
import { definition, speciesCards } from "../../../../src/game/content";
import { assetUrl } from "../../../../src/ui/shared/assets";
import {
  accept,
  run,
  winBattle,
  bossReward,
  merchantDestination,
  starterJourney,
} from "../../../support/game";

it("warms only offered starters and shared menu assets on a fresh start, without changing RNG", () => {
  const game = createGame(7);
  const before = JSON.stringify(game);
  const urls = immediateArtwork(game);
  expect(urls).toEqual(
    expect.arrayContaining([
      ...startupBaseArtwork,
      ...game.starterOffers.map((id) => assetUrl(`creature.${id}`)),
    ]),
  );
  expect(urls.length).toBeLessThan(12);
  expect(new Set(urls).size).toBe(urls.length);
  expect(JSON.stringify(game)).toBe(before);
  expect(likelyArtwork(game).length).toBeLessThanOrEqual(8);
  expect(likelyArtwork(game).every((url) => !urls.includes(url))).toBe(true);
});
it("prefetches distinct selected abilities in order up to the eight-image limit", () => {
  const game = produce(createGame(7), (draft) => {
    draft.selected = [...draft.starterOffers];
  });
  const expected = game.selected.flatMap(speciesCards).map((card) => assetUrl(card.artwork!));
  expect(new Set(expected).size).toBeGreaterThan(8);
  const before = JSON.stringify(game);
  expect(likelyArtwork(game)).toEqual([...new Set(expected)].slice(0, 8));
  expect(JSON.stringify(game)).toBe(before);
});
it("warms the saved combat's visible hand, creatures and minions without loading the full deck", () => {
  const game = run();
  if (game.phase !== "battle") throw new Error("fixture");
  const urls = immediateArtwork(game);
  for (const unit of [...game.team, ...game.reserves, ...game.battle.enemies])
    expect(urls).toContain(assetUrl(`creature.${unit.species}`));
  for (const id of game.battle.hand) {
    const def = definition(game.cards.find((card) => card.id === id)!.definitionId);
    expect(urls).toContain(assetUrl(def.artwork ?? `action.${def.species}`));
  }
  const minions = produce(game, (draft) => {
    draft.battle.minions = [
      {
        ...draft.battle.enemies[0]!,
        name: "Echo",
        species: "memento",
        lastAbility: null,
        minion: { ownerId: "boss", side: "enemy" },
      },
    ];
  });
  expect(immediateArtwork(minions)).toContain(assetUrl("minion.echo"));
  expect(urls.length).toBeLessThan(Object.keys(prepared.records).length / 2);
});
it("covers recruitment, Boon and Merchant choices", () => {
  const reward = winBattle();
  if (reward.phase !== "recruit") throw new Error("fixture");
  for (const id of reward.reward.recruits)
    expect(immediateArtwork(reward)).toContain(assetUrl(`creature.${id}`));
  const boon = bossReward();
  if (boon.phase !== "boon") throw new Error("fixture");
  for (const id of boon.reward.boons) expect(immediateArtwork(boon)).toContain(assetUrl(`boon.${id}`));
  const destination = merchantDestination();
  expect(immediateArtwork(destination)).toContain(assetUrl("location.silken-clearing"));
  const merchant = accept(destination, { type: "enterSupport", visit: destination.support!.id });
  for (const slot of merchant.support!.stock)
    expect(immediateArtwork(merchant)).toContain(assetUrl(`boon.${slot.boon}`));
});
it("covers ordinary and Boss destinations, Campfire and completed journeys", () => {
  const destination = starterJourney(7, "emberback");
  expect(immediateArtwork(destination)).toContain(assetUrl("encounter.combat"));
  const hurt = produce(destination, (draft) => {
    draft.team[0]!.health = 1;
  });
  expect(immediateArtwork(hurt)).toContain(assetUrl("location.ember-grove"));
  const campfire = accept(hurt, { type: "visitCampfire" });
  expect(immediateArtwork(campfire)).toContain(assetUrl("creature.emberback"));
  const boss = produce(destination, (draft) => {
    draft.encounter = 3;
    draft.expedition!.pack = ["memento"];
  });
  expect(immediateArtwork(boss)).toContain(assetUrl("creature.memento"));
  const failed = accept(run(), { type: "abandon" });
  expect(immediateArtwork(failed)).toEqual(startupBaseArtwork);
});

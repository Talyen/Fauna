import { expect, it } from "vitest";
import { produce } from "immer";
import { immediateArtwork, allArtwork, startupBaseArtwork } from "../../../../src/ui/startup/artwork";
import { createGame } from "../../../../src/game/engine";
import { definition } from "../../../../src/game/content";
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
  expect(allArtwork.every((url) => /\.(png|webp|svg)$/.test(url))).toBe(true);
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
  expect(urls.length).toBeLessThan(allArtwork.length / 2);
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

import { assetUrl } from "../shared/assets";
import { definition, speciesCards } from "../../game/content";
import { bossEncounter, encounterSource } from "../../game/encounters";
import { canRecruitDestination, canVisitCampfire, canVisitMerchant } from "../../game/destinations";
import type { GameState } from "../../game/types";

export const startupBaseArtwork = [
  "logo.main-menu",
  "mana.full",
  "mana.empty",
  "card.back",
  "pile.draw",
  "pile.discard",
].map(assetUrl);
/** Owned abilities are useful prefetch candidates without inspecting hidden draws or resolving RNG. */
export function likelyArtwork(game: GameState) {
  const visible = new Set(immediateArtwork(game));
  const definitions =
    game.phase === "draft"
      ? (game.selected.length ? game.selected : game.starterOffers).flatMap(speciesCards)
      : game.cards.map((card) => definition(card.definitionId));
  return [...new Set(definitions.map((card) => assetUrl(card.artwork ?? `action.${card.species}`)))]
    .filter((url) => !visible.has(url))
    .slice(0, 8);
}

/** Select the actual saved next screen without resolving commands or advancing RNG. */
export function immediateArtwork(game: GameState) {
  const ids = new Set<string>();
  const creature = (id: string) => ids.add(`creature.${id}`);
  switch (game.phase) {
    case "draft":
      (game.selected.length ? game.selected : game.starterOffers).forEach(creature);
      break;
    case "battle":
      [...game.team, ...game.reserves, ...game.battle.enemies].forEach((unit) => creature(unit.species));
      if (game.battle.minions?.length) ids.add("minion.echo");
      for (const id of game.battle.hand) {
        const card = game.cards.find((card) => card.id === id)!;
        const def = definition(card.definitionId);
        ids.add(def.artwork ?? `action.${def.species}`);
      }
      break;
    case "recruit":
      game.reward.recruits.forEach(creature);
      if (game.reward.selectedRecruit) {
        creature(game.reward.selectedRecruit);
        [...game.team, ...game.reserves].forEach((unit) => creature(unit.species));
      }
      break;
    case "boon":
      game.reward.boons.forEach((id) => ids.add(`boon.${id}`));
      break;
    case "teamSelection":
      if (canVisitMerchant(game)) ids.add("location.silken-clearing");
      if (canVisitCampfire(game)) ids.add("location.ember-grove");
      if (canRecruitDestination(game)) creature(game.expedition.recruit!);
      if (bossEncounter(game)) creature(encounterSource(game).enemies[0]!.species);
      else ids.add("encounter.combat");
      break;
    case "campfire":
      [...game.team, ...game.reserves].forEach((unit) => creature(unit.species));
      break;
    case "support":
      if (game.support.purchased) ids.add(`boon.${game.support.purchased}`);
      else game.support.stock.forEach((slot) => ids.add(`boon.${slot.boon}`));
      break;
    case "victory":
    case "defeat":
      break;
    default: {
      const exhaustive: never = game;
      return exhaustive;
    }
  }
  return [...new Set([...startupBaseArtwork, ...[...ids].map(assetUrl)])];
}

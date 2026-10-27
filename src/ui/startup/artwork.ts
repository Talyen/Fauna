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
  const candidates = new Set<string>();
  const checked = new Set<string>();
  const add = (card: ReturnType<typeof definition>) => {
    const id = card.artwork ?? `action.${card.species}`;
    if (checked.has(id)) return;
    checked.add(id);
    const url = assetUrl(id);
    if (!visible.has(url)) candidates.add(url);
  };
  if (game.phase === "draft") {
    for (const kind of game.selected.length ? game.selected : game.starterOffers) {
      for (const card of speciesCards(kind)) {
        add(card);
        if (candidates.size === 8) return [...candidates];
      }
    }
  } else {
    for (const card of game.cards) {
      add(definition(card.definitionId));
      if (candidates.size === 8) return [...candidates];
    }
  }
  return [...candidates];
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
      for (const row of [game.team, game.reserves, game.battle.enemies])
        for (const unit of row) creature(unit.species);
      if (game.battle.minions?.length) ids.add("minion.echo");
      const handCards =
        game.battle.hand.length > 1 ? new Map<string, (typeof game.cards)[number]>() : undefined;
      if (handCards) for (const card of game.cards) if (!handCards.has(card.id)) handCards.set(card.id, card);
      for (const id of game.battle.hand) {
        const card = handCards ? handCards.get(id)! : game.cards.find((card) => card.id === id)!;
        const def = definition(card.definitionId);
        ids.add(def.artwork ?? `action.${def.species}`);
      }
      break;
    case "recruit":
      game.reward.recruits.forEach(creature);
      if (game.reward.selectedRecruit) {
        creature(game.reward.selectedRecruit);
        for (const row of [game.team, game.reserves]) for (const unit of row) creature(unit.species);
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
      for (const row of [game.team, game.reserves]) for (const unit of row) creature(unit.species);
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
  const urls = new Set(startupBaseArtwork);
  for (const id of ids) urls.add(assetUrl(id));
  return [...urls];
}

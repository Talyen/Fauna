import { assetUrl, minionArtwork, summonArtwork } from "../shared/assets";
import { definition, speciesCards, GENERATED_CARDS } from "../../game/content";
import { encounterSource } from "../../game/encounters";
import { canRecruitDestination, canVisitCampfire, canVisitMerchant } from "../../game/destinations";
import type { GameState } from "../../game/types";
import pointerArtwork from "../shared/assets/pointer-c-shaded.png";
import { MAX_SUPPORTED_HAND_SIZE } from "../../game/card-zones";
import { MINION_LIMIT } from "../../game/combat/legendary";

export const startupBaseArtwork = [
  pointerArtwork,
  ...["logo.main-menu", "mana.full", "mana.empty", "card.back", "pile.draw", "pile.discard"].map(assetUrl),
];

function* candidateCards(game: GameState): Generator<ReturnType<typeof definition>> {
  if (game.phase === "draft") {
    for (const kind of game.selected.length ? game.selected : game.starterOffers) yield* speciesCards(kind);
  } else {
    for (const card of game.cards) yield definition(card.definitionId);
  }
}

/** Owned abilities are useful prefetch candidates without inspecting hidden draws or resolving RNG. */
export function likelyArtwork(game: GameState) {
  const visible = new Set(immediateArtwork(game));
  const candidates = new Set<string>();
  const checked = new Set<string>();
  for (const card of candidateCards(game)) {
    const id = card.artwork ?? `action.${card.species}`;
    if (checked.has(id)) continue;
    checked.add(id);
    const url = assetUrl(id);
    if (!visible.has(url)) candidates.add(url);
  }
  if (game.phase === "teamSelection") {
    for (const enemy of encounterSource(game).enemies) {
      candidates.add(assetUrl(`creature.${enemy.species}`));
      for (const url of speciesArtwork(enemy.species)) candidates.add(url);
    }
    for (const unit of [...game.team, ...game.reserves])
      for (const url of speciesArtwork(unit.species)) candidates.add(url);
    for (const card of GENERATED_CARDS) candidates.add(assetUrl(card.artwork!));
    for (const url of summonArtwork) candidates.add(url);
  }
  for (const url of visible) candidates.delete(url);
  return [...candidates];
}

export const speciesArtwork = (kind: Parameters<typeof speciesCards>[0]) =>
  speciesCards(kind).map((card) => assetUrl(card.artwork ?? `action.${card.species}`));

/** A battle prepares its full draw/generation/inspection set before the first frame. */
export function battleArtwork(game: GameState) {
  const urls = new Set(immediateArtwork(game));
  if (game.phase !== "battle") return [...urls];
  for (const card of game.cards) {
    const def = definition(card.definitionId);
    urls.add(assetUrl(def.artwork ?? `action.${def.species}`));
  }
  for (const unit of [...game.team, ...game.reserves, ...game.battle.enemies])
    for (const url of speciesArtwork(unit.species)) urls.add(url);
  const capacity = new Map<string, number>();
  // Copies can fill a hand with one picture; prepare live cards and both motion cohorts in advance.
  const handCopies = 3 * MAX_SUPPORTED_HAND_SIZE + 2;
  for (const card of [...game.cards.map((card) => definition(card.definitionId)), ...GENERATED_CARDS])
    capacity.set(assetUrl(card.artwork ?? `action.${card.species}`), handCopies);
  const summonCopies =
    2 * MINION_LIMIT * (game.team.length + game.reserves.length + game.battle.enemies.length) + 2;
  for (const url of summonArtwork) capacity.set(url, summonCopies);
  for (const url of capacity.keys()) urls.add(url);
  return [...urls].flatMap((url) => Array<string>(capacity.get(url) ?? 1).fill(url));
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
      for (const minion of game.battle.minions ?? []) ids.add(minionArtwork(minion.species));
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
      for (const enemy of encounterSource(game).enemies) creature(enemy.species);
      if (game.support?.purchased) ids.add(`boon.${game.support.purchased}`);
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

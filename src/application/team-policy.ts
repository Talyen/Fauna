import { creaturePassive } from "../game/progression";
import { speciesCards, species, type SpeciesId } from "../game/content";
import { definitionKeywords } from "../game/keywords";
import type { GameState } from "../game/types";

export function capabilities(state: GameState, kinds: readonly SpeciesId[]) {
  const result = new Set<string>();
  for (const kind of kinds) {
    for (const card of speciesCards(kind)) {
      for (const keyword of definitionKeywords(card)) result.add(keyword);
      if (card.effect === "attack") {
        result.add("attack");
        if (
          [card.damageType, card.alternateDamageType].some(
            (type) => type && type !== "physical" && type !== "stun",
          )
        )
          result.add("armorBypass");
      }
      if (
        card.effect === "dreamDouble" ||
        card.effect === "sparkDecoy" ||
        card.effect === "waterThorns" ||
        card.effect === "teamProtection" ||
        card.effects?.some(
          (effect) =>
            effect.kind === "damage" && effect.damageType !== "physical" && effect.damageType !== "stun",
        )
      )
        result.add("armorBypass");
      if (card.effect === "teamPurge" || card.effects?.some((effect) => effect.kind === "purge"))
        result.add("purge");
      if (
        card.effect === "nightmareHarvest" ||
        card.effect === "teamCleanse" ||
        card.effect === "springbound" ||
        card.effects?.some((effect) => effect.kind === "cleanse")
      )
        result.add("cleanse");
    }
    for (const effect of creaturePassive(state, kind).effects) {
      if (effect.kind === "courtRemembers") {
        result.add("attack");
        result.add("water");
        result.add("armorBypass");
      }
      if (
        effect.kind === "unhurried" ||
        effect.kind === "livingChorus" ||
        effect.kind === "lastWarmth" ||
        effect.kind === "tidalRegeneration" ||
        effect.kind === "petalwake"
      )
        result.add("health");
      if (effect.kind === "dodgeBurn") {
        result.add("burn");
        result.add("armorBypass");
      }
      if (effect.kind === "poisonRetaliation") {
        result.add("poison");
        result.add("armorBypass");
      }
    }
  }
  return result;
}
export function coverageScore(state: GameState, kinds: SpeciesId[]) {
  const has = capabilities(state, kinds);
  return (
    (has.has("attack") ? 3000 : 0) +
    (has.has("armorBypass") ? 1000 : 0) +
    (has.has("purge") ? 800 : 0) +
    (has.has("health") ? 200 : 0) +
    (has.has("cleanse") ? 100 : 0) +
    has.size * 20
  );
}
/** Approximate damage over an authored kit rotation; no enemy intent or chance is sampled. */
export function offenseValue(state: GameState, kind: SpeciesId): number {
  const cards = speciesCards(kind);
  const authored = cards.reduce(
    (sum, card) =>
      sum +
      (card.effect === "attack" ? card.value : 0) +
      (card.effects?.reduce((n, effect) => n + (effect.kind === "damage" ? effect.amount : 0), 0) ?? 0),
    0,
  );
  const passive = creaturePassive(state, kind).effects.reduce(
    (sum, effect) =>
      sum +
      (effect.kind === "courtRemembers"
        ? effect.amount * cards.length
        : effect.kind === "poisonRetaliation" || effect.kind === "dodgeBurn"
          ? effect.amount
          : 0),
    0,
  );
  const reactive = cards.reduce(
    (sum, card) =>
      sum +
      (card.effect === "dreamDouble" ||
      card.effect === "sparkDecoy" ||
      card.effect === "waterThorns" ||
      card.effect === "teamProtection"
        ? card.value
        : 0),
    0,
  );
  return (authored + passive + reactive) * (species(kind).legendary ? 2 : 1);
}

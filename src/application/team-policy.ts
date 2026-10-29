import { abilityKeywords, creaturePassiveTier } from "../game/progression";
import { SPECIES, speciesCards, type SpeciesId } from "../game/content";
import { permanentCardCopies } from "../game/card-kit";
import type { GameState } from "../game/types";

const authoredCapabilities = new Map<SpeciesId, readonly string[]>();
function cardCapabilities(kind: SpeciesId): readonly string[] {
  const cached = authoredCapabilities.get(kind);
  if (cached) return cached;
  const result = new Set<string>();
  for (const card of speciesCards(kind)) {
    for (const keyword of abilityKeywords(card)) result.add(keyword);
    if (card.effect === "attack") {
      result.add("attack");
      if (
        (card.damageType && card.damageType !== "physical" && card.damageType !== "stun") ||
        (card.alternateDamageType &&
          card.alternateDamageType !== "physical" &&
          card.alternateDamageType !== "stun")
      )
        result.add("armorBypass");
    }
    if (
      card.effect === "dreamDouble" ||
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
      card.effect === "teamClearBlind" ||
      card.effect === "raincall" ||
      card.effect === "teamThaw" ||
      card.effect === "springbound" ||
      card.effects?.some((effect) => effect.kind === "cleanse" || effect.kind === "thaw")
    )
      result.add("cleanse");
  }
  const values = [...result];
  authoredCapabilities.set(kind, values);
  return values;
}

const authoredTiers = new WeakSet(SPECIES.flatMap((entry) => entry.passiveTiers));
const passiveCapabilities = new WeakMap<object, readonly string[]>();
function tierCapabilities(tier: ReturnType<typeof creaturePassiveTier>): readonly string[] {
  const cached = passiveCapabilities.get(tier);
  if (cached) return cached;
  const result = new Set<string>();
  for (const effect of tier.effects) {
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
      effect.kind === "petalwake" ||
      effect.kind === "wintersReprieve"
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
  const values = [...result];
  if (authoredTiers.has(tier)) passiveCapabilities.set(tier, values);
  return values;
}

export function capabilities(state: GameState, kinds: readonly SpeciesId[]) {
  const result = new Set<string>();
  for (const kind of kinds) {
    for (const value of cardCapabilities(kind)) result.add(value);
    for (const value of tierCapabilities(creaturePassiveTier(state, kind))) result.add(value);
  }
  return result;
}
export function coverageScore(state: GameState, kinds: SpeciesId[]) {
  return scoreCapabilities(capabilities(state, kinds));
}
export function scoreCapabilities(has: ReadonlySet<string>) {
  return (
    (has.has("attack") ? 3000 : 0) +
    (has.has("armorBypass") ? 1000 : 0) +
    (has.has("purge") ? 800 : 0) +
    (has.has("health") ? 200 : 0) +
    (has.has("cleanse") ? 100 : 0) +
    has.size * 20
  );
}
const authoredOffense = new Map<SpeciesId, { authored: number; reactive: number; cardCount: number }>();

const tierOffense = new WeakMap<object, Map<number, number>>();

/** Approximate damage over an authored kit rotation; no enemy intent or chance is sampled. */
export function offenseValue(state: GameState, kind: SpeciesId): number {
  let values = authoredOffense.get(kind);
  if (!values) {
    const cards = speciesCards(kind);
    let authored = 0;
    let reactive = 0;
    for (const card of cards) {
      authored += card.effect === "attack" ? card.value : 0;
      authored +=
        card.effects?.reduce((n, effect) => n + (effect.kind === "damage" ? effect.amount : 0), 0) ?? 0;
      reactive += card.effect === "dreamDouble" || card.effect === "teamProtection" ? card.value : 0;
    }
    values = { authored, reactive, cardCount: cards.length };
    authoredOffense.set(kind, values);
  }
  const { authored, reactive, cardCount } = values;
  const tier = creaturePassiveTier(state, kind);
  let byCardCount = tierOffense.get(tier);
  let passive = byCardCount?.get(cardCount);
  if (passive === undefined) {
    passive = tier.effects.reduce(
      (sum, effect) =>
        sum +
        (effect.kind === "courtRemembers"
          ? effect.amount * cardCount
          : effect.kind === "poisonRetaliation" || effect.kind === "dodgeBurn"
            ? effect.amount
            : 0),
      0,
    );
    if (authoredTiers.has(tier)) {
      if (!byCardCount) tierOffense.set(tier, (byCardCount = new Map()));
      byCardCount.set(cardCount, passive);
    }
  }
  return (authored + passive + reactive) * permanentCardCopies(kind);
}

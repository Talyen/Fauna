import { BOONS, speciesCards, type BoonId } from "./content";
import { BOON_KEYWORDS } from "./content/boon-keywords";
import type { PassiveKind } from "./content/types";
import type { KeywordId } from "./keywords";
import { creaturePassiveTier } from "./progression";
import { abilityRule } from "./rules/abilities";
import type { AbilityKind } from "./rules/ability-types";
import { roll } from "./random";
import type { GameState } from "./types";

// These associations describe the current passive's actual rules, including trigger keywords.
const passiveKeywords: Partial<Record<PassiveKind, readonly KeywordId[]>> = {
  courtRemembers: ["water"],
  lostAndFound: ["health"],
  lastWarmth: ["health"],
  wellProvisioned: ["food"],
  passingFlame: ["burn"],
  sunthaw: ["cleanse", "freeze", "health"],
  gentlePassage: ["health"],
  mountainGuide: ["block"],
  petalwake: ["dodge", "health"],
  fallenLeaves: ["block", "thorns"],
  unhurried: ["health"],
  livingChorus: ["health"],
  tidalRegeneration: ["health"],
  resonance: ["stun"],
  wrongFoot: ["light", "blind"],
  teamBurnResistance: ["burn"],
  teamFreezeResistance: ["freeze"],
  blockConversion: ["block", "health"],
  blockRetention: ["block"],
  earlyBird: ["criticalHit"],
  poisonRetaliation: ["poison"],
  dodgeBurn: ["dodge", "burn"],
  armorBreak: ["armor", "burn"],
  blockBreak: ["block", "water"],
  statusReflection: ["reflect"],
  shareProtection: ["block", "thorns"],
  shareDodge: ["dodge"],
};

// Progression groups some distinct effects under broader XP categories; offer matching uses
// the actual keyword instead (for example, Thorns is not Nature damage).
const abilityKeywordOverrides: Partial<Record<AbilityKind, readonly KeywordId[]>> = {
  springbound: ["cleanse", "freeze", "dodge"],
  resurrect: ["resurrect"],
  nightmareHarvest: ["cleanse", "mana"],
  teamClearBlind: ["cleanse", "blind"],
  teamThaw: ["cleanse", "freeze"],
  teamCleanse: ["cleanse"],
  createFood: ["food"],
  reflectAttack: ["reflect"],
  dreamDouble: ["thorns", "negate"],
  sparkDecoy: ["burn", "negate"],
  teamProtection: ["block", "thorns"],
  teamPurge: ["purge"],
  teamBlind: ["blind"],
  nullify: ["nullify"],
};

export function rosterBoonKeywords(state: GameState): Set<KeywordId> {
  const keywords = new Set<KeywordId>();
  for (const row of [state.team, state.reserves])
    for (const creature of row) {
      for (const effect of creaturePassiveTier(state, creature.species).effects) {
        for (const keyword of passiveKeywords[effect.kind] ?? []) keywords.add(keyword);
        if (effect.kind === "battleStart") keywords.add(effect.effect);
        if (effect.kind === "bounce") keywords.add(effect.effect === "heal" ? "health" : "light");
        if (effect.kind === "cardBonus") {
          if (effect.trigger === "stunAttack") keywords.add("stun");
          if (effect.trigger === "heal") keywords.add("health");
          if (effect.trigger === "guard") keywords.add("block");
        }
      }
      for (const card of speciesCards(creature.species)) {
        if (card.effect === "attack") {
          keywords.add(card.damageType);
          if (card.alternateDamageType) keywords.add(card.alternateDamageType);
          if (card.criticalWhenLastCard) keywords.add("criticalHit");
          if (card.purgeThorns) {
            keywords.add("purge");
            keywords.add("thorns");
          }
        } else {
          for (const keyword of abilityKeywordOverrides[card.effect] ?? abilityRule(card.effect).keywords)
            keywords.add(keyword);
        }
        if (card.leech) keywords.add("leech");
        for (const effect of card.effects ?? []) {
          switch (effect.kind) {
            case "status":
              keywords.add(effect.status);
              break;
            case "damage":
              keywords.add(effect.damageType);
              if (effect.leech) keywords.add("leech");
              break;
            case "heal":
              keywords.add("health");
              break;
            case "mana":
              keywords.add("mana");
              break;
            case "drawKeyword":
              keywords.add(effect.keyword);
              break;
            case "cleanse":
            case "purge":
            case "blind":
              keywords.add(effect.kind);
              break;
            case "reflect":
              keywords.add("reflect");
              if (effect.status) keywords.add(effect.status);
              break;
            case "nullifyFreeze":
              keywords.add("nullify");
              keywords.add("freeze");
              break;
            case "meltArmor":
              keywords.add("armor");
              break;
          }
        }
      }
    }
  return keywords;
}

/** Sample distinct unowned Boons; a matching Boon has twice the weight of an unmatched one. */
export function offerBoons(state: GameState): BoonId[] {
  const owned = new Set(state.boons);
  const keywords = rosterBoonKeywords(state);
  const pool: { id: BoonId; weight: number }[] = [];
  let total = 0;
  for (const boon of BOONS) {
    if (owned.has(boon.id)) continue;
    const weight = BOON_KEYWORDS[boon.id]?.some((keyword) => keywords.has(keyword)) ? 2 : 1;
    pool.push({ id: boon.id, weight });
    total += weight;
  }
  const offered: BoonId[] = [];
  while (pool.length && offered.length < 3) {
    let choice = roll(state) * total;
    let index = 0;
    while (index < pool.length - 1 && choice >= pool[index]!.weight) choice -= pool[index++]!.weight;
    const chosen = pool.splice(index, 1)[0]!;
    offered.push(chosen.id);
    total -= chosen.weight;
  }
  return offered;
}

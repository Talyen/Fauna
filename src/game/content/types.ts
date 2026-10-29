import type { AbilityDefinition, AbilityKind, SupplementalEffect } from "../rules/ability-types";
export type { DamageType } from "../keywords";
export type SpeciesId =
  | "mossguard"
  | "emberback"
  | "pollenmoth"
  | "prismram"
  | "captoad"
  | "dunefox"
  | "reedstag"
  | "cindernewt"
  | "coralcurl"
  | "chimecricket"
  | "dawncall"
  | "bloomquail"
  | "shadebrim"
  | "ringpalm"
  | "glintstride"
  | "wickwaltz"
  | "rookhaven"
  | "cadenza"
  | "stillara"
  | "sternshell"
  | "neradora"
  | "memento"
  | "chronora"
  | "euphera"
  | "tournelle"
  | "reverie"
  | "oathara"
  | "almanelle"
  | "orifable"
  | "arabesca"
  | "skybex"
  | "dulcera"
  | "parhelion"
  | "pyrella"
  | "aerostat"
  | "alpenglen"
  | "wisterelle"
  | "brumalyn"
  | "cavalleaf"
  | "wendlet"
  | "vitrilo"
  | "velvetmonarch"
  | "velouria"
  | "tinkervale";
export type Effect = AbilityKind;
type PassiveEffect =
  | { kind: "spareParts"; amount: number }
  | { kind: "rimewake"; amount: number }
  | { kind: "gardenAnswers"; amount: number }
  | { kind: "glassCutter"; amount: number }
  | { kind: "lostAndFound"; amount: number }
  | { kind: "lastWarmth"; amount: number }
  | { kind: "wellProvisioned"; amount: number }
  | { kind: "passingFlame"; amount: number }
  | { kind: "sunthaw"; amount: number }
  | { kind: "wintersReprieve"; amount: number }
  | { kind: "wildPath"; amount: number }
  | { kind: "gentlePassage"; amount: number }
  | { kind: "mountainGuide"; amount: number }
  | { kind: "petalwake"; amount: number }
  | { kind: "expressDelivery"; amount: number }
  | { kind: "fallenLeaves"; amount: number }
  | { kind: "livingShadow"; amount: number }
  | { kind: "unfinishedJourney"; amount: number }
  | { kind: "unhurried"; amount: number }
  | { kind: "gallantry"; amount: number }
  | { kind: "goodFortune"; amount: number }
  | { kind: "courtRemembers"; amount: number }
  | { kind: "turnBackTide"; amount: number }
  | { kind: "wellRead"; amount: number }
  | { kind: "livingChorus"; amount: number }
  | { kind: "tidalRegeneration"; amount: number }
  | { kind: "kindlingFlourish"; amount: number }
  | { kind: "resonance"; amount: number }
  | { kind: "wrongFoot"; amount: number }
  | { kind: "teamBurnResistance"; amount: number }
  | { kind: "teamFreezeResistance"; amount: number }
  | { kind: "blockConversion"; amount: number }
  | { kind: "blockRetention"; amount: number }
  | { kind: "cardBonus"; trigger: "firstAttack" | "stunAttack" | "heal" | "guard"; amount: number }
  | { kind: "battleStart"; effect: "block" | "thorns" | "armor"; amount: number }
  | { kind: "poisonRetaliation"; amount: number }
  | { kind: "dodgeBurn"; amount: number }
  | { kind: "encore"; amount: number }
  | { kind: "earlyBird"; amount: number }
  | { kind: "armorBreak"; amount: number }
  | { kind: "blockBreak"; amount: number }
  | { kind: "statusReflection"; amount: number }
  | { kind: "shareProtection"; amount: number }
  | { kind: "shareDodge"; amount: number }
  | { kind: "bounce"; effect: "light" | "heal"; amount: number; chance?: number };
export type PassiveKind = PassiveEffect["kind"];

export interface PassiveTier {
  description: string;
  effects: readonly PassiveEffect[];
}
export interface Species {
  id: SpeciesId;
  name: string;
  title: string;
  health: number;
  legendary?: true;
  color: string;
  trait: string;
  passiveTiers: readonly [PassiveTier, PassiveTier, PassiveTier, PassiveTier, PassiveTier, PassiveTier];
}
export interface CardBase {
  id: string;
  species: SpeciesId | null;
  name: string;
  value: number;
  cost: 1;
  artwork?: string;
  leech?: boolean;
  consume?: boolean;
  repeatChance?: number;
  effects?: readonly SupplementalEffect[];
}
export type CardDefinition = CardBase & AbilityDefinition;

export interface CreatureKit {
  species: Species;
  cards: readonly [CardDefinition, CardDefinition, CardDefinition];
}

import type { DamageType, EFFECT_KEYWORDS } from "../keywords";
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
  | "euphera"
  | "tournelle"
  | "reverie";
export type Effect = keyof typeof EFFECT_KEYWORDS;
type PassiveEffect =
  | { kind: "unhurried"; amount: number }
  | { kind: "gallantry"; amount: number }
  | { kind: "goodFortune"; amount: number }
  | { kind: "courtRemembers"; amount: number }
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
type CardEffect =
  | { kind: "drawKeyword"; keyword: "light" | "nature" | "water"; amount: number }
  | { kind: "nullifyFreeze"; amount: number }
  | { kind: "damage"; damageType: DamageType; amount: number; leech?: boolean }
  | { kind: "status"; status: "armor" | "thorns" | "dodge"; amount: number }
  | { kind: "cleanse"; amount: number; target?: "recipient" | "allAllies" }
  | { kind: "reflect"; amount: number; status?: "burn" }
  | { kind: "draw" | "mana" | "purge" | "heal" | "blind" | "meltArmor"; amount: number };
export interface CardBase {
  id: string;
  species: SpeciesId;
  name: string;
  value: number;
  cost: 1;
  artwork?: string;
  leech?: boolean;
  consume?: boolean;
  repeatChance?: number;
  effects?: readonly CardEffect[];
}
export type CardDefinition = CardBase &
  (
    | {
        effect: "attack";
        damageType: DamageType;
        alternateDamageType?: DamageType;
        doubleWithArmor?: boolean;
        doubleAgainstHealthier?: true;
        purgeThorns?: true;
        target?: "allEnemies" | "randomEnemy";
      }
    | { effect: "guard"; target?: "self" }
    | { effect: "heal"; target?: "allAllies" | "mostInjured" | "self" }
    | { effect: Exclude<Effect, "attack" | "guard" | "heal">; target?: never }
  );

export interface CreatureKit {
  species: Species;
  cards: readonly [CardDefinition, CardDefinition, CardDefinition];
}

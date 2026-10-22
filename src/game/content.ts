import { abilityExtras, primaryAbilityValue, scalePower } from "./ability-values";
import { DAMAGE_TYPES, keywordLabel, type DamageType, EFFECT_KEYWORDS } from "./keywords";
export { type DamageType } from "./keywords";
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
  | "cadenza"
  | "stillara"
  | "sternshell"
  | "neradora";
type Effect = keyof typeof EFFECT_KEYWORDS;
type PassiveEffect =
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
  color: string;
  trait: string;
  passiveTiers: readonly [PassiveTier, PassiveTier, PassiveTier, PassiveTier, PassiveTier, PassiveTier];
}
export const DAMAGE_LABELS = Object.fromEntries(DAMAGE_TYPES.map((id) => [id, keywordLabel(id)])) as Record<
  DamageType,
  string
>;
type CardEffect =
  | { kind: "nullifyFreeze"; amount: number }
  | { kind: "damage"; damageType: DamageType; amount: number; leech?: boolean }
  | { kind: "status"; status: "armor" | "thorns" | "dodge"; amount: number }
  | { kind: "cleanse"; amount: number; target?: "recipient" | "allAllies" }
  | { kind: "reflect"; amount: number; status?: "burn" }
  | { kind: "draw" | "mana" | "purge" | "heal" | "blind" | "meltArmor"; amount: number };
interface CardBase {
  id: string;
  species: SpeciesId;
  name: string;
  value: number;
  cost: 1;
  artwork?: string;
  leech?: boolean;
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
        target?: "allEnemies" | "randomEnemy";
      }
    | { effect: "guard"; target?: "self" }
    | { effect: "heal"; target?: "allAllies" | "mostInjured" | "self" }
    | { effect: Exclude<Effect, "attack" | "guard" | "heal">; target?: never }
  );
export const SPECIES: readonly Species[] = [
  {
    id: "cadenza",
    name: "Cadenza",
    title: "The song of forgotten places",
    health: 28,
    color: "#d4a855",
    trait: "Living Chorus",
    passiveTiers: [
      {
        description: "After your second card each turn, restore 1 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 1 }],
      },
      {
        description: "After your second card each turn, restore 2 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 2 }],
      },
      {
        description: "After your second card each turn, restore 3 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 3 }],
      },
      {
        description: "After your second card each turn, restore 4 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 4 }],
      },
      {
        description: "After your second card each turn, restore 5 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 5 }],
      },
      {
        description: "After your second card each turn, restore 6 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 6 }],
      },
    ],
  },
  {
    id: "stillara",
    name: "Stillara",
    title: "The keeper of summer",
    health: 26,
    color: "#94aabd",
    trait: "First Thaw",
    passiveTiers: [
      {
        description: "Allies take 10% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 10 }],
      },
      {
        description: "Allies take 20% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 20 }],
      },
      {
        description: "Allies take 30% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 30 }],
      },
      {
        description: "Allies take 40% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 40 }],
      },
      {
        description: "Allies take 50% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 50 }],
      },
      {
        description: "Allies take 60% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 60 }],
      },
    ],
  },
  {
    id: "neradora",
    name: "Neradora",
    title: "The living tide flower",
    health: 28,
    color: "#ed795c",
    trait: "Tidal Regeneration",
    passiveTiers: [
      {
        description: "Restore 1 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 1 }],
      },
      {
        description: "Restore 2 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 2 }],
      },
      {
        description: "Restore 3 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 3 }],
      },
      {
        description: "Restore 4 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 4 }],
      },
      {
        description: "Restore 5 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 5 }],
      },
      {
        description: "Restore 6 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 6 }],
      },
    ],
  },
  {
    id: "sternshell",
    name: "Sternshell",
    title: "The steadfast voyager",
    health: 32,
    color: "#cb7c45",
    trait: "Shelter",
    passiveTiers: [
      {
        description: "Sternshell starts combat with 2 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 2 }],
      },
      {
        description: "Sternshell starts combat with 3 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 3 }],
      },
      {
        description: "Sternshell starts combat with 4 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 4 }],
      },
      {
        description: "Sternshell starts combat with 5 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 5 }],
      },
      {
        description: "Sternshell starts combat with 6 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 6 }],
      },
      {
        description: "Sternshell starts combat with 7 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 7 }],
      },
    ],
  },
  {
    id: "wickwaltz",
    name: "Wickwaltz",
    title: "The kindling dancer",
    health: 28,
    color: "#c96d39",
    trait: "Kindling Flourish",
    passiveTiers: [
      {
        description: "Wickwaltz’s second card each turn has a 20% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 20 }],
      },
      {
        description: "Wickwaltz’s second card each turn has a 36% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 36 }],
      },
      {
        description: "Wickwaltz’s second card each turn has a 52% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 52 }],
      },
      {
        description: "Wickwaltz’s second card each turn has a 68% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 68 }],
      },
      {
        description: "Wickwaltz’s second card each turn has an 84% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 84 }],
      },
      {
        description: "Wickwaltz’s second card each turn repeats",
        effects: [{ kind: "kindlingFlourish", amount: 100 }],
      },
    ],
  },
  {
    id: "mossguard",
    name: "Mossguard",
    title: "The gentle guardian",
    health: 32,
    color: "#9ead70",
    trait: "Overgrowth",
    passiveTiers: [
      {
        description: "Retain 10% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 10 }],
      },
      {
        description: "Retain 20% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 20 }],
      },
      {
        description: "Retain 30% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 30 }],
      },
      {
        description: "Retain 40% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 40 }],
      },
      {
        description: "Retain 50% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 50 }],
      },
      {
        description: "Retain 60% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 60 }],
      },
    ],
  },
  {
    id: "emberback",
    name: "Emberback",
    title: "The banked furnace",
    health: 30,
    color: "#ed9c65",
    trait: "Molten Shell",
    passiveTiers: [
      {
        description: "When your Armor breaks, deal 1 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 1 }],
      },
      {
        description: "When your Armor breaks, deal 2 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 2 }],
      },
      {
        description: "When your Armor breaks, deal 3 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 3 }],
      },
      {
        description: "When your Armor breaks, deal 4 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 4 }],
      },
      {
        description: "When your Armor breaks, deal 5 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 5 }],
      },
      {
        description: "When your Armor breaks, deal 6 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 6 }],
      },
    ],
  },
  {
    id: "pollenmoth",
    name: "Pollenmoth",
    title: "A golden wake of flowers",
    health: 23,
    color: "#dbaf52",
    trait: "Cross-Pollination",
    passiveTiers: [
      {
        description: "Light damage bounces once",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
          },
        ],
      },
      {
        description: "Light damage bounces once, with a 50% chance to bounce twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
          },
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description: "Light damage bounces twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
        ],
      },
      {
        description: "Light damage bounces twice; Health restoration has a 50% chance to bounce once",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description:
          "Light damage bounces twice; Health restoration bounces once, with a 50% chance to bounce twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description: "Light damage and Health restoration bounce twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 2,
          },
        ],
      },
    ],
  },
  {
    id: "prismram",
    name: "Prismram",
    title: "The crystal sentinel",
    health: 30,
    color: "#b7b2e2",
    trait: "Refraction",
    passiveTiers: [
      {
        description:
          "Harmful status effects you receive have a 10% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 10 }],
      },
      {
        description:
          "Harmful status effects you receive have a 20% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 20 }],
      },
      {
        description:
          "Harmful status effects you receive have a 30% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 30 }],
      },
      {
        description:
          "Harmful status effects you receive have a 40% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 40 }],
      },
      {
        description:
          "Harmful status effects you receive have a 50% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 50 }],
      },
      {
        description:
          "Harmful status effects you receive have a 60% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 60 }],
      },
    ],
  },
  {
    id: "captoad",
    name: "Captoad",
    title: "Beneath the spotted cap",
    health: 30,
    color: "#cb8051",
    trait: "Sporecoat",
    passiveTiers: [
      {
        description: "Retaliate with 1 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 1 }],
      },
      {
        description: "Retaliate with 2 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 2 }],
      },
      {
        description: "Retaliate with 3 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 3 }],
      },
      {
        description: "Retaliate with 4 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 4 }],
      },
      {
        description: "Retaliate with 5 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 5 }],
      },
      {
        description: "Retaliate with 6 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 6 }],
      },
    ],
  },
  {
    id: "dunefox",
    name: "Dunefox",
    title: "The shifting mirage",
    health: 24,
    color: "#d9aa57",
    trait: "Shifting Sands",
    passiveTiers: [
      { description: "Allies gain 15% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 15 }] },
      { description: "Allies gain 20% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 20 }] },
      { description: "Allies gain 25% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 25 }] },
      { description: "Allies gain 30% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 30 }] },
      { description: "Allies gain 35% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 35 }] },
      { description: "Allies gain 40% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 40 }] },
    ],
  },
  {
    id: "reedstag",
    name: "Reedstag",
    title: "The living reedbed",
    health: 30,
    color: "#c2a052",
    trait: "Reedguard",
    passiveTiers: [
      {
        description: "Block and Thorns have a 20% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 20 }],
      },
      {
        description: "Block and Thorns have a 40% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 40 }],
      },
      {
        description: "Block and Thorns have a 60% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 60 }],
      },
      {
        description: "Block and Thorns have a 80% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 80 }],
      },
      {
        description: "Block and Thorns have a 90% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 90 }],
      },
      {
        description: "Block and Thorns are shared with allies",
        effects: [{ kind: "shareProtection", amount: 100 }],
      },
    ],
  },
  {
    id: "cindernewt",
    name: "Cindernewt",
    title: "The dancing ember",
    health: 24,
    color: "#ed9c65",
    trait: "Cinderstep",
    passiveTiers: [
      {
        description: "When you Dodge, deal 1 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 1 }],
      },
      {
        description: "When you Dodge, deal 2 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 2 }],
      },
      {
        description: "When you Dodge, deal 3 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 3 }],
      },
      {
        description: "When you Dodge, deal 4 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 4 }],
      },
      {
        description: "When you Dodge, deal 5 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 5 }],
      },
      {
        description: "When you Dodge, deal 6 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 6 }],
      },
    ],
  },
  {
    id: "coralcurl",
    name: "Coralcurl",
    title: "The sheltered reef",
    health: 28,
    color: "#f89983",
    trait: "Bubbleburst",
    passiveTiers: [
      {
        description: "Deal 1 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 1 }],
      },
      {
        description: "Deal 2 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 2 }],
      },
      {
        description: "Deal 3 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 3 }],
      },
      {
        description: "Deal 4 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 4 }],
      },
      {
        description: "Deal 5 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 5 }],
      },
      {
        description: "Deal 6 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 6 }],
      },
    ],
  },
  {
    id: "chimecricket",
    name: "Chimecricket",
    title: "The evening chorus",
    health: 24,
    color: "#c2b66c",
    trait: "Encore",
    passiveTiers: [
      {
        description: "Your first ability each turn has a 10% chance to repeat",
        effects: [{ kind: "encore", amount: 10 }],
      },
      {
        description: "Your first ability each turn has a 20% chance to repeat",
        effects: [{ kind: "encore", amount: 20 }],
      },
      {
        description: "Your first ability each turn has a 30% chance to repeat",
        effects: [{ kind: "encore", amount: 30 }],
      },
      {
        description: "Your first ability each turn has a 40% chance to repeat",
        effects: [{ kind: "encore", amount: 40 }],
      },
      {
        description: "Your first ability each turn has a 50% chance to repeat",
        effects: [{ kind: "encore", amount: 50 }],
      },
      {
        description: "Your first ability each turn has a 60% chance to repeat",
        effects: [{ kind: "encore", amount: 60 }],
      },
    ],
  },
  {
    id: "dawncall",
    name: "Dawncall",
    title: "The sunrise herald",
    health: 24,
    color: "#eab75b",
    trait: "Early Bird",
    passiveTiers: [
      {
        description: "Your first attack each turn gains 20% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 20 }],
      },
      {
        description: "Your first attack each turn gains 35% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 35 }],
      },
      {
        description: "Your first attack each turn gains 50% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 50 }],
      },
      {
        description: "Your first attack each turn gains 65% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 65 }],
      },
      {
        description: "Your first attack each turn gains 80% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 80 }],
      },
      {
        description: "Your first attack each turn is a Critical Hit",
        effects: [{ kind: "earlyBird", amount: 100 }],
      },
    ],
  },
  {
    id: "bloomquail",
    name: "Bloomquail",
    title: "The petal keeper",
    health: 26,
    color: "#ed9c9b",
    trait: "Full Bloom",
    passiveTiers: [
      {
        description: "Convert 50% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 50 }],
      },
      {
        description: "Convert 60% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 60 }],
      },
      {
        description: "Convert 70% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 70 }],
      },
      {
        description: "Convert 80% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 80 }],
      },
      {
        description: "Convert 90% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 90 }],
      },
      {
        description: "Convert your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 100 }],
      },
    ],
  },
  {
    id: "ringpalm",
    name: "Ringpalm",
    title: "The stone-circle guardian",
    health: 30,
    color: "#9ead70",
    trait: "Resonance",
    passiveTiers: [
      {
        description: "Ringpalm’s Stun damage has a 10% chance to repeat",
        effects: [{ kind: "resonance", amount: 10 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 20% chance to repeat",
        effects: [{ kind: "resonance", amount: 20 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 30% chance to repeat",
        effects: [{ kind: "resonance", amount: 30 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 40% chance to repeat",
        effects: [{ kind: "resonance", amount: 40 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 50% chance to repeat",
        effects: [{ kind: "resonance", amount: 50 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 60% chance to repeat",
        effects: [{ kind: "resonance", amount: 60 }],
      },
    ],
  },
  {
    id: "shadebrim",
    name: "Shadebrim",
    title: "The cool refuge",
    health: 28,
    color: "#dbaf52",
    trait: "Cool Refuge",
    passiveTiers: [
      {
        description: "Allies take 10% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 10 }],
      },
      {
        description: "Allies take 20% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 20 }],
      },
      {
        description: "Allies take 30% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 30 }],
      },
      {
        description: "Allies take 40% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 40 }],
      },
      {
        description: "Allies take 50% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 50 }],
      },
      {
        description: "Allies take 60% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 60 }],
      },
    ],
  },
  {
    id: "glintstride",
    name: "Glintstride",
    title: "A step beyond the shimmer",
    health: 24,
    color: "#83c9ce",
    trait: "Wrong Foot",
    passiveTiers: [
      {
        description: "Glintstride’s attacks deal 1 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 1 }],
      },
      {
        description: "Glintstride’s attacks deal 2 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 2 }],
      },
      {
        description: "Glintstride’s attacks deal 3 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 3 }],
      },
      {
        description: "Glintstride’s attacks deal 4 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 4 }],
      },
      {
        description: "Glintstride’s attacks deal 5 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 5 }],
      },
      {
        description: "Glintstride’s attacks deal 6 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 6 }],
      },
    ],
  },
];
const card = <T extends Exclude<Effect, "attack">>(
  species: SpeciesId,
  name: string,
  effect: T,
  value: number,
): CardBase & { effect: T } => ({
  id: `${species}-${effect}`,
  species,
  name,
  effect,
  value,
  cost: 1,
});
const attack = (
  species: SpeciesId,
  name: string,
  value: number,
  damageType: DamageType,
): Extract<CardDefinition, { effect: "attack" }> => ({
  id: `${species}-attack`,
  species,
  name,
  effect: "attack",
  value,
  cost: 1,
  damageType,
});
export const CARDS: readonly CardDefinition[] = [
  {
    ...card("cadenza", "Resonant Well", "draw", 2),
    id: "cadenza-resonant-well",
    effects: [{ kind: "mana", amount: 1 }],
    artwork: "action.cadenza.resonant-well",
  },
  {
    ...card("cadenza", "Echoes Remember", "recover", 1),
    id: "cadenza-echoes-remember",
    artwork: "action.cadenza.echoes-remember",
  },
  {
    ...card("cadenza", "Rousing Refrain", "teamDodge", 20),
    id: "cadenza-rousing-refrain",
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.cadenza.rousing-refrain",
  },
  {
    ...card("stillara", "Reed Reservoir", "mana", 2),
    id: "stillara-reed-reservoir",
    artwork: "action.stillara.reed-reservoir",
  },
  {
    ...card("stillara", "Thaw Path", "teamThaw", 1),
    id: "stillara-thaw-path",
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.stillara.thaw-path",
  },
  {
    ...card("stillara", "Water Remembers", "heal", 1),
    id: "stillara-water-remembers",
    target: "allAllies",
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.stillara.water-remembers",
  },
  {
    ...card("neradora", "Undertow Knot", "waterThorns", 3),
    id: "neradora-undertow-knot",
    artwork: "action.neradora.undertow-knot",
  },
  {
    ...card("neradora", "Bloom Shelter", "heal", 2),
    id: "neradora-bloom-shelter",
    target: "allAllies",
    artwork: "action.neradora.bloom-shelter",
  },
  {
    ...card("neradora", "Tide Cup", "draw", 2),
    id: "neradora-tide-cup",
    effects: [{ kind: "mana", amount: 1 }],
    artwork: "action.neradora.tide-cup",
  },
  {
    ...attack("sternshell", "Surge Ram", 3, "physical"),
    doubleWithArmor: true,
    artwork: "action.sternshell.surge-ram",
  },
  {
    ...card("sternshell", "Siphon Vault", "swap", 1),
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.sternshell.siphon-vault",
  },
  {
    ...attack("sternshell", "Spiral Return", 1, "water"),
    id: "sternshell-spiral-return",
    target: "allEnemies",
    effects: [{ kind: "mana", amount: 1 }],
    artwork: "action.sternshell.spiral-return",
  },
  {
    ...attack("wickwaltz", "Ember Pirouette", 2, "burn"),
    target: "allEnemies",
    artwork: "action.wickwaltz.ember-pirouette",
  },
  {
    ...card("wickwaltz", "Saffron Screen", "guard", 3),
    target: "self",
    effects: [{ kind: "nullifyFreeze", amount: 1 }],
    artwork: "action.wickwaltz.saffron-screen",
  },
  {
    ...card("wickwaltz", "Thermal Rise", "draw", 2),
    effects: [{ kind: "mana", amount: 1 }],
    artwork: "action.wickwaltz.thermal-rise",
  },
  {
    ...attack("glintstride", "Prism Shear", 6, "light"),
    artwork: "action.glintstride.prism-shear",
  },
  {
    ...card("glintstride", "Mirage Run", "dodge", 30),
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.glintstride.mirage-run",
  },
  {
    ...card("glintstride", "False Horizon", "teamBlind", 1),
    artwork: "action.glintstride.false-horizon",
  },
  {
    ...attack("ringpalm", "Ringclap", 6, "stun"),
    artwork: "action.ringpalm.ringclap",
  },
  {
    ...attack("ringpalm", "Harmonic Set", 1, "stun"),
    id: "ringpalm-harmonic-set",
    target: "allEnemies",
    effects: [{ kind: "status", status: "armor", amount: 1 }],
    repeatChance: 20,
    artwork: "action.ringpalm.harmonic-set",
  },
  {
    ...card("ringpalm", "Seedling Circle", "teamProtection", 2),
    artwork: "action.ringpalm.seedling-circle",
  },
  {
    ...card("dawncall", "Dawn Cry", "teamCleanse", 1),
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.dawncall.dawn-cry",
  },
  {
    ...attack("dawncall", "Sunwing Sweep", 2, "light"),
    target: "allEnemies",
    artwork: "action.dawncall.sunwing-sweep",
  },
  {
    ...card("dawncall", "Morning Bloom", "heal", 2),
    target: "allAllies",
    artwork: "action.dawncall.morning-bloom",
  },
  {
    ...card("coralcurl", "Bubble Ward", "guard", 6),
    target: "self",
    artwork: "action.coralcurl.bubble-ward",
  },
  { ...attack("coralcurl", "Reef Jet", 6, "water"), artwork: "action.coralcurl.reef-jet" },
  {
    ...card("coralcurl", "Coral Spiral", "swap", 1),
    effects: [{ kind: "blind", amount: 1 }],
    artwork: "action.coralcurl.coral-spiral",
  },
  {
    ...attack("cindernewt", "Cinder Lash", 6, "physical"),
    alternateDamageType: "burn",
    artwork: "action.cindernewt.cinder-lash",
  },
  {
    ...attack("cindernewt", "Ember Breath", 1, "burn"),
    id: "cindernewt-ember-breath",
    target: "allEnemies",
    effects: [{ kind: "meltArmor", amount: 50 }],
    artwork: "action.cindernewt.ember-breath",
  },
  {
    ...attack("cindernewt", "Ashen Veil", 1, "burn"),
    id: "cindernewt-ashen-veil",
    target: "allEnemies",
    effects: [{ kind: "blind", amount: 1 }],
    artwork: "action.cindernewt.ashen-veil",
  },
  {
    ...attack("reedstag", "Reed Rush", 6, "nature"),
    artwork: "action.reedstag.reed-rush",
  },
  {
    ...card("reedstag", "Reed Shelter", "guard", 3),
    target: "self",
    effects: [{ kind: "status", status: "thorns", amount: 3 }],
    artwork: "action.reedstag.reed-shelter",
  },
  {
    ...card("reedstag", "Mending Spring", "heal", 4),
    target: "mostInjured",
    effects: [{ kind: "cleanse", amount: 7, target: "recipient" }],
    artwork: "action.reedstag.mending-spring",
  },
  {
    ...attack("dunefox", "Sandburst Pounce", 6, "physical"),
    artwork: "action.dunefox.sandburst-pounce",
  },
  {
    ...attack("dunefox", "Dune Whirl", 1, "physical"),
    id: "dunefox-dune-whirl",
    target: "allEnemies",
    effects: [{ kind: "blind", amount: 1 }],
    artwork: "action.dunefox.dune-whirl",
  },
  {
    ...card("dunefox", "Mirage Step", "dodge", 30),
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.dunefox.mirage-step",
  },
  {
    ...card("mossguard", "Boulder Brace", "guard", 6),
    target: "self",
    artwork: "action.mossguard.boulder-brace",
  },
  {
    ...attack("mossguard", "Rooted Stomp", 2, "stun"),
    target: "allEnemies",
    artwork: "action.mossguard.rooted-stomp",
  },
  {
    ...card("mossguard", "Moss Renewal", "heal", 2),
    target: "allAllies",
    artwork: "action.mossguard.moss-renewal",
  },
  {
    ...attack("emberback", "Ember Charge", 4, "physical"),
    artwork: "action.emberback.ember-charge",
    effects: [{ kind: "status", status: "armor", amount: 2 }],
  },
  {
    ...attack("emberback", "Furnace Breath", 2, "burn"),
    id: "emberback-furnace-breath",
    artwork: "action.emberback.furnace-breath",
    target: "allEnemies",
  },
  {
    ...attack("emberback", "Magma Stomp", 2, "stun"),
    id: "emberback-magma-stomp",
    artwork: "action.emberback.magma-stomp",
    target: "allEnemies",
  },
  {
    ...attack("pollenmoth", "Dazzle Burst", 3, "light"),
    artwork: "action.pollenmoth.dazzle-burst",
    target: "randomEnemy",
  },
  {
    ...card("pollenmoth", "Petal Shelter", "teamGuard", 2),
    artwork: "action.pollenmoth.petal-shelter",
  },
  {
    ...card("pollenmoth", "Bloomwake", "heal", 3),
    effect: "heal",
    artwork: "action.pollenmoth.bloomwake",
    target: "mostInjured",
  },
  {
    ...attack("prismram", "Prism Charge", 6, "physical"),
    artwork: "action.prismram.prism-charge",
  },
  {
    ...card("prismram", "Faceted Ward", "guard", 3),
    target: "self",
    artwork: "action.prismram.faceted-ward",
    effects: [{ kind: "reflect", amount: 1 }],
  },
  {
    ...attack("prismram", "Spectrum Lance", 4, "light"),
    id: "prismram-spectrum-lance",
    artwork: "action.prismram.spectrum-lance",
    effects: [{ kind: "purge", amount: 1 }],
  },
  {
    ...attack("captoad", "Spore Puff", 2, "poison"),
    target: "allEnemies",
    artwork: "action.captoad.spore-puff",
  },
  {
    ...card("captoad", "Mushroom Guard", "guard", 3),
    target: "self",
    effects: [{ kind: "heal", amount: 3 }],
    artwork: "action.captoad.mushroom-guard",
  },
  {
    ...card("captoad", "Bogbound Leap", "swap", 1),
    effects: [{ kind: "draw", amount: 2 }],
    artwork: "action.captoad.bogbound-leap",
  },
  {
    ...attack("chimecricket", "Resonant Leap", 4, "stun"),
    effects: [{ kind: "draw", amount: 1 }],
    artwork: "action.chimecricket.resonant-leap",
  },
  {
    ...card("chimecricket", "Hush Dome", "nullify", 1),
    artwork: "action.chimecricket.hush-dome",
  },
  {
    ...card("chimecricket", "Lullaby Drift", "heal", 4),
    target: "mostInjured",
    effects: [{ kind: "cleanse", amount: 6, target: "recipient" }],
    artwork: "action.chimecricket.lullaby-drift",
  },
  {
    ...card("bloomquail", "Petal Rampart", "guard", 6),
    target: "self",
    artwork: "action.bloomquail.petal-rampart",
  },
  {
    ...card("bloomquail", "Bloom Cradle", "draw", 2),
    effects: [{ kind: "heal", amount: 2 }],
    artwork: "action.bloomquail.bloom-cradle",
  },
  {
    ...card("bloomquail", "Petal Veil", "heal", 2),
    target: "allAllies",
    effects: [{ kind: "blind", amount: 1 }],
    artwork: "action.bloomquail.petal-veil",
  },
  {
    ...card("shadebrim", "Noonward", "guard", 4),
    target: "self",
    effects: [{ kind: "reflect", amount: 1, status: "burn" }],
    artwork: "action.shadebrim.noonward",
  },
  {
    ...attack("shadebrim", "Coolfront", 1, "freeze"),
    target: "allEnemies",
    effects: [{ kind: "cleanse", amount: 7, target: "allAllies" }],
    artwork: "action.shadebrim.coolfront",
  },
  {
    ...card("shadebrim", "Noon Bloom", "draw", 2),
    effects: [{ kind: "mana", amount: 1 }],
    artwork: "action.shadebrim.noon-bloom",
  },
];
export function enemyCard(card: CardDefinition): CardDefinition {
  // Enemies have no hand; retain the self-healing half of a draw ability
  if (card.effect === "draw") {
    const healing = card.effects?.find((effect) => effect.kind === "heal");
    if (healing) return { ...card, effect: "heal", target: "self", value: healing.amount, effects: [] };
  }
  return {
    ...card,
    effects: card.effects?.filter((effect) => {
      const kind = effect.kind;
      switch (kind) {
        case "damage":
        case "status":
        case "cleanse":
        case "purge":
        case "reflect":
        case "heal":
        case "blind":
        case "meltArmor":
        case "nullifyFreeze":
          return true;
        case "draw":
        case "mana":
          return false;
        default: {
          const unhandled: never = kind;
          throw new Error(`Unhandled enemy extra: ${unhandled}`);
        }
      }
    }),
  };
}
/** Enemies have no shared hand, Mana pool or discard pile. Decide support for every primary kind. */
export function enemyCanUse(card: CardDefinition): boolean {
  const effect = enemyCard(card).effect;
  switch (effect) {
    case "draw":
    case "mana":
    case "recover":
      return false;
    case "attack":
    case "guard":
    case "heal":
    case "waterThorns":
    case "teamDodge":
    case "dodge":
    case "teamBlind":
    case "teamThaw":
    case "teamCleanse":
    case "nullify":
    case "swap":
    case "teamGuard":
    case "teamProtection":
      return true;
    default: {
      const unhandled: never = effect;
      throw new Error(`Unhandled enemy ability: ${unhandled}`);
    }
  }
}
export const FIRST_RUN_STARTERS: readonly SpeciesId[] = SPECIES.filter((entry) =>
  CARDS.some((card) => card.species === entry.id && card.effect === "attack"),
).map((entry) => entry.id);
export function species(id: SpeciesId): Species {
  const result = SPECIES.find((s) => s.id === id);
  if (!result) throw new Error(`Unknown species: ${id}`);
  return result;
}
export function definition(id: string): CardDefinition {
  const result = CARDS.find((c) => c.id === id);
  if (!result) throw new Error(`Unknown card: ${id}`);
  return result;
}
export function cardText(
  card: CardDefinition,
  level = 0,
  value: number | undefined = undefined,
  power = 1,
): string {
  value ??= primaryAbilityValue(card, card.value + level * 2, power);
  let text: string;
  switch (card.effect) {
    case "attack":
      // Keep the conditional rule at its base value so resolved previews do not imply a second doubling
      if (card.doubleWithArmor) value = primaryAbilityValue(card, card.value + level * 2, power);
      text = `Deal ${value} ${DAMAGE_LABELS[card.damageType]}${card.alternateDamageType ? ` or ${DAMAGE_LABELS[card.alternateDamageType]}` : ""} damage${card.alternateDamageType ? " at random" : ""}${card.target === "allEnemies" ? " to all enemies" : card.target === "randomEnemy" ? " to a random enemy" : ""}`;
      if (card.doubleWithArmor) text += "; Doubled if you have Armor";
      break;
    case "guard":
      text = card.target === "self" ? `Gain ${value} Block` : `Give an ally ${value} Block`;
      break;
    case "heal":
      text =
        card.target === "self"
          ? `Restore ${value} Health`
          : `Restore ${value} Health to ${card.target === "allAllies" ? "all allies" : card.target === "mostInjured" ? "the most injured ally" : "a living ally"}`;
      break;
    case "waterThorns":
      text = `Gain ${value} Water Thorns`;
      break;
    case "recover":
      text = "Return a random discarded card to your hand";
      break;
    case "teamDodge":
      text = `Give all allies ${value}% Dodge until your next turn`;
      break;
    case "dodge":
      text = `Gain ${value}% Dodge until your next turn`;
      break;
    case "teamBlind":
      text = "Blind all enemies";
      break;
    case "mana":
      text = `Gain ${value} Mana`;
      break;
    case "teamThaw":
      text = "Cleanse all Freeze build-up from allies";
      break;
    case "teamCleanse":
      text = `Cleanse ${value} harmful effect${value === 1 ? "" : "s"} from all allies`;
      break;
    case "nullify":
      text = "Nullify the next harmful status effect on each ally";
      break;
    case "swap":
      text = "Swap out for a random backup";
      break;
    case "draw":
      text = `Draw ${value} card${value === 1 ? "" : "s"}`;
      break;
    case "teamGuard":
      text = `Allies gain ${value} Block`;
      break;
    case "teamProtection":
      text =
        power === 1
          ? `Grant all allies ${value} Block or Thorns`
          : `Grant all allies ${scalePower(value, power)} Block or ${value} Thorns`;
      break;
  }
  for (const effect of abilityExtras(card, power)) {
    text +=
      "; " +
      (effect.kind === "nullifyFreeze"
        ? "Nullify the next Freeze damage"
        : effect.kind === "damage"
          ? `Deal ${effect.amount} ${DAMAGE_LABELS[effect.damageType]} damage${effect.leech ? " with Leech" : ""}`
          : effect.kind === "status"
            ? `Gain ${effect.amount} ${keywordLabel(effect.status)}`
            : effect.kind === "draw"
              ? `Draw ${effect.amount} card${effect.amount === 1 ? "" : "s"}`
              : effect.kind === "mana"
                ? `Gain ${effect.amount} Mana`
                : effect.kind === "heal"
                  ? `Restore ${effect.amount} Health`
                  : effect.kind === "blind"
                    ? "Blind all enemies"
                    : effect.kind === "meltArmor"
                      ? `Remove ${effect.amount}% of all enemies’ Armor, rounded up`
                      : effect.kind === "reflect"
                        ? effect.status === "burn"
                          ? "Reflect the next Burn"
                          : "Reflect the next harmful status effect"
                        : effect.kind === "cleanse" && effect.target === "allAllies"
                          ? "Cleanse all allies"
                          : effect.kind === "cleanse" && effect.target === "recipient"
                            ? "Cleanse the healed ally"
                            : `${effect.kind === "cleanse" ? "Cleanse acting creature" : "Purge target"}: remove ${effect.amount} effect${effect.amount === 1 ? "" : "s"}`);
  }
  if (card.leech) text += "; Leech";
  if (card.repeatChance) text += `; ${card.repeatChance}% chance to repeat`;
  return text;
}
/** Stable legacy route; new expeditions use the saved packs in encounters.ts. */
export const ENCOUNTERS = (
  [
    {
      name: "The overgrown trail",
      enemies: [
        { damageType: "burn", name: "Emberback", species: "emberback" as const },
        { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const },
        { damageType: "nature", name: "Mossguard", species: "mossguard" as const },
      ],
    },
    {
      name: "Beyond the fernwood",
      enemies: [
        {
          damageType: "physical",
          name: "Prismram",
          species: "prismram" as const,
        },
        { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const },
        { damageType: "nature", name: "Mossguard", species: "mossguard" as const },
      ],
    },
    {
      name: "Heart of the wilds",
      enemies: [{ damageType: "light", name: "The Hollow Crown", species: "prismram" as const }],
    },
  ] as const
).map((encounter) => ({
  ...encounter,
  enemies: encounter.enemies.map((enemy) => ({ ...enemy, health: species(enemy.species).health })),
}));

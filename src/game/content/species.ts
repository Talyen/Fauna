import { freeze } from "immer";
import type { Species, SpeciesId } from "./types";
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
export function species(id: SpeciesId): Species {
  const result = SPECIES.find((s) => s.id === id);
  if (!result) throw new Error(`Unknown species: ${id}`);
  return result;
}

freeze(SPECIES, true);

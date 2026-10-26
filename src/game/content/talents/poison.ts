import { talent } from "../talent-builder";
export const POISON_TALENTS = [
  talent("poison.necrosis", "Necrosis", 0, "Poisoned enemies receive half as much healing"),
  talent("poison.torpor", "Torpor", 0, "Poisoned enemies cannot Dodge"),
  talent(
    "poison.hemotoxin",
    "Hemotoxin",
    1,
    (rule) => `Poison has a ${rule.percent}% chance to also deal Bleed damage`,
  ),
  talent(
    "poison.corrosive",
    "Corrosive",
    1,
    (rule) => `Poisoned enemies take ${rule.amount} additional damage`,
  ),
  talent("poison.caustic", "Caustic", 2, "Poison damage removes enemy Armor equal to damage dealt"),
  talent("poison.toxin-resistance", "Toxin Resistance", 2, "Take half Poison damage"),
  talent(
    "poison.toxic-profit",
    "Toxic Profit",
    3,
    (rule) => `Gain ${rule.amount} Gold when you defeat a Poisoned enemy`,
  ),
  talent(
    "poison.paralytic-venom",
    "Paralytic Venom",
    3,
    (rule) => `Poison damage has a ${rule.percent}% chance to Stun`,
  ),
  talent(
    "poison.virulent",
    "Virulent",
    4,
    (rule) => `Poison has a ${rule.percent}% chance to gain instead of lose a stack`,
  ),
  talent(
    "poison.venom-strike",
    "Venom Strike",
    4,
    (rule) => `Poison cards have a ${rule.percent}% chance to play twice`,
  ),
] as const;

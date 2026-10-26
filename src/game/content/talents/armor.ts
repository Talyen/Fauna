import { talent } from "../talent-builder";
export const ARMOR_TALENTS = [
  talent("armor.bulwark", "Bulwark", 0, (rule) => `Start each battle with ${rule.amount} Armor`),
  talent(
    "armor.reactive-guard",
    "Reactive Guard",
    0,
    (rule) => `Gain ${rule.amount} Block when your Armor breaks`,
  ),
  talent(
    "armor.last-stand",
    "Last Stand",
    1,
    (rule) => `Gain ${rule.percent}% more Armor while below half Health`,
  ),
  talent(
    "armor.armored-surge",
    "Armored Surge",
    1,
    (rule) => `Playing a Block card has a ${rule.percent}% chance to grant ${rule.amount} Armor`,
  ),
  talent("armor.fireward", "Fireward", 2, "Armor mitigates Burn damage taken"),
  talent("armor.thick-hide", "Thick Hide", 2, "Armor mitigates Bleed damage taken"),
  talent(
    "armor.iron-guard",
    "Iron Guard",
    3,
    (rule) => `Dealing Physical damage has a ${rule.percent}% chance to also grant that amount of Armor`,
  ),
  talent(
    "armor.steadfast",
    "Steadfast",
    3,
    (rule) => `When your Health falls below half, gain ${rule.amount} Armor`,
  ),
  talent(
    "armor.purification",
    "Purification",
    4,
    (rule) => `Gaining Armor has a ${rule.percent}% chance to Cleanse a harmful status effect`,
  ),
  talent("armor.reinforced", "Reinforced", 4, (rule) => `${rule.percent}% chance to double Armor gained`),
] as const;

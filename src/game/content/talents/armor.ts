import { talent } from "../talent-builder";
export const ARMOR_TALENTS = [
  talent("armor.bulwark", "Bulwark", 0),
  talent("armor.reactive-guard", "Reactive Guard", 0),
  talent("armor.last-stand", "Last Stand", 1),
  talent("armor.armored-surge", "Armored Surge", 1),
  talent("armor.fireward", "Fireward", 2),
  talent("armor.thick-hide", "Thick Hide", 2),
  talent("armor.iron-guard", "Iron Guard", 3),
  talent("armor.steadfast", "Steadfast", 3),
  talent("armor.purification", "Purification", 4),
  talent("armor.reinforced", "Reinforced", 4),
] as const;

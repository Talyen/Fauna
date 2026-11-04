import { talent } from "../talent-builder";
export const POISON_TALENTS = [
  talent("poison.necrosis", "Necrosis", 0),
  talent("poison.torpor", "Torpor", 1),
  talent("poison.hemotoxin", "Hemotoxin", 1),
  talent("poison.corrosive", "Corrosive", 2),
  talent("poison.caustic", "Caustic", 2),
  talent("poison.toxin-resistance", "Toxin Resistance", 2),
  talent("poison.toxic-profit", "Toxic Profit", 3),
  talent("poison.paralytic-venom", "Paralytic Venom", 3),
  talent("poison.virulent", "Virulent", 3),
  talent("poison.venom-strike", "Venom Strike", 3),
] as const;

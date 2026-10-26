import { talent } from "../talent-builder";
export const POISON_TALENTS = [
  talent("poison.necrosis", "Necrosis", 0),
  talent("poison.torpor", "Torpor", 0),
  talent("poison.hemotoxin", "Hemotoxin", 1),
  talent("poison.corrosive", "Corrosive", 1),
  talent("poison.caustic", "Caustic", 2),
  talent("poison.toxin-resistance", "Toxin Resistance", 2),
  talent("poison.toxic-profit", "Toxic Profit", 3),
  talent("poison.paralytic-venom", "Paralytic Venom", 3),
  talent("poison.virulent", "Virulent", 4),
  talent("poison.venom-strike", "Venom Strike", 4),
] as const;

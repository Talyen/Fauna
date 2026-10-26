import { talent } from "../talent-builder";
export const MANA_TALENTS = [
  talent("mana.wellspring", "Wellspring", 0),
  talent("mana.dark-recovery", "Dark Recovery", 0),
  talent("mana.mana-bulwark", "Mana Bulwark", 1),
  talent("mana.leyline-attunement", "Leyline Attunement", 1),
  talent("mana.manaburn", "Manaburn", 2),
  talent("mana.arcane-frost", "Arcane Frost", 2),
  talent("mana.mana-shell", "Mana Shell", 3),
  talent("mana.arcane-mending", "Arcane Mending", 3),
] as const;

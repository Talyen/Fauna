import { talent } from "../talent-builder";
export const NATURE_TALENTS = [
  talent("nature.bramblegrowth", "Bramblegrowth", 0),
  talent("nature.ecosystem", "Ecosystem", 0),
  talent("nature.overgrowth", "Overgrowth", 1),
  talent("nature.thornskin", "Thornskin", 1),
  talent("nature.photosynthesis", "Photosynthesis", 2),
  talent("nature.windstep", "Windstep", 2),
  talent("nature.briar-patch", "Briar Patch", 3),
  talent("nature.toxic-pollen", "Toxic Pollen", 3),
  talent("nature.verdant-cycle", "Verdant Cycle", 4),
  talent("nature.entangle", "Entangle", 4),
] as const;

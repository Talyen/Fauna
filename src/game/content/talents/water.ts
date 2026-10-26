import { talent } from "../talent-builder";
export const WATER_TALENTS = [
  talent("water.pressure", "Pressure", 0, (rule) => `Water attacks deal ${rule.amount} more damage`),
  talent("water.seafoam", "Seafoam", 0, (rule) => `Water hits grant ${rule.amount} Block`),
  talent(
    "water.high-tide",
    "High Tide",
    1,
    (rule) => `Water attacks deal ${rule.percent}% more damage while you have Block`,
  ),
  talent("water.erosion", "Erosion", 1, (rule) => `Water hits remove ${rule.amount} Armor`),
  talent(
    "water.cleansing-current",
    "Cleansing Current",
    2,
    (rule) => `Water hits have a ${rule.percent}% chance to Cleanse ${rule.amount} harmful effect from you`,
  ),
  talent(
    "water.riptide",
    "Riptide",
    2,
    (rule) => `Water hits have a ${rule.percent}% chance to draw a Water card`,
  ),
] as const;

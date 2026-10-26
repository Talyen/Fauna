import { talent } from "../talent-builder";
export const WATER_TALENTS = [
  talent("water.pressure", "Pressure", 0),
  talent("water.seafoam", "Seafoam", 0),
  talent("water.high-tide", "High Tide", 1),
  talent("water.erosion", "Erosion", 1),
  talent("water.cleansing-current", "Cleansing Current", 2),
  talent("water.riptide", "Riptide", 2),
] as const;

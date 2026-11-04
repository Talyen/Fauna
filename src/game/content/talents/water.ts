import { talent } from "../talent-builder";
export const WATER_TALENTS = [
  talent("water.pressure", "Pressure", 0),
  talent("water.seafoam", "Seafoam", 1),
  talent("water.high-tide", "High Tide", 1),
  talent("water.erosion", "Erosion", 2),
  talent("water.cleansing-current", "Cleansing Current", 2),
  talent("water.riptide", "Riptide", 2),
  talent("water.frigid-current", "Frigid Current", 3),
  talent("water.storm-surge", "Storm Surge", 3),
  talent("water.spring-tide", "Spring Tide", 3),
  talent("water.living-water", "Living Water", 3),
] as const;

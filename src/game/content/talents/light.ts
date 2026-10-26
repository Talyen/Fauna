import { talent } from "../talent-builder";
export const LIGHT_TALENTS = [
  talent("light.faith-barrier", "Faith Barrier", 0),
  talent("light.blessed-leech", "Blessed Leech", 0),
  talent("light.celestial-ward", "Celestial Ward", 1),
  talent("light.purge", "Searing Light", 1),
  talent("light.divine-favor", "Divine Favor", 2),
  talent("light.prosperity", "Prosperity", 2),
  talent("light.scorching-light", "Scorching Light", 3),
  talent("light.tithe", "Tithe", 3),
  talent("light.radiant-guard", "Radiant Guard", 4),
] as const;

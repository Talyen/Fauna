import { talent } from "../talent-builder";
export const PHYSICAL_TALENTS = [
  talent("physical.shield-slam", "Shield Slam", 0),
  talent("physical.armored-fists", "Armored Fists", 0),
  talent("physical.heavy-blows", "Heavy Blows", 1),
  talent("physical.finish-him", "Finishing Blow", 1),
  talent("physical.lacerate", "Lacerate", 2),
  talent("physical.rupture", "Rupture", 2),
  talent("physical.riposte", "Riposte", 3),
  talent("physical.unrelenting", "Unrelenting", 3),
] as const;

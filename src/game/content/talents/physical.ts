import { talent } from "../talent-builder";
export const PHYSICAL_TALENTS = [
  talent("physical.shield-slam", "Shield Slam", 0, "Add half your Block to Physical damage"),
  talent("physical.armored-fists", "Armored Fists", 0, "Add half your Armor to Physical damage"),
  talent(
    "physical.heavy-blows",
    "Heavy Blows",
    1,
    (rule) => `Physical damage has a ${rule.percent}% chance to also Stun`,
  ),
  talent(
    "physical.finish-him",
    "Finishing Blow",
    1,
    (rule) => `Physical damage is doubled against enemies below ${rule.percent}% Health`,
  ),
  talent(
    "physical.lacerate",
    "Lacerate",
    2,
    (rule) => `Physical damage has a ${rule.percent}% chance to Bleed`,
  ),
  talent("physical.rupture", "Rupture", 2, "Physical critical hits detonate Bleed"),
  talent(
    "physical.riposte",
    "Riposte",
    3,
    "After you Dodge, your next Physical attack is guaranteed to Critical Hit",
  ),
  talent(
    "physical.unrelenting",
    "Unrelenting",
    3,
    "Physical damage is doubled while you're below half Health",
  ),
] as const;

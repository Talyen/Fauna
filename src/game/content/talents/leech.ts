import { talent } from "../talent-builder";
export const LEECH_TALENTS = [
  talent("leech.deep-siphon", "Deep Siphon", 0, (rule) => `Leech restores ${rule.amount} additional Health`),
  talent("leech.desperate-siphon", "Desperate Siphon", 0, "Double Leech healing while below half Health"),
  talent(
    "leech.blood-debt",
    "Blood Debt",
    1,
    (rule) => `Leech has a ${rule.percent}% chance to also grant Gold equal to Health restored`,
  ),
  talent(
    "leech.affliction-siphon",
    "Affliction Siphon",
    1,
    (rule) => `Leech restores ${rule.percent}% more Health against Poisoned or Bleeding enemies`,
  ),
  talent(
    "leech.cull-the-weak",
    "Cull the Weak",
    2,
    (rule) => `Leech cards deal ${rule.percent}% more damage against enemies below half Health`,
  ),
  talent(
    "leech.sanguine-overflow",
    "Sanguine Overflow",
    2,
    (rule) => `When Leech fills your Health, gain ${rule.amount} Mana`,
  ),
  talent(
    "leech.bloodletting",
    "Bloodletting",
    3,
    (rule) => `Leech has a ${rule.percent}% chance to cleanse a harmful status`,
  ),
  talent(
    "leech.mana-siphon",
    "Mana Siphon",
    3,
    (rule) => `Leech has a ${rule.percent}% chance to gain ${rule.amount} Mana`,
  ),
  talent(
    "leech.armor-siphon",
    "Armor Siphon",
    4,
    (rule) => `Your Leech cards steal ${rule.amount} Armor before their effects resolve`,
  ),
  talent(
    "leech.virulent-leech",
    "Virulent Leech",
    4,
    (rule) => `Poison damage has a ${rule.percent}% chance to Leech`,
  ),
] as const;

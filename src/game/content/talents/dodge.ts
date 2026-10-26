import { talent } from "../talent-builder";
export const DODGE_TALENTS = [
  talent("dodge.lightfoot", "Lightfoot", 0, (rule) => `Gain ${rule.amount}% Dodge chance`),
  talent("dodge.catch-breath", "Catch Breath", 0, (rule) => `Restore ${rule.amount} Health when you Dodge`),
  talent("dodge.thornstep", "Thornstep", 1, (rule) => `Gain ${rule.amount} Thorns when you Dodge`),
  talent(
    "dodge.clean-getaway",
    "Clean Getaway",
    1,
    (rule) => `When you Dodge, remove ${rule.amount} stack each of Burn, Poison, and Bleed from yourself`,
  ),
  talent(
    "dodge.open-flank",
    "Open Flank",
    2,
    (rule) => `When you Dodge, your next attack deals ${rule.amount} additional Physical damage`,
  ),
  talent("dodge.unburdened", "Unburdened", 2, "When you Dodge, cleanse your Stun and Freeze buildup"),
  talent("dodge.tailwind", "Tailwind", 3, "When you Dodge, draw a card"),
  talent(
    "dodge.finding-rhythm",
    "Finding Rhythm",
    3,
    (rule) => `Taking damage increases your Dodge chance by ${rule.amount}%, resetting when you Dodge`,
  ),
  talent(
    "dodge.perfect-timing",
    "Perfect Timing",
    4,
    (rule) => `When you Dodge without Armor, gain ${rule.amount} Armor`,
  ),
] as const;

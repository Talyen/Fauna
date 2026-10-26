import { talent } from "../talent-builder";
export const LIGHT_TALENTS = [
  talent(
    "light.faith-barrier",
    "Faith Barrier",
    0,
    (rule) => `Light hits have a ${rule.percent}% chance to grant Block equal to enemy Health lost`,
  ),
  talent("light.blessed-leech", "Blessed Leech", 0, "Light damage: Leech below half Health"),
  talent("light.celestial-ward", "Celestial Ward", 1, "Take half Light damage"),
  talent(
    "light.purge",
    "Searing Light",
    1,
    (rule) => `Light damage is increased by ${rule.percent}% against Burning enemies`,
  ),
  talent(
    "light.divine-favor",
    "Divine Favor",
    2,
    "When you cleanse a harmful status effect, your next Light card is free",
  ),
  talent(
    "light.prosperity",
    "Prosperity",
    2,
    (rule) => `Light damage is increased by ${rule.percent}% of your Gold`,
  ),
  talent(
    "light.scorching-light",
    "Scorching Light",
    3,
    (rule) => `Light damage has a ${rule.percent}% chance to also deal Burn damage`,
  ),
  talent(
    "light.tithe",
    "Tithe",
    3,
    (rule) => `Light damage has a ${rule.percent}% chance to grant Gold equal to enemy Health lost`,
  ),
  talent(
    "light.radiant-guard",
    "Radiant Guard",
    4,
    (rule) => `Gaining Block has a ${rule.percent}% chance to draw a Light card`,
  ),
] as const;

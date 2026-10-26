import { talent } from "../talent-builder";
export const NATURE_TALENTS = [
  talent(
    "nature.bramblegrowth",
    "Bramblegrowth",
    0,
    (rule) => `Nature hits have a ${rule.percent}% chance to grant Thorns equal to damage dealt`,
  ),
  talent("nature.ecosystem", "Ecosystem", 0, "Draw a Nature card at battle start"),
  talent(
    "nature.overgrowth",
    "Overgrowth",
    1,
    (rule) => `Nature cards have a ${rule.percent}% chance to play twice`,
  ),
  talent(
    "nature.thornskin",
    "Thornskin",
    1,
    (rule) => `Nature damage has a ${rule.percent}% chance to also grant Armor`,
  ),
  talent(
    "nature.photosynthesis",
    "Photosynthesis",
    2,
    (rule) => `Nature damage has a ${rule.percent}% chance to also restore Health`,
  ),
  talent("nature.windstep", "Windstep", 2, "When you Dodge, your next Nature card is free"),
  talent(
    "nature.briar-patch",
    "Briar Patch",
    3,
    (rule) => `Nature damage has a ${rule.percent}% chance to also Bleed`,
  ),
  talent(
    "nature.toxic-pollen",
    "Toxic Pollen",
    3,
    (rule) => `Nature damage has a ${rule.percent}% chance to also Poison`,
  ),
  talent(
    "nature.verdant-cycle",
    "Verdant Cycle",
    4,
    (rule) => `Nature damage has a ${rule.percent}% chance to Leech`,
  ),
  talent(
    "nature.entangle",
    "Entangle",
    4,
    (rule) => `Nature damage has a ${rule.percent}% chance to also Stun`,
  ),
] as const;

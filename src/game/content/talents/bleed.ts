import { talent } from "../talent-builder";
export const BLEED_TALENTS = [
  talent(
    "bleed.first-blood",
    "First Blood",
    0,
    (rule) => `Deal ${rule.percent}% more Bleed damage against enemies that aren’t already Bleeding`,
  ),
  talent("bleed.mortal-wound", "Mortal Wound", 0, "Bleeding enemies receive half as much healing"),
  talent(
    "bleed.parting-cut",
    "Parting Cut",
    1,
    "After you Dodge, your next Physical hit deals half its damage as additional Bleed damage",
  ),
  talent("bleed.sanguine", "Sanguine", 1, (rule) => `Bleed hits have a ${rule.percent}% chance to Leech`),
  talent("bleed.wound-care", "Wound Care", 2, "Take half Bleed damage"),
  talent("bleed.flay", "Flay", 2, (rule) => `Bleed hits have a ${rule.percent}% chance to halve enemy Armor`),
  talent(
    "bleed.bleeding-out",
    "Bleeding Out",
    3,
    (rule) => `Deal ${rule.percent}% more Bleed damage while below half Health`,
  ),
  talent(
    "bleed.tainted-wound",
    "Tainted Wound",
    3,
    (rule) => `Bleed hits have a ${rule.percent}% chance to deal half their damage as Poison damage`,
  ),
  talent(
    "bleed.septic-shock",
    "Septic Shock",
    4,
    (rule) => `Bleeding enemies take ${rule.percent}% more Poison damage`,
  ),
  talent(
    "bleed.bloodrush",
    "Bloodrush",
    4,
    (rule) => `Dealing Bleed damage has a ${rule.percent}% chance to draw a card`,
  ),
] as const;

import { talent } from "../talent-builder";
export const BLEED_TALENTS = [
  talent("bleed.first-blood", "First Blood", 0),
  talent("bleed.mortal-wound", "Mortal Wound", 0),
  talent("bleed.parting-cut", "Parting Cut", 1),
  talent("bleed.sanguine", "Sanguine", 1),
  talent("bleed.wound-care", "Wound Care", 2),
  talent("bleed.flay", "Flay", 2),
  talent("bleed.bleeding-out", "Bleeding Out", 3),
  talent("bleed.tainted-wound", "Tainted Wound", 3),
  talent("bleed.septic-shock", "Septic Shock", 4),
  talent("bleed.bloodrush", "Bloodrush", 4),
] as const;

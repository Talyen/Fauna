import { talent } from "../talent-builder";
export const FREEZE_TALENTS = [
  talent("freeze.bitter-cold", "Bitter Cold", 0),
  talent("freeze.glacial-barrier", "Glacial Barrier", 0),
  talent("freeze.brittle-ice", "Brittle Ice", 1),
  talent("freeze.winter-s-grasp", "Winter's Grasp", 1),
  talent("freeze.icebound", "Icebound", 2),
  talent("freeze.brittle-armor", "Brittle Armor", 2),
  talent("freeze.cold-resistance", "Cold Resistance", 3),
  talent("freeze.cryo-preservation", "Cryo-preservation", 3),
  talent("freeze.thaw-dividend", "Thaw Dividend", 4),
] as const;

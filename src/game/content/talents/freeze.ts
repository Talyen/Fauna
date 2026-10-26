import { talent } from "../talent-builder";
export const FREEZE_TALENTS = [
  talent(
    "freeze.bitter-cold",
    "Bitter Cold",
    0,
    (rule) => `Reduce enemy Freeze thresholds by ${rule.percent} percentage points`,
  ),
  talent(
    "freeze.glacial-barrier",
    "Glacial Barrier",
    0,
    (rule) => `Gain ${rule.amount} Block when you Freeze an enemy`,
  ),
  talent(
    "freeze.brittle-ice",
    "Brittle Ice",
    1,
    (rule) => `Frozen enemies take ${rule.amount} additional damage`,
  ),
  talent(
    "freeze.winter-s-grasp",
    "Winter's Grasp",
    1,
    (rule) => `Freeze cards have a ${rule.percent}% chance to play twice`,
  ),
  talent("freeze.icebound", "Icebound", 2, "When you Freeze an enemy, remove all its Block"),
  talent("freeze.brittle-armor", "Brittle Armor", 2, "When you Freeze an enemy, remove all its Armor"),
  talent("freeze.cold-resistance", "Cold Resistance", 3, "Take half Freeze damage"),
  talent("freeze.cryo-preservation", "Cryo-preservation", 3, "Poison does not decay on Frozen enemies"),
  talent("freeze.thaw-dividend", "Thaw Dividend", 4, "When an enemy recovers from Freeze, draw a card"),
] as const;

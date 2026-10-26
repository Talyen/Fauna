import { talent } from "../talent-builder";
export const HEALTH_TALENTS = [
  talent("health.mending", "Mending", 0, (rule) => `Receive ${rule.percent}% more healing during combat`),
  talent(
    "health.renewal",
    "Renewal",
    0,
    (rule) => `Cleansing a harmful status restores ${rule.amount} Health`,
  ),
  talent(
    "health.last-resort",
    "Last Resort",
    1,
    (rule) => `When your Health falls below ${rule.percent}%, cleanse all harmful status effects`,
  ),
  talent(
    "health.desperate-guard",
    "Desperate Guard",
    1,
    (rule) => `The first time your Health falls below half each combat, gain ${rule.amount} Block`,
  ),
  talent("health.will-to-live", "Will to Live", 2, (rule) => `Death's Door lasts ${rule.amount} turn longer`),
  talent(
    "health.combat-surge",
    "Combat Surge",
    2,
    (rule) => `Restore ${rule.amount} Health at the start of combat`,
  ),
  talent("health.vitality", "Vitality", 3, (rule) => `Restore ${rule.amount} Health after every combat`),
  talent(
    "health.overflow",
    "Overflow",
    3,
    (rule) => `Gain ${rule.percent}% of excess healing from cards as Block`,
  ),
  talent(
    "health.last-gasp",
    "Last Gasp",
    4,
    (rule) => `While below half Health, gain ${rule.percent}% Dodge chance`,
  ),
  talent(
    "health.clean-slate",
    "Clean Slate",
    4,
    "When a card restores Health beyond your maximum, cleanse a harmful status effect",
  ),
] as const;

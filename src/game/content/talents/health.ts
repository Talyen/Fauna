import { talent } from "../talent-builder";
export const HEALTH_TALENTS = [
  talent("health.mending", "Mending", 0),
  talent("health.renewal", "Renewal", 0),
  talent("health.last-resort", "Last Resort", 1),
  talent("health.desperate-guard", "Desperate Guard", 1),
  talent("health.will-to-live", "Will to Live", 2),
  talent("health.combat-surge", "Combat Surge", 2),
  talent("health.vitality", "Vitality", 3),
  talent("health.overflow", "Overflow", 3),
  talent("health.last-gasp", "Last Gasp", 4),
  talent("health.clean-slate", "Clean Slate", 4),
] as const;

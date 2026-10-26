import { talent } from "../talent-builder";
export const BURN_TALENTS = [
  talent("burn.flashpoint", "Flashpoint", 0),
  talent("burn.melting-point", "Melting Point", 0),
  talent("burn.smoke-screen", "Smoke Screen", 1),
  talent("burn.flash-fire", "Flash Fire", 1),
  talent("burn.heat-exhaustion", "Heat Exhaustion", 2),
  talent("burn.smoldering", "Smoldering", 2),
  talent("burn.fire-resistance", "Fire Resistance", 3),
] as const;

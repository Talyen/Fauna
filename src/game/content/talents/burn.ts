import { talent } from "../talent-builder";
export const BURN_TALENTS = [
  talent("burn.flashpoint", "Flashpoint", 0, "Your first Burn each battle is free"),
  talent("burn.melting-point", "Melting Point", 0, "Burn damage removes an equal amount of Armor"),
  talent(
    "burn.smoke-screen",
    "Smoke Screen",
    1,
    (rule) => `When you Dodge a Burning enemy, deal ${rule.amount} Burn damage`,
  ),
  talent(
    "burn.flash-fire",
    "Flash Fire",
    1,
    (rule) => `Burn cards have a ${rule.percent}% chance to play twice`,
  ),
  talent(
    "burn.heat-exhaustion",
    "Heat Exhaustion",
    2,
    (rule) => `Burn hits have a ${rule.percent}% chance to also deal Stun damage`,
  ),
  talent("burn.smoldering", "Smoldering", 2, (rule) => `Burn has a ${rule.percent}% chance to not decay`),
  talent("burn.fire-resistance", "Fire Resistance", 3, "Take half Burn damage"),
] as const;

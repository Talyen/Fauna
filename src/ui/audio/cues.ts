import type { DamageType } from "../../game/content";

/** Sound identities are shared by playback and the prepared-asset audit. */
export const SOUND_CUES = [
  "activate",
  "physical",
  "fire",
  "ice",
  "lightning",
  "poison",
  "nature",
  "light",
  "heal",
  "block",
  "absorb",
  "deny",
  "knockout",
  "victory",
  "defeat",
  "recruit",
  "talent",
] as const;
export type SoundCue = (typeof SOUND_CUES)[number];

export const DAMAGE_CUES = {
  physical: "physical",
  poison: "poison",
  nature: "nature",
  water: "physical",
  light: "light",
  burn: "fire",
  freeze: "ice",
  bleed: "physical",
  stun: "lightning",
} as const satisfies Record<DamageType, SoundCue>;

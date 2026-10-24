import { freeze } from "immer";
import { WATER_TALENTS } from "./talents/water";
import { PHYSICAL_TALENTS } from "./talents/physical";
import { BURN_TALENTS } from "./talents/burn";
import { FREEZE_TALENTS } from "./talents/freeze";
import { STUN_TALENTS } from "./talents/stun";
import { POISON_TALENTS } from "./talents/poison";
import { NATURE_TALENTS } from "./talents/nature";
import { LIGHT_TALENTS } from "./talents/light";
import { BLEED_TALENTS } from "./talents/bleed";
import { BLOCK_TALENTS } from "./talents/block";
import { HEALTH_TALENTS } from "./talents/health";
import { ARMOR_TALENTS } from "./talents/armor";
import { DODGE_TALENTS } from "./talents/dodge";
import { LEECH_TALENTS } from "./talents/leech";
import { MANA_TALENTS } from "./talents/mana";
// Keep starter talents before expanded trees in the original catalog order
export const TALENTS = [
  ...WATER_TALENTS,
  ...PHYSICAL_TALENTS.slice(0, 2),
  ...BURN_TALENTS.slice(0, 2),
  ...FREEZE_TALENTS.slice(0, 2),
  ...STUN_TALENTS.slice(0, 2),
  ...POISON_TALENTS.slice(0, 2),
  ...NATURE_TALENTS.slice(0, 2),
  ...LIGHT_TALENTS.slice(0, 2),
  ...BLEED_TALENTS.slice(0, 2),
  ...BLOCK_TALENTS.slice(0, 2),
  ...HEALTH_TALENTS.slice(0, 2),
  ...ARMOR_TALENTS.slice(0, 2),
  ...DODGE_TALENTS.slice(0, 2),
  ...LEECH_TALENTS.slice(0, 2),
  ...MANA_TALENTS.slice(0, 2),
  ...DODGE_TALENTS.slice(2),
  ...ARMOR_TALENTS.slice(2),
  ...BLEED_TALENTS.slice(2),
  ...BLOCK_TALENTS.slice(2),
  ...BURN_TALENTS.slice(2),
  ...FREEZE_TALENTS.slice(2),
  ...HEALTH_TALENTS.slice(2),
  ...LIGHT_TALENTS.slice(2),
  ...LEECH_TALENTS.slice(2),
  ...MANA_TALENTS.slice(2),
  ...NATURE_TALENTS.slice(2),
  ...PHYSICAL_TALENTS.slice(2),
  ...POISON_TALENTS.slice(2),
  ...STUN_TALENTS.slice(2),
] as const;
export type TalentId = (typeof TALENTS)[number]["id"];
freeze(TALENTS, true);

import { resolveCombat } from "./resolution";
import type { CombatArguments, OperationName } from "./operations";
export {
  TURN_MANA,
  TURN_DRAW,
  freshCombat,
  ensureCombat,
  controlled,
  mostInjured,
  sharedDodgeChance,
  dodgeChance,
  grantTemporaryDodge,
  beginAttack,
  openingCriticalBonus,
  removeArmor,
} from "./state";
export type { Combatant } from "./state";
const operation =
  <K extends OperationName>(kind: K) =>
  (...args: CombatArguments<K>) =>
    resolveCombat(kind, ...args);

export const restoreHealth = operation("restoreHealth");
export const grantBlock = operation("grantBlock");
export const gainMana = operation("gainMana");
export const grantArmor = operation("grantArmor");
export const armorStealRewards = operation("armorStealRewards");
export const grantStatus = operation("grantStatus");
export const triggerArmorBreak = operation("triggerArmorBreak");
export const removeControlBuildup = operation("removeControlBuildup");
export const removeEffects = operation("removeEffects");
export const applyBlind = operation("applyBlind");
export const applyHarmfulStatus = operation("applyHarmfulStatus");
export const negateAttack = operation("negateAttack");
export const hit = operation("hit");
export const tickStatuses = operation("tickStatuses");
export const startAction = operation("startAction");

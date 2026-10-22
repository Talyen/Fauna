import { resolveCombat, type CombatArguments } from "./combat-resolution";
export {
  TURN_MANA,
  TURN_DRAW,
  freshCombat,
  combat,
  controlled,
  mostInjured,
  hasHarmfulEffects,
  sharedDodgeChance,
  dodgeChance,
  grantTemporaryDodge,
  beginAttack,
  openingCriticalBonus,
  removeArmor,
} from "./combat-state";
export type { Combatant } from "./combat-state";
export const restoreHealth = (...args: CombatArguments<"restoreHealth">) =>
  resolveCombat("restoreHealth", ...args);
export const grantBlock = (...args: CombatArguments<"grantBlock">) => resolveCombat("grantBlock", ...args);
export const gainMana = (...args: CombatArguments<"gainMana">) => resolveCombat("gainMana", ...args);
export const grantArmor = (...args: CombatArguments<"grantArmor">) => resolveCombat("grantArmor", ...args);
export const grantStatus = (...args: CombatArguments<"grantStatus">) => resolveCombat("grantStatus", ...args);
export const triggerArmorBreak = (...args: CombatArguments<"triggerArmorBreak">) =>
  resolveCombat("triggerArmorBreak", ...args);
export const removeFreezeBuildup = (...args: CombatArguments<"removeFreezeBuildup">) =>
  resolveCombat("removeFreezeBuildup", ...args);
export const removeEffects = (...args: CombatArguments<"removeEffects">) =>
  resolveCombat("removeEffects", ...args);
export const applyBlind = (...args: CombatArguments<"applyBlind">) => resolveCombat("applyBlind", ...args);
export const hit = (...args: CombatArguments<"hit">) => resolveCombat("hit", ...args);
export const tickStatuses = (...args: CombatArguments<"tickStatuses">) =>
  resolveCombat("tickStatuses", ...args);
export const startAction = (...args: CombatArguments<"startAction">) => resolveCombat("startAction", ...args);

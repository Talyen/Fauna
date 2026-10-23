import type { bounce, hit, resolveHit, negateAttack } from "./damage";
import type {
  restoreHealth,
  shareProtection,
  grantBlock,
  gainMana,
  grantArmor,
  leechHealth,
  healthThresholds,
} from "./protection";
import type {
  grantStatus,
  triggerArmorBreak,
  removeControlBuildup,
  removeEffects,
  cleanseRewards,
  applyHarmfulStatus,
  controlRewards,
  applyBlind,
} from "./statuses";
import type { tickStatuses, startAction } from "./lifecycle";

export type Operations = {
  bounce: typeof bounce;
  hit: typeof hit;
  resolveHit: typeof resolveHit;
  negateAttack: typeof negateAttack;
  restoreHealth: typeof restoreHealth;
  shareProtection: typeof shareProtection;
  grantBlock: typeof grantBlock;
  gainMana: typeof gainMana;
  grantArmor: typeof grantArmor;
  leechHealth: typeof leechHealth;
  healthThresholds: typeof healthThresholds;
  grantStatus: typeof grantStatus;
  triggerArmorBreak: typeof triggerArmorBreak;
  removeControlBuildup: typeof removeControlBuildup;
  removeEffects: typeof removeEffects;
  cleanseRewards: typeof cleanseRewards;
  applyHarmfulStatus: typeof applyHarmfulStatus;
  controlRewards: typeof controlRewards;
  applyBlind: typeof applyBlind;
  tickStatuses: typeof tickStatuses;
  startAction: typeof startAction;
};
export type OperationName = keyof Operations;
export type CombatArguments<K extends OperationName> = Parameters<Operations[K]>;
export type CombatResult<K extends OperationName> =
  ReturnType<Operations[K]> extends Generator<unknown, infer R, unknown> ? R : never;
export type CombatOperation = { [K in OperationName]: { kind: K; args: CombatArguments<K> } }[OperationName];
export type Resolution<R = void> = Generator<CombatOperation, R, unknown>;

/** Yield one child to the explicit stack, retaining typed results in the suspended parent. */
export function* reaction<K extends OperationName>(
  kind: K,
  ...args: CombatArguments<K>
): Resolution<CombatResult<K>> {
  return (yield { kind, args } as CombatOperation) as CombatResult<K>;
}

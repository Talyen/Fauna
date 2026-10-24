import { bounce, hit, resolveHit, negateAttack } from "./damage";
import { previewWork } from "../random";
import {
  restoreHealth,
  shareProtection,
  grantBlock,
  gainMana,
  grantArmor,
  leechHealth,
  healthThresholds,
} from "./protection";
import {
  grantStatus,
  triggerArmorBreak,
  removeControlBuildup,
  removeEffects,
  cleanseRewards,
  applyHarmfulStatus,
  controlRewards,
  applyBlind,
} from "./statuses";
import { tickStatuses, startAction } from "./lifecycle";
import type {
  Operations,
  CombatArguments,
  CombatOperation,
  CombatResult,
  OperationName,
  Resolution,
} from "./operations";

const handlers = {
  bounce,
  restoreHealth,
  shareProtection,
  grantBlock,
  gainMana,
  grantArmor,
  leechHealth,
  healthThresholds,
  grantStatus,
  triggerArmorBreak,
  removeControlBuildup,
  removeEffects,
  cleanseRewards,
  applyHarmfulStatus,
  controlRewards,
  applyBlind,
  hit,
  resolveHit,
  negateAttack,
  tickStatuses,
  startAction,
} satisfies Operations;

function frame(operation: CombatOperation): Resolution<unknown> {
  // The discriminated request ties each argument tuple to this closed handler registry.
  // Erase that correlation only at invocation; callers retain the typed request/result pair.
  const handler = handlers[operation.kind] as (...args: unknown[]) => Resolution<unknown>;
  return handler(...operation.args);
}
/** Each root owns its stack and draft arguments; no global current resolver or saved continuation. */
export function resolveCombat<K extends OperationName>(
  kind: K,
  ...args: CombatArguments<K>
): CombatResult<K> {
  const stack: Resolution<unknown>[] = [frame({ kind, args } as CombatOperation)];
  let result: unknown;
  while (stack.length) {
    previewWork(args[0]);
    const step = stack[stack.length - 1]!.next(result);
    result = undefined;
    if (step.done) {
      stack.pop();
      result = step.value;
    } else stack.push(frame(step.value));
  }
  return result as CombatResult<K>;
}

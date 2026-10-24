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
  const operation = { kind, args } as CombatOperation;
  // Unit-first operations carry their optional state after the event list.
  const state =
    operation.kind === "restoreHealth" ||
    operation.kind === "grantStatus" ||
    operation.kind === "removeEffects"
      ? operation.args[4]
      : operation.args[0];
  const stack: Resolution<unknown>[] = [frame(operation)];
  let result: unknown;
  while (stack.length) {
    if (state) previewWork(state);
    const step = stack[stack.length - 1]!.next(result);
    result = undefined;
    if (step.done) {
      stack.pop();
      result = step.value;
    } else stack.push(frame(step.value));
  }
  return result as CombatResult<K>;
}

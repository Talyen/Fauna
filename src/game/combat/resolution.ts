import * as damage from "./damage";
import * as protection from "./protection";
import * as statuses from "./statuses";
import * as lifecycle from "./lifecycle";
import * as dodge from "./dodge";
import { previewWork } from "../random";
import type {
  Operations,
  CombatArguments,
  CombatOperation,
  CombatResult,
  OperationName,
  Resolution,
} from "./operations";

const handlers: Operations = { ...damage, ...protection, ...statuses, ...lifecycle, ...dodge };

function frame(operation: CombatOperation): Resolution<unknown> {
  // The discriminated request ties each argument tuple to this closed handler registry.
  // Erase that correlation only at invocation; callers retain the typed request/result pair.
  const handler = handlers[operation.kind] as (...args: unknown[]) => Resolution<unknown>;
  return handler(...operation.args);
}
export type CombatTraceStep = { kind: OperationName; phase: "enter" | "exit"; depth: number };

/** A trace is scoped to one explicitly invoked root and never stored in game state. */
export function traceCombatResolution<K extends OperationName>(
  observe: (step: CombatTraceStep) => void,
  kind: K,
  ...args: CombatArguments<K>
): CombatResult<K> {
  return runCombat(kind, args, observe);
}

/** Each root owns its stack and draft arguments; no global current resolver or saved continuation. */
export function resolveCombat<K extends OperationName>(
  kind: K,
  ...args: CombatArguments<K>
): CombatResult<K> {
  return runCombat(kind, args);
}

function runCombat<K extends OperationName>(
  kind: K,
  args: CombatArguments<K>,
  observe?: (step: CombatTraceStep) => void,
): CombatResult<K> {
  const operation = { kind, args } as CombatOperation;
  // Unit-first operations carry their optional state after the event list.
  const state =
    operation.kind === "restoreHealth" ||
    operation.kind === "grantStatus" ||
    operation.kind === "removeEffects"
      ? operation.args[4]
      : operation.kind === "startAction"
        ? operation.args[2]
        : operation.args[0];
  const stack: Resolution<unknown>[] = [frame(operation)];
  const names: OperationName[] | undefined = observe ? [kind] : undefined;
  observe?.({ kind, phase: "enter", depth: 0 });
  let result: unknown;
  while (stack.length) {
    if (state) previewWork(state);
    const step = stack[stack.length - 1]!.next(result);
    result = undefined;
    if (step.done) {
      if (observe && names) observe({ kind: names.pop()!, phase: "exit", depth: stack.length - 1 });
      stack.pop();
      result = step.value;
    } else {
      stack.push(frame(step.value));
      names?.push(step.value.kind);
      observe?.({ kind: step.value.kind, phase: "enter", depth: stack.length - 1 });
    }
  }
  return result as CombatResult<K>;
}

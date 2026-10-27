import { traceCombatResolution, type CombatTraceStep } from "../game/combat/resolution";
import type { CombatArguments, CombatResult, OperationName } from "../game/combat/operations";
import type { GameEvent, GameState } from "../game/types";

/** Captures detached checkpoints for a single explicit root; no observer is installed globally. */
export function traceCombat<K extends OperationName>(
  kind: K,
  args: CombatArguments<K>,
  state: GameState,
  events: GameEvent[],
): { result: CombatResult<K>; steps: (CombatTraceStep & { state: GameState; events: GameEvent[] })[] } {
  const steps: (CombatTraceStep & { state: GameState; events: GameEvent[] })[] = [];
  const result = traceCombatResolution(
    (step) => {
      // JSON also snapshots Immer drafts; the recorded state is data, never a live draft.
      steps.push({
        ...step,
        state: JSON.parse(JSON.stringify(state)),
        events: JSON.parse(JSON.stringify(events)),
      });
    },
    kind,
    ...args,
  );
  return { result, steps };
}

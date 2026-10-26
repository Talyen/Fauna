import { reaction, type CombatArguments, type Resolution } from "./operations";

/** Resolve standalone status applications before continuing the enclosing reaction. */
export function* applyResolvedStatus(...args: CombatArguments<"applyHarmfulStatus">): Resolution<void> {
  const [state, source, target, , type, events] = args;
  const result = yield* reaction("applyHarmfulStatus", ...args);
  if (result.appliedControl && type !== "blind")
    yield* reaction("controlRewards", state, source, target, type, events);
  for (const depletion of result.depletions) yield* reaction("triggerArmorBreak", state, depletion, events);
}

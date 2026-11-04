import { previewCard } from "./engine";
import type { CommandResult, GameState } from "./types";
import type { OffensivePacket, RandomDecision } from "./random";

export type PlayProjection =
  | {
      kind: "complete";
      outcomes: readonly CommandResult[];
      replays: number;
      offensive: readonly (readonly OffensivePacket[])[];
    }
  | { kind: "unknown"; reason: "hidden" | "budget"; replays: number };
class Fork extends Error {
  constructor(readonly decision: RandomDecision) {
    super("Alternative decisions");
  }
}
class Unresolved extends Error {
  constructor(readonly reason: "hidden" | "budget") {
    super(reason);
  }
}

/** Enumerate whole worlds through production rules; never consult the saved RNG or hidden draws. */
export function projectPlay(state: GameState, cardId: string, targetId?: string): PlayProjection {
  const pending: number[][] = [[]];
  const outcomes: CommandResult[] = [];
  const offensive: OffensivePacket[][] = [];
  let replays = 0;
  let steps = 0;
  const step = () => {
    if (++steps > 4096) throw new Unresolved("budget");
  };
  try {
    while (pending.length) {
      if (replays >= 128) throw new Unresolved("budget");
      replays++;
      const choices = pending.pop()!;
      let index = 0;
      try {
        const packets: OffensivePacket[] = [];
        outcomes.push(
          previewCard(
            state,
            cardId,
            targetId,
            Object.assign(
              (decision: RandomDecision | undefined) => {
                if (!decision) throw new Unresolved("hidden");
                if (
                  decision.kind === "index" &&
                  (!Number.isInteger(decision.size) || decision.size < 1 || decision.size > 64)
                )
                  throw new Unresolved("budget");
                if (index >= 64) throw new Unresolved("budget");
                if (
                  decision.kind === "chance"
                    ? decision.threshold <= 0 || decision.threshold >= 1
                    : decision.size === 1
                )
                  return decision.kind === "chance" ? 0 : 0.5;
                const choice = choices[index++];
                if (choice === undefined) throw new Fork(decision);
                return choice;
              },
              {
                step,
                offensive: (packet: OffensivePacket) => packets.push(packet),
              },
            ),
          ),
        );
        offensive.push(packets);
      } catch (error) {
        if (!(error instanceof Fork)) throw error;
        const decision = error.decision;
        const count = decision.kind === "chance" ? 2 : decision.size;
        if (pending.length + outcomes.length + count > 64) throw new Unresolved("budget");
        for (let option = 0; option < count; option++) {
          const value =
            decision.kind === "chance" ? (option === 0 ? 0 : decision.threshold) : (option + 0.5) / count;
          pending.push([...choices, value]);
        }
      }
    }
    return { kind: "complete", outcomes, replays, offensive };
  } catch (error) {
    if (!(error instanceof Unresolved)) throw error;
    // An incomplete set cannot establish bounds or guarantee a consequence.
    return { kind: "unknown", reason: error.reason, replays };
  }
}

import { createSession } from "../application/session";
import { chooseBattleCommand, BATTLE_POLICY_VERSION } from "../application/battle-policy";
import { createGame } from "../game/engine";
import { decodeSave, encodeSave } from "../game/save";
import { runJourney, type JourneyConfig, type JourneyStep } from "./playthrough";
import type { SpeciesId } from "../game/content";
import type { GameState } from "../game/types";

export interface BalanceCase {
  seed: number;
  starter: SpeciesId;
  checkpoint?: string;
  loadout?: { talents: string[]; boons: string[] };
}
export const BALANCE_CONFIG = {
  policyVersion: BATTLE_POLICY_VERSION,
  autoEndTurn: true,
  maxActions: 5000,
  maxTurns: 100,
  resumeEvery: 17,
};
export async function balanceCase(
  config: BalanceCase,
  identity: string,
  replay?: { initial: string; steps: JourneyStep[] },
  journal?: (record: unknown) => Promise<void>,
) {
  const base = config.checkpoint ? decodeSave(config.checkpoint) : createGame(config.seed);
  if (config.checkpoint && base.phase !== "battle")
    throw new Error("Experiments require a battle checkpoint.");
  const injected = structuredClone(base);
  if (config.loadout) {
    injected.talents = [...config.loadout.talents];
    injected.boons = [...config.loadout.boons] as GameState["boons"];
  }
  const initial = encodeSave(decodeSave(encodeSave(injected)));
  if (!config.checkpoint) {
    const journeyConfig: JourneyConfig = {
      seed: config.seed,
      starter: config.starter,
      runs: 1,
      policy: "heuristic",
      maxActions: 5000,
      maxTurns: 100,
      resumeEvery: 17,
    };
    const bundle = await runJourney(journeyConfig, identity, initial, undefined, journal);
    const last = bundle.steps.at(-1);
    const final = last ? decodeSave(last.checkpoint) : base;
    return {
      initial,
      base: encodeSave(base),
      complete: bundle.complete,
      reason: bundle.reason,
      replay: bundle,
      metrics: metrics(
        base,
        final,
        bundle.steps,
        bundle.battles.reduce((n, b) => n + b.turns, 0),
        final.phase === "victory",
      ),
    };
  }
  if (replay && replay.initial !== initial) throw new Error("Replay initial checkpoint differs.");
  let saved = initial;
  const open = async () => {
    const session = createSession({
      desktop: false,
      steam: { available: false },
      saves: {
        readCandidates: async () => [{ source: "primary", data: saved }],
        write: async (data) => {
          saved = data;
        },
      },
    });
    await session.load();
    return session;
  };
  let session = await open();
  const steps: JourneyStep[] = [];
  let turns = 1;
  let complete = false,
    reason = "Action budget exhausted";
  try {
    for (let i = 0; i < (replay ? replay.steps.length : 5000); i++) {
      const before = session.store.getState().game;
      if (before.phase !== "battle") throw new Error("Unexpected completed checkpoint.");
      if (before.battle!.turn > 100) {
        reason = "Turn budget exhausted";
        break;
      }
      const command = replay ? replay.steps[i]!.command : chooseBattleCommand(before);
      await journal?.({ type: "attempt", index: i, command });
      const accepted = session.command(command);
      if (!(await session.flush())) throw new Error("In-memory save failed.");
      const after = session.store.getState().game;
      const step = { command, accepted, checkpoint: encodeSave(decodeSave(saved)) };
      steps.push(step);
      await journal?.({ type: "completed", index: i, ...step });
      turns = Math.max(turns, (after.battle?.turn ?? before.battle!.turn) - base.battle!.turn + 1);
      if (
        replay &&
        (step.checkpoint !== replay.steps[i]!.checkpoint || accepted !== replay.steps[i]!.accepted)
      )
        throw new Error(`Replay diverged at action ${i + 1}.`);
      if (!accepted) {
        reason = "Command rejected";
        break;
      }
      if (after.phase !== "battle") {
        complete = true;
        reason = "Battle completed";
        break;
      }
      if ((i + 1) % 17 === 0) {
        await session.dispose();
        session = await open();
      }
    }
    if (replay && steps.length !== replay.steps.length) throw new Error("Replay ended before its journal.");
    const final = session.store.getState().game;
    return {
      initial,
      base: encodeSave(base),
      complete,
      reason,
      replay: { format: 1, identity, initial, steps },
      metrics: metrics(base, final, steps, turns, final.phase !== "defeat" && complete),
    };
  } finally {
    await session.dispose();
  }
}
function metrics(before: GameState, after: GameState, steps: JourneyStep[], turns: number, win: boolean) {
  return {
    win: Number(win),
    turns,
    health: [...after.team, ...after.reserves].reduce((n, c) => n + c.health, 0),
    encounter: after.encounter,
    swaps: steps.filter((step) => step.command.type === "swap" && step.accepted).length,
    currency: after.currency - before.currency,
    xp:
      Object.values(after.keywordXP).reduce((n, xp) => n + (xp ?? 0), 0) -
      Object.values(before.keywordXP).reduce((n, xp) => n + (xp ?? 0), 0),
  };
}

import { KEYWORDS, talentPoints } from "../game/progression";
import { BATTLE_POLICY_VERSION } from "../application/battle-policy";
import { createJourneyActor } from "./journey-policy";
import { createBattleProgress, type IncompleteBattle } from "./battle-progress";
import { createRecordedSession, type JourneyStep } from "./recorded-session";
export type { JourneyStep } from "./recorded-session";
import { createGame } from "../game/engine";
import { decodeSave, encodeSave } from "../game/save";
import { type SpeciesId } from "../game/content";
import type { GameState } from "../game/types";

export interface JourneyConfig {
  seed: number;
  runs: number;
  starter: SpeciesId;
  policy: "heuristic" | "random";
  maxActions: number;
  maxTurns: number;
  resumeEvery: number;
}
export interface JourneyBundle {
  format: 4;
  policyVersion: number;
  identity: string;
  config: JourneyConfig;
  initial: string;
  steps: JourneyStep[];
  complete: boolean;
  reason: string;
  diagnostics: IncompleteBattle | null;
  battles: { encounter: number; turns: number; roster: SpeciesId[]; outcome: string }[];
  milestones: { keyword: string; point: number; action: number }[];
  results: {
    outcome: string;
    encounter: number;
    actions: number;
    currency: number;
    xp: GameState["keywordXP"];
    roster: SpeciesId[];
  }[];
}
export async function runJourney(
  config: JourneyConfig,
  identity: string,
  initial = encodeSave(createGame(config.seed)),
  replay?: JourneyBundle,
  journal?: (record: unknown) => Promise<void>,
) {
  if (
    !Number.isInteger(config.maxActions) ||
    config.maxActions < 1 ||
    config.maxActions > 5000 ||
    !Number.isInteger(config.maxTurns) ||
    config.maxTurns < 1 ||
    config.maxTurns > 100 ||
    !Number.isInteger(config.resumeEvery) ||
    config.resumeEvery < 0 ||
    config.resumeEvery > 5000 ||
    !Number.isInteger(config.runs) ||
    config.runs < 1 ||
    config.runs > 20
  )
    throw new Error("Invalid scenario budgets.");
  if (replay && (!Array.isArray(replay.steps) || replay.steps.length > 5000))
    throw new Error("Invalid replay journal.");
  if (
    replay &&
    (replay.identity !== identity || replay.format !== 4 || replay.policyVersion !== BATTLE_POLICY_VERSION)
  )
    throw new Error("Replay content/build identity mismatch.");
  decodeSave(initial);
  const recording = await createRecordedSession(initial, "state", journal);
  const decide = createJourneyActor(config);
  const progress = createBattleProgress();
  progress.observe(recording.session.store.getState().game);
  const bundle: JourneyBundle = {
    format: 4,
    policyVersion: BATTLE_POLICY_VERSION,
    identity,
    config,
    initial,
    steps: [],
    complete: false,
    reason: "Action budget exhausted",
    diagnostics: null,
    battles: [],
    milestones: [],
    results: [],
  };
  try {
    const limit = replay ? replay.steps.length : config.maxActions;
    for (let index = 0; index < limit; index++) {
      const before = recording.session.store.getState().game;
      if (before.phase === "battle" && before.battle!.turn > config.maxTurns) {
        bundle.reason = "Turn budget exhausted";
        break;
      }
      const selected = replay
        ? { command: replay.steps[index]!.command, reason: replay.steps[index]!.decision }
        : decide(before);
      const command = selected.command;
      const { after, step } = await recording.step(index, command, selected.reason, replay?.steps[index]);
      progress.observe(after);
      bundle.steps.push(step);
      for (const keyword of KEYWORDS)
        for (const point of [1, 2])
          if (
            talentPoints(before.keywordXP[keyword] ?? 0) < point &&
            talentPoints(after.keywordXP[keyword] ?? 0) >= point
          )
            bundle.milestones.push({ keyword, point, action: index + 1 });
      if (before.phase === "battle" && after.phase !== "battle")
        bundle.battles.push({
          encounter: before.encounter,
          turns: before.battle!.turn,
          roster: [...before.team, ...before.reserves].map((unit) => unit.species),
          outcome: after.phase === "defeat" ? "defeat" : "victory",
        });
      if (!step.accepted) {
        bundle.reason = `Rejected ${command.type}: ${recording.session.store.getState().error}`;
        break;
      }
      if (before.phase !== after.phase && ["victory", "defeat"].includes(after.phase)) {
        bundle.results.push({
          outcome: after.journey?.outcome ?? (after.phase === "victory" ? "victory" : "defeat"),
          encounter: after.encounter,
          actions: index + 1,
          currency: after.currency,
          xp: after.keywordXP,
          roster: [...after.team, ...after.reserves].map((unit) => unit.species),
        });
        if (bundle.results.length >= config.runs) {
          bundle.complete = true;
          bundle.reason = "Completed requested journeys";
          break;
        }
      }
      if (config.resumeEvery > 0 && (index + 1) % config.resumeEvery === 0) {
        await recording.resume();
      }
    }
    if (replay && bundle.steps.length !== replay.steps.length)
      throw new Error("Replay ended before its journal.");
    bundle.diagnostics = bundle.complete ? null : progress.snapshot();
    return bundle;
  } finally {
    await recording.dispose();
  }
}

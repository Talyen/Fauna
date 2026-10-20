import { springRecovery } from "../game/support";
import { battleChoices } from "./battle-policy";
import { createSession, type Session } from "./session";
import { createGame } from "../game/engine";
import { decodeSave, encodeSave } from "../game/save";
import { type SpeciesId } from "../game/content";
import { TALENTS, canBuyTalent, KEYWORDS, talentPoints } from "../game/progression";
import type { Command, GameState } from "../game/types";

export interface JourneyConfig {
  seed: number;
  runs: number;
  starter: SpeciesId;
  policy: "heuristic" | "random";
  maxActions: number;
  maxTurns: number;
  resumeEvery: number;
}
export interface JourneyStep {
  command: Command;
  accepted: boolean;
  checkpoint: string;
}
export interface JourneyBundle {
  format: 3;
  identity: string;
  config: JourneyConfig;
  initial: string;
  steps: JourneyStep[];
  complete: boolean;
  reason: string;
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
function actor(config: JourneyConfig) {
  let rng = (config.seed ^ 0x9e3779b9) >>> 0;
  const pick = <T>(items: readonly T[]) => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return items[Math.floor((rng / 4294967296) * items.length)]!;
  };
  return (state: GameState): Command => {
    const talent = TALENTS.find((entry) => canBuyTalent(state, entry.id));
    if (talent) return { type: "buyTalent", talentId: talent.id };
    switch (state.phase) {
      case "draft":
        return state.selected.length ? { type: "start" } : { type: "draft", species: config.starter };
      case "campfire":
        return { type: "rest" };
      case "support": {
        const v = state.support!;
        if (
          v.kind === "spring" &&
          state.currency >= 1_000_000 &&
          ![...state.team, ...state.reserves].some((c) => springRecovery(c) > 0)
        )
          return { type: "leaveSupport", visit: v.id };
        if (v.resolved) return { type: "leaveSupport", visit: v.id };
        if (v.kind === "spring")
          return {
            type: "springChoice",
            visit: v.id,
            choice: [...state.team, ...state.reserves].some((c) => springRecovery(c) > 0)
              ? "heal"
              : state.currency < 1_000_000
                ? "currency"
                : "heal",
          };
        const slot = v.stock.find((s) => s.price <= state.currency);
        return slot
          ? { type: "buyBoon", visit: v.id, slot: slot.slot }
          : { type: "leaveSupport", visit: v.id };
      }
      case "teamSelection":
        if (state.support && !state.support.resolved)
          return { type: "enterSupport", visit: state.support.id };
        if (state.expedition?.step === 3 && !state.expedition.campfireUsed) return { type: "visitCampfire" };
        return {
          type: "beginBattle",
          destination: state.expedition ? pick(state.expedition.offers).location : undefined,
        };
      case "recruit":
        return {
          type: "recruit",
          species: pick(state.reward!.recruits),
          ...(state.roster.length === 5 ? { replace: pick([...state.team, ...state.reserves]).id } : {}),
        };
      case "boon":
        return { type: "chooseBoon", boon: pick(state.reward!.boons) };
      case "victory":
      case "defeat":
        return { type: "newRun", seed: (config.seed + state.revision) >>> 0 };
      case "battle": {
        const options = battleChoices(state);
        if (!options.length) return { type: "endTurn" };
        return config.policy === "random" ? pick(options) : options[0]!;
      }
    }
  };
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
  decodeSave(initial);
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
  let session: Session = await open();
  const decide = actor(config);
  const bundle: JourneyBundle = {
    format: 3,
    identity,
    config,
    initial,
    steps: [],
    complete: false,
    reason: "Action budget exhausted",
    battles: [],
    milestones: [],
    results: [],
  };
  if (replay && (replay.identity !== identity || replay.format !== 3))
    throw new Error("Replay content/build identity mismatch.");
  try {
    const limit = replay ? replay.steps.length : config.maxActions;
    for (let index = 0; index < limit; index++) {
      const before = session.store.getState().game;
      if (before.phase === "battle" && before.battle!.turn > config.maxTurns) {
        bundle.reason = "Turn budget exhausted";
        break;
      }
      const command = replay ? replay.steps[index]!.command : decide(before);
      await journal?.({ type: "attempt", index, command });
      const accepted = session.command(command);
      if (!(await session.flush())) throw new Error("In-memory save failed.");
      const after = session.store.getState().game;
      const step = { command, accepted, checkpoint: encodeSave(decodeSave(encodeSave(after))) };
      bundle.steps.push(step);
      await journal?.({ type: "completed", index, ...step });
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
          roster: before.roster,
          outcome: after.phase === "defeat" ? "defeat" : "victory",
        });
      if (
        replay &&
        (step.checkpoint !== replay.steps[index]!.checkpoint || accepted !== replay.steps[index]!.accepted)
      )
        throw new Error(`Replay diverged at action ${index + 1}.`);
      if (!accepted) {
        bundle.reason = `Rejected ${command.type}: ${session.store.getState().error}`;
        break;
      }
      if (before.phase !== after.phase && ["victory", "defeat"].includes(after.phase)) {
        bundle.results.push({
          outcome: after.journey?.outcome ?? (after.phase === "victory" ? "victory" : "defeat"),
          encounter: after.encounter,
          actions: index + 1,
          currency: after.currency,
          xp: after.keywordXP,
          roster: after.roster,
        });
        if (bundle.results.length >= config.runs) {
          bundle.complete = true;
          bundle.reason = "Completed requested journeys";
          break;
        }
      }
      if (config.resumeEvery > 0 && (index + 1) % config.resumeEvery === 0) {
        await session.dispose();
        session = await open();
      }
    }
    if (replay && bundle.steps.length !== replay.steps.length)
      throw new Error("Replay ended before its journal.");
    return bundle;
  } finally {
    await session.dispose();
  }
}

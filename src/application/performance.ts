import { createGame, dispatch } from "../game/engine";
import { CARDS, species, type SpeciesId, definition } from "../game/content";
import { freshCombat } from "../game/combat";
import { encodeSave, decodeSave } from "../game/save";
import { battleChoices } from "./battle-policy";
import type { Command, GameState } from "../game/types";

export function performanceCases(seed = 42) {
  const fixture = structuredClone(createGame(seed));
  const kinds: SpeciesId[] = ["mossguard", "emberback", "prismram", "pollenmoth"];
  fixture.roster = kinds;
  fixture.selected = kinds.slice(0, 3);
  fixture.starterOffers = [];
  fixture.discovery = {
    encountered: [...kinds],
    recruited: Object.fromEntries(kinds.map((kind) => [kind, 1])),
  };
  fixture.team = kinds.slice(0, 3).map((kind, i) => ({
    id: `ally-${i}`,
    species: kind,
    health: species(kind).health,
    block: 0,
    combat: freshCombat(),
    attacked: false,
  }));
  fixture.reserves = [
    {
      id: "reserve-0",
      species: "pollenmoth",
      health: species("pollenmoth").health,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    },
  ];
  fixture.lineup = fixture.team.map((c) => c.id);
  fixture.cards = fixture.team.flatMap((c) =>
    CARDS.filter((card) => card.species === c.species).map((card) => ({
      id: `${c.id}:${card.id}`,
      definitionId: card.id,
      ownerId: c.id,
      level: 0,
    })),
  );
  fixture.phase = "teamSelection";
  fixture.expedition = null;
  const started = dispatch(fixture, { type: "beginBattle" });
  if (!started.accepted) throw new Error(started.reason);
  const initial = encodeSave(decodeSave(encodeSave(started.state)));
  const attack = battleChoices(started.state, false).find(
    (c) =>
      c.type === "play" &&
      definition(started.state.cards.find((card) => card.id === c.cardId)!.definitionId).effect === "attack",
  );
  if (!attack || attack.type !== "play") throw new Error("Performance fixture has no attack.");
  const step = (state: GameState, command: Command) => {
    const result = dispatch(state, command);
    if (!result.accepted) throw new Error(result.reason);
    return encodeSave(decodeSave(encodeSave(result.state)));
  };
  const played = step(started.state, attack);
  return [
    {
      id: "battle",
      initial,
      fixture: "explicit-three-deployed-one-reserve-v1",
      actions: [
        { kind: "play", command: attack, checkpoint: played },
        {
          kind: "endTurn",
          command: { type: "endTurn" },
          checkpoint: step(decodeSave(played), { type: "endTurn" }),
        },
      ],
    },
    {
      id: "swap",
      initial,
      fixture: "explicit-three-deployed-one-reserve-v1",
      actions: [
        {
          kind: "swap",
          command: { type: "swap", activeId: "ally-0", reserve: "reserve-0" },
          checkpoint: step(started.state, { type: "swap", activeId: "ally-0", reserve: "reserve-0" }),
        },
      ],
    },
    {
      id: "menus",
      initial,
      fixture: "explicit-three-deployed-one-reserve-v1",
      actions: [
        { kind: "click", name: "Collection", checkpoint: initial },
        { kind: "click", name: "Inspect Mossguard", checkpoint: initial },
        { kind: "click", name: "Back", checkpoint: initial },
        { kind: "click", name: "Open menu", checkpoint: initial },
        { kind: "click", name: "Settings", checkpoint: initial },
        { kind: "click", name: "Open menu", checkpoint: initial },
      ],
    },
  ];
}

/** Generate evidence through ordinary commands rather than granting a late-game fixture. */
export async function reachablePerformanceCases(seed = 42) {
  const { runJourney } = await import("./playthrough");
  const journey = await runJourney(
    {
      seed,
      runs: 3,
      starter: "captoad",
      policy: "heuristic",
      maxActions: 5000,
      maxTurns: 100,
      resumeEvery: 17,
    },
    "performance-generation",
  );
  if (!journey.complete) throw new Error(`Performance journey incomplete: ${journey.reason}`);
  const checkpoints = journey.steps
    .filter((step) => step.accepted)
    .map((step) => step.checkpoint)
    .filter((checkpoint) => decodeSave(checkpoint).phase === "battle");
  if (checkpoints.length < 2) throw new Error("Insufficient reachable battle checkpoints.");
  const chosen = [checkpoints[0]!, checkpoints.at(-1)!];
  return chosen.map((initial, index) => {
    let state = decodeSave(initial);
    const inventory = {
      seed,
      encounter: state.encounter,
      turn: state.battle!.turn,
      roster: state.roster,
      talents: state.talents,
      boons: state.boons,
      hand: state.battle!.hand.map((id) => state.cards.find((card) => card.id === id)!.definitionId),
    };
    const actions = [];
    for (let count = 0; count < 3 && state.phase === "battle"; count++) {
      const command = battleChoices(state, false)[0] ?? { type: "endTurn" as const };
      const result = dispatch(state, command);
      if (!result.accepted) throw new Error(`Reachable performance command rejected: ${result.reason}`);
      state = result.state;
      actions.push({ kind: command.type, command, checkpoint: encodeSave(state) });
    }
    return {
      id: `reachable-${index === 0 ? "early" : "late"}`,
      fixture: "seeded-three-journey-v1",
      initial,
      inventory,
      journey,
      actions,
    };
  });
}

import { createGame, dispatch } from "../game/engine";
import { CARDS, species, type SpeciesId, definition } from "../game/content";
import { freshCombat } from "../game/combat/index";
import { encodeSave, decodeSave } from "../game/save";
import { createBattleActor } from "../application/battle-actor";
import { ownedCards } from "../game/team";
import { battleChoices } from "../application/battle-policy";
import type { Command, GameState } from "../game/types";

export function performanceCases(seed = 42, diagnostic = false, resources = false) {
  const fixture = structuredClone(createGame(seed));
  const kinds: SpeciesId[] = ["mossguard", "emberback", "prismram", "pollenmoth"];

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

  fixture.cards = fixture.team.flatMap((c) =>
    CARDS.filter((card) => card.species === c.species).map((card) => ({
      id: `${c.id}:${card.id}`,
      definitionId: card.id,
      ownerId: c.id,
      level: 0,
    })),
  );
  Object.assign(fixture, {
    phase: "teamSelection",
    expedition: { pack: ["emberback", "pollenmoth", "mossguard"], recruit: null, lastRoom: null },
    battle: null,
    reward: null,
    support: null,
    journey: { encounteredEnemies: [], outcome: null, victories: 2, currency: 0, xp: {}, lastBattle: null },
  } satisfies import("../game/types").Lifecycle);
  fixture.encounter = 2;
  const started = dispatch(fixture, { type: "beginBattle" });
  if (!started.accepted) throw new Error(started.reason);
  const initial = encodeSave(decodeSave(encodeSave(started.state)));
  const attack = battleChoices(started.state, false).find(
    (c) =>
      c.type === "play" &&
      c.targetId !== undefined &&
      definition(started.state.cards.find((card) => card.id === c.cardId)!.definitionId).effect === "attack",
  );
  if (!attack || attack.type !== "play") throw new Error("Performance fixture has no attack.");
  const step = (state: GameState, command: Command) => {
    const result = dispatch(state, command);
    if (!result.accepted) throw new Error(result.reason);
    return encodeSave(decodeSave(encodeSave(result.state)));
  };
  const played = step(started.state, attack);
  const knockedOut = structuredClone(started.state);
  knockedOut.team[0]!.health = 0;
  knockedOut.discovery.encountered.push("captoad");
  knockedOut.discovery.recruited.captoad = 1;
  knockedOut.reserves.push({
    id: "reserve-1",
    species: "captoad",
    health: species("captoad").health,
    block: 0,
    combat: freshCombat(),
    attacked: false,
  });
  const previewActions = [
    { kind: "select", cardId: attack.cardId, checkpoint: initial },
    { kind: "target", targetId: attack.targetId, checkpoint: initial },
    { kind: "targetKey", key: "d", checkpoint: initial },
    { kind: "cancel", checkpoint: initial },
  ];
  if (diagnostic)
    return [
      {
        id: "diagnostic-stall",
        initial,
        fixture: "synthetic-stall-v1",
        actions: [{ kind: "stall", checkpoint: initial }],
      },
    ];
  if (resources)
    return [
      {
        id: "resource-menus",
        initial,
        fixture: "repeated-artwork-navigation-v1",
        actions: Array.from({ length: 3 }, () => [
          { kind: "click", name: "Collection", checkpoint: initial },
          { kind: "click", name: "Inspect Mossguard", checkpoint: initial },
          { kind: "cancel", checkpoint: initial },
          { kind: "click", name: "Next page", checkpoint: initial },
          { kind: "click", name: "Previous page", checkpoint: initial },
          { kind: "click", name: "Back", checkpoint: initial },
          { kind: "click", name: "Talents", checkpoint: initial },
          { kind: "click", name: "Back", checkpoint: initial },
        ]).flat(),
      },
    ];
  return [
    { id: "preview", initial, fixture: "target-preview-v1", actions: previewActions },
    ...workloadCases(initial),
    {
      id: "battle",
      initial,
      fixture: "explicit-three-deployed-one-reserve-v2",
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
      initial: encodeSave(decodeSave(encodeSave(knockedOut))),
      fixture: "knockout-with-two-backups-v3",
      actions: [
        {
          kind: "swap",
          command: { type: "swap", activeId: "ally-0", reserve: "reserve-0" },
          checkpoint: step(knockedOut, { type: "swap", activeId: "ally-0", reserve: "reserve-0" }),
        },
      ],
    },
    {
      id: "menus",
      initial,
      fixture: "inspection-and-pause-settings-v3",
      actions: [
        { kind: "click", name: "Collection", checkpoint: initial },
        { kind: "click", name: "Inspect Mossguard", checkpoint: initial },
        { kind: "cancel", checkpoint: initial },
        { kind: "click", name: "Back", checkpoint: initial },
        { kind: "click", name: "Continue", checkpoint: initial },
        { kind: "click", name: "Open menu", checkpoint: initial },
        { kind: "click", name: "Settings", checkpoint: initial },
        { kind: "click", name: "Back", checkpoint: initial },
        { kind: "click", name: "Continue", checkpoint: initial },
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
      roster: [...state.team, ...state.reserves].map((unit) => unit.species),
      talents: state.talents,
      boons: state.boons,
      hand: state.battle!.hand.map((id) => state.cards.find((card) => card.id === id)!.definitionId),
    };
    const actions = [];
    const actor = createBattleActor();
    for (let count = 0; count < 3 && state.phase === "battle"; count++) {
      const command = actor.choose(state, false).command;
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

/** Explicit stress fixtures remain separate from earned reachable-journey evidence. */
function workloadCases(initial: string) {
  return ["area-reactions", "draw-repeat"].map((id) => {
    const state = structuredClone(decodeSave(initial));
    const first = state.team[0]!;
    if (id === "draw-repeat") {
      first.species = "chimecricket";
      first.health = species("chimecricket").health;
      first.block = 0;
      first.combat = freshCombat();
      state.discovery.encountered.push("chimecricket");
      state.discovery.recruited.chimecricket = 6;
      state.cards = state.team.flatMap((unit) => ownedCards(unit.id, unit.species));
      state.rng = 1;
    } else {
      for (const enemy of state.battle!.enemies) enemy.combat.reflect = true;
    }
    const card = state.cards.find(
      (entry) =>
        definition(entry.definitionId).name === (id === "draw-repeat" ? "Resonant Leap" : "Magma Stomp"),
    )!;
    const rest = state.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    state.battle!.hand = [card.id, ...rest.splice(0, 5)];
    state.battle!.buffer = rest.splice(0, 2);
    state.battle!.draw = rest;
    state.battle!.discard = [];
    const command = {
      type: "play" as const,
      cardId: card.id,
      ...(id === "draw-repeat" ? { targetId: "enemy-0" } : {}),
      autoEndTurn: false,
    };
    const checkpoint = encodeSave(decodeSave(encodeSave(state)));
    const result = dispatch(decodeSave(checkpoint), command);
    if (!result.accepted) throw new Error(result.reason);
    if (
      id === "draw-repeat" &&
      !result.events.some((event) => event.kind === "action" && event.text.includes("repeats"))
    )
      throw new Error("Repeat fixture did not exercise repeat feedback");
    return {
      id,
      fixture: "explicit-reactions-overflow-v1",
      initial: checkpoint,
      inventory: {
        roster: state.team.map((unit) => unit.species),
        talents: state.talents,
        boons: state.boons,
        hand: state.battle!.hand.length,
        overflow: state.battle!.buffer.length,
      },
      actions: [{ kind: "play", command, checkpoint: encodeSave(decodeSave(encodeSave(result.state))) }],
    };
  });
}

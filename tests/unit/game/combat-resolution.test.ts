import { createHash } from "node:crypto";
import { produce } from "immer";
import { expect, it } from "vitest";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { KEYWORDS } from "../../../src/game/progression";
import { BOONS, TALENTS, definition, species, type SpeciesId } from "../../../src/game/content";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { cardTargeting, cardText, enemyCard, enemyCanUse } from "../../../src/game/card-rules";
import { cardKeywords } from "../../../src/game/progression";
import { playTargetError } from "../../../src/game/play-queries";
import { enemyAbilityValue } from "../../../src/game/ability-rules";
import { executeAbility } from "../../../src/game/combat/abilities";
import { summonEcho } from "../../../src/game/combat/legendary";
import { swapFromCard } from "../../../src/game/team";
import type { GameEvent } from "../../../src/game/types";
import {
  freshCombat,
  startAction,
  restoreHealth,
  grantStatus,
  removeEffects,
} from "../../../src/game/combat/index";
import { observeDecisions } from "../../../src/game/random";
import { addBackups, policy, requireBattle, teamRun, victoryReady } from "../../support/game";

const cases: { name: string; seed: number; team: SpeciesId[] }[] = [
  { name: "Armor bursts and status thresholds", seed: 42, team: ["emberback", "mossguard", "prismram"] },
  { name: "retaliation and exact absorption", seed: 1972, team: ["coralcurl", "captoad", "emberback"] },
  { name: "bounce and healing", seed: 1, team: ["glintstride", "ringpalm", "dawncall"] },
  { name: "repeats and control", seed: 123, team: ["chimecricket", "cadenza", "wickwaltz"] },
];

it.each(["heal", "status", "cleanse", "turn"] as const)(
  "honors preview work cancellation before a unit-first %s operation",
  (operation) => {
    const game = teamRun(42, ["mossguard"]);
    const saved = encodeSave(game);
    expect(() =>
      produce(game, (draft) => {
        observeDecisions(
          draft,
          Object.assign(() => 0, {
            step: () => {
              throw new Error("preview budget");
            },
          }),
        );
        const unit = draft.team[0]!;
        if (operation === "heal") restoreHealth(unit, 1, [], false, draft);
        else if (operation === "status") grantStatus(unit, "thorns", 1, [], draft);
        else if (operation === "cleanse") removeEffects(unit, "cleanse", 1, [], draft);
        else startAction(unit, [], draft);
      }),
    ).toThrow("preview budget");
    expect(encodeSave(game)).toBe(saved);
  },
);

it.each(cases)("preserves committed command traces for $name", ({ seed, team }) => {
  let state = produce(teamRun(seed, team), (draft) => {
    draft.talents = TALENTS.map((talent) => talent.id);
    draft.keywordXP = Object.fromEntries(KEYWORDS.map((keyword) => [keyword, 1_000_000]));
    // Preserve the original combined oracle; new Boons have direct regressions.
    draft.boons = BOONS.filter((boon) => !Object.hasOwn(NEW_BOON_EFFECTS, boon.id)).map((boon) => boon.id);
    for (const unit of draft.team) {
      unit.health = Math.max(2, Math.round(unit.health / 2));
      unit.block = 3;
      unit.combat = freshCombat();
      unit.combat.armor = 2;
      unit.combat.burn = 1;
    }
    for (const enemy of draft.battle!.enemies) {
      enemy.combat.armor = 2;
      enemy.combat.thorns = 1;
      enemy.block = 2;
    }
  });
  const trace = [];
  for (let step = 0; step < 20 && state.phase === "battle"; step++) {
    const command = policy(state);
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    const resumed = dispatch(decodeSave(encodeSave(state)), command);
    expect(resumed).toEqual(result);
    // The oracle predates required journey summaries and separate completed receipts.
    // Normalize retired lifecycle data and inactive protection added after the oracle;
    // active protection, live combat and every ordered event must still match.
    const combatOnly = (units: typeof state.team) =>
      units.map(({ combat: _combat, block: _block, ...unit }) => unit);
    const committed = result.state;
    const baselineResult = {
      ...result,
      state: {
        ...committed,
        version: 42,
        journey: null,
        battle: result.state.phase === "battle" ? result.state.battle : null,
        team: result.state.phase === "battle" ? result.state.team : combatOnly(result.state.team),
        reserves: result.state.phase === "battle" ? result.state.reserves : combatOnly(result.state.reserves),
      },
    };
    trace.push({
      command,
      phase: result.state.phase,
      rng: result.state.rng,
      digest: createHash("sha256")
        .update(
          JSON.stringify(baselineResult, (key, value: unknown) => {
            if (key === "puzzleProgress" && Array.isArray(value) && value.length === 0) return undefined;
            if (key === "encoreProgress" && value === 0) return undefined;
            if (
              key === "repeatNext" &&
              value &&
              typeof value === "object" &&
              "player" in value &&
              "enemy" in value &&
              value.player === false &&
              value.enemy === false
            )
              return undefined;
            if (key === "metronomeActor" && value === null) return undefined;
            if (key === "fireThorns" && value === 0) return undefined;
            return key === "negate" && value === false ? undefined : value;
          }),
        )
        .digest("hex"),
    });
    state = result.state;
  }
  expect(trace.length).toBeGreaterThan(0);
  expect(trace).toMatchSnapshot();
});

it("keeps the shared victory checkpoint resumable before its final play", () => {
  const checkpoint = victoryReady(teamRun(42, ["mossguard", "emberback", "prismram"]));
  const resumed = decodeSave(encodeSave(checkpoint));
  expect(resumed).toEqual(checkpoint);
  expect(
    resumed.battle!.enemies.map((enemy) => [enemy.combat.controlled, enemy.combat.controlTurns]),
  ).toEqual([["stun", 1], ...resumed.battle!.enemies.slice(1).map(() => [null, 0])]);
  const command = { type: "play" as const, cardId: checkpoint.battle!.hand[0]!, targetId: "enemy-0" };
  expect(dispatch(resumed, command)).toEqual(dispatch(checkpoint, command));
});

it.each([
  ["pollenmoth-teamGuard", "pollenmoth", "Allies gain 2 Block", "block", 2, 104],
  [
    "cadenza-rousing-refrain",
    "cadenza",
    "Give all allies 20% Dodge until your next turn; Draw 1 card",
    "dodge",
    20,
    190,
  ],
] as const)(
  "preserves automatic recipients, rankings and resume for %s",
  (id, kind, text, effect, amount, score) => {
    const game = requireBattle(
      produce(teamRun(42, [kind, "emberback"]), (draft) => {
        addBackups(draft, {
          id: "backup",
          species: "mossguard",
          health: species("mossguard").health,
          block: 0,
          attacked: false,
          combat: freshCombat(),
        });
        const card = draft.cards.find((card) => card.definitionId === id)!;
        draft.battle!.hand = [card.id];
        draft.battle!.buffer = [];
        draft.battle!.discard = [];
        draft.battle!.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
      }),
    );
    const def = definition(id);
    expect(cardTargeting(def)).toBe("automatic");
    expect(cardText(def)).toBe(text);
    expect(cardKeywords({ definitionId: id })).toEqual([effect]);
    const before = encodeSave(game);
    const choice = rankedBattleChoices(game, false)[0]!;
    expect(choice).toMatchObject({
      command: { type: "play", cardId: game.battle.hand[0]!, autoEndTurn: false },
      score,
    });
    expect(choice.command).not.toHaveProperty("targetId", expect.any(String));
    const result = dispatch(game, choice.command);
    expect(result.accepted).toBe(true);
    expect(dispatch(decodeSave(before), choice.command)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(result.state.reserves).toEqual(game.reserves);
    const grants = result.events.filter((event) =>
      effect === "block"
        ? event.kind === "block" && event.amount > 0
        : event.kind === "status" && event.status === "dodge" && event.outcome === "gain",
    );
    expect(grants.map((event) => [event.targetId, event.amount])).toEqual([
      [game.team[0]!.id, amount],
      [game.team[1]!.id, amount],
    ]);
  },
);

it.each(["pollenmoth-teamGuard", "cadenza-rousing-refrain"])("includes living allied Minions in %s", (id) => {
  const game = requireBattle(structuredClone(teamRun(42, ["memento"])));
  const actor = game.team[0]!;
  summonEcho(game, actor, "player", 6, []);
  summonEcho(game, actor, "player", 6, []);
  game.battle.minions![1]!.health = 0;
  const before = encodeSave(game);
  expect(decodeSave(before)).toEqual(game);
  const def = definition(id);
  const events: GameEvent[] = [];
  executeAbility(game, { side: "player", actor, def, value: def.value }, events, { swap: swapFromCard });
  expect(
    events
      .filter((event) => event.kind === "block" || (event.kind === "status" && event.status === "dodge"))
      .map((event) => [event.targetId, event.amount]),
  ).toEqual([
    [actor.id, def.value],
    [game.battle.minions![0]!.id, def.value],
  ]);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  for (const unit of [actor, ...game.battle.minions!]) startAction(unit, [], game);
  expect([actor, ...game.battle.minions!].map((unit) => unit.combat!.temporaryDodge)).toEqual([0, 0, 0]);
});

it.each(["pollenmoth-teamGuard", "cadenza-rousing-refrain"])(
  "preserves enemy recipients and scaling for %s",
  (id) => {
    const game = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
    const actor = game.battle.enemies[0]!;
    const def = enemyCard(definition(id));
    actor.power = 3;
    game.battle.enemies[2]!.health = 0;
    summonEcho(game, actor, "enemy", 6, []);
    const events: GameEvent[] = [];
    const value = enemyAbilityValue(actor, def);
    expect(enemyCanUse(def)).toBe(true);
    expect(value).toBe(def.effect === "guard" ? 6 : 20);
    executeAbility(game, { side: "enemy", actor, def, value, allyTargetId: actor.id }, events, {
      swap: swapFromCard,
    });
    const grants = events.filter(
      (event) => event.kind === "block" || (event.kind === "status" && event.status === "dodge"),
    );
    expect(grants.map((event) => [event.targetId, event.amount])).toEqual([
      [actor.id, value],
      [game.battle.enemies[1]!.id, value],
      [game.battle.minions![0]!.id, value],
    ]);
    expect(game.team[0]!.block).toBe(0);
    expect(game.team[0]!.combat!.temporaryDodge).toBe(0);
  },
);

it.each(["mossguard-guard", "dunefox-dodge"])("preserves self and chosen-ally boundaries for %s", (id) => {
  const game = requireBattle(structuredClone(teamRun(42, ["mossguard", "dunefox"])));
  const def = definition(id);
  const actor = game.team[def.effect === "guard" ? 0 : 1]!;
  const other = game.team.find((unit) => unit !== actor)!;
  expect(cardTargeting(def)).toBe("self");
  expect(playTargetError(game, def, actor.id, other.id)).toBe("This ability targets its acting creature.");
  const events: GameEvent[] = [];
  executeAbility(game, { side: "player", actor, def, value: def.value }, events, { swap: swapFromCard });
  expect(
    events
      .filter((event) => event.kind === "block" || event.kind === "status")
      .map((event) => event.targetId),
  ).toEqual([actor.id]);
  if (def.effect === "guard") {
    const chosen = { ...def, target: undefined };
    expect(cardTargeting(chosen)).toBe("ally");
    expect(playTargetError(game, chosen, actor.id)).toBe("Choose a living ally.");
    expect(playTargetError(game, chosen, actor.id, other.id)).toBeNull();
    const targeted: GameEvent[] = [];
    executeAbility(
      game,
      { side: "player", actor, def: chosen, value: def.value, allyTargetId: other.id },
      targeted,
      { swap: swapFromCard },
    );
    expect(targeted.filter((event) => event.kind === "block").map((event) => event.targetId)).toEqual([
      other.id,
    ]);
  }
});

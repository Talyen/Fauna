import { produce } from "immer";
import { expect, it } from "vitest";
import { createBattleActor } from "../../../src/application/battle-actor";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { battleCardCapacity } from "../../../src/game/card-zones";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { dispatch, previewCard } from "../../../src/game/engine";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { setBattleCards } from "../../support/cards";
import { requireBattle, run, teamRun } from "../../support/game";

it.each([true, false])(
  "Dodge follow-ups require survival after a Purge reaction (knockout: %s)",
  (knockout) => {
    const state = requireBattle(structuredClone(run()));
    const ally = state.team[0]!;
    const enemy = state.battle.enemies[0]!;
    ally.health = 1;
    ally.block = 0;
    ally.combat = { ...freshCombat(), deathDoorUsed: knockout, poison: 5 };
    enemy.combat = { ...freshCombat(), armor: 1 };
    state.boons = ["fern-fencing-foil"];
    state.talents = ["dodge.tailwind", "dodge.clean-getaway", "nature.windstep"];
    state.battle.hand = [];
    state.battle.buffer = [];
    state.battle.discard = [];
    state.battle.draw = state.cards.map((card) => card.id);
    observeDecisions(state, () => 0.99);

    hit(state, enemy, ally, 1, "water", [], { origin: "ability", blindMiss: true });

    expect(ally.health).toBe(knockout ? 0 : 1);
    expect(state.battle.hand).toHaveLength(knockout ? 0 : 1);
    expect(ally.combat.poison).toBe(knockout ? 5 : 4);
    expect(ally.combat.freeNature).toBe(!knockout);
    expect(state.battleXP.dodge).toBe(1);
  },
);

it("Miracle Megaphone cancels the remaining shared Cleanse when its caster falls", () => {
  const before = produce(requireBattle(teamRun(42, ["almanelle", "mossguard", "prismram"])), (draft) => {
    const actor = draft.team[0]!;
    actor.health = 1;
    actor.combat = { ...freshCombat(), deathDoorUsed: true };
    draft.boons = ["miracle-megaphone", "orbit-armillary", "story-puzzle-cube"];
    draft.battle.puzzleProgress = ["burn", "bleed"];
    draft.battle.enemies[0]!.combat = { ...freshCombat(), armor: 1 };
    for (const ally of draft.team) {
      ally.combat!.poison = 1;
      ally.combat!.statusSources.poison = draft.battle.enemies[0]!.id;
    }
    const card = draft.cards.find((entry) => entry.definitionId === "almanelle-spring-current")!;
    setBattleCards(draft, [card.id]);
    draft.rng = 42;
  });
  const cardId = before.battle.hand[0]!;
  const targetId = before.battle.enemies[1]!.id;
  const result = dispatch(before, { type: "play", cardId, targetId, autoEndTurn: false });

  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.health).toBe(0);
  expect(result.state.team.map((ally) => ally.combat!.poison)).toEqual([0, 1, 1]);
  expect(previewCard(before, cardId, targetId)).toEqual(result);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("shared buildup removal also stops when returning the first effect knocks out its owner", () => {
  const state = requireBattle(structuredClone(run()));
  const actor = state.team[0]!;
  actor.health = 1;
  actor.combat = { ...freshCombat(), deathDoorUsed: true };
  state.boons = ["miracle-megaphone", "orbit-armillary", "story-puzzle-cube"];
  state.battle.puzzleProgress = ["burn", "bleed"];
  state.battle.enemies[0]!.combat = { ...freshCombat(), armor: 1 };
  for (const ally of state.team) {
    ally.combat!.freeze = 1;
    ally.combat!.statusSources.freeze = state.battle.enemies[0]!.id;
  }
  observeDecisions(state, () => 0.99);
  resolveCombat("removeControlBuildup", state, actor, "freeze", []);
  expect(actor.health).toBe(0);
  expect(state.team.map((ally) => ally.combat!.freeze)).toEqual([0, 1, 1]);
});

it("Auto-play uses a full-health ally's overflow heal to protect another ally at Death's Door", () => {
  const before = produce(requireBattle(teamRun(42, ["dulcera", "mossguard", "prismram"])), (draft) => {
    draft.boons = ["last-threshold"];
    const recipient = draft.team[1]!;
    recipient.health = 1;
    recipient.combat = { ...freshCombat(), deathDoorUsed: true, grace: 1 };
    const card = draft.cards.find((entry) => entry.definitionId === "dulcera-chapel-light")!;
    setBattleCards(draft, [card.id]);
  });
  const choice = rankedBattleChoices(before, false)[0]!;
  expect(choice.command).toMatchObject({ type: "play", cardId: before.battle.hand[0] });
  const result = dispatch(before, choice.command);
  expect(result.accepted).toBe(true);
  expect(result.state.team[1]!.health).toBe(4);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  const noOverflow = produce(before, (draft) => {
    draft.boons = [];
  });
  expect(rankedBattleChoices(noOverflow, false)).toEqual([]);
});

it.each([
  ["orifable", "orifable-createFood"],
  ["memento", "memento-treasury-echo"],
] as const)(
  "Auto-play stops valuing %s's generated cards when their identity space is exhausted",
  (kind, definitionId) => {
    const before = produce(requireBattle(teamRun(42, [kind])), (draft) => {
      const card = draft.cards.find((entry) => entry.definitionId === definitionId)!;
      setBattleCards(draft, [card.id]);
    });
    expect(rankedBattleChoices(before, false)[0]?.command.type).toBe("play");
    const exhausted = produce(before, (draft) => {
      draft.battle.copySerial = Number.MAX_SAFE_INTEGER;
    });
    expect(battleCardCapacity(exhausted)).toBe(0);
    expect(rankedBattleChoices(exhausted, false)).toEqual([]);
    const result = dispatch(exhausted, {
      type: "play",
      cardId: exhausted.battle.hand[0]!,
      autoEndTurn: false,
    });
    expect(result.state.cards).toHaveLength(before.cards.length);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    const lastIdentity = produce(before, (draft) => {
      draft.battle.copySerial = Number.MAX_SAFE_INTEGER - 1;
    });
    expect(battleCardCapacity(lastIdentity)).toBe(1);
  },
);

it("Auto-play cycle detection distinguishes the FIFO order of waiting cards across resume", () => {
  const before = produce(requireBattle(run()), (draft) => {
    draft.battle.hand = draft.cards.slice(0, 6).map((card) => card.id);
    draft.battle.buffer = draft.cards.slice(6, 8).map((card) => card.id);
    draft.battle.draw = draft.cards.slice(8).map((card) => card.id);
    draft.battle.discard = [];
  });
  const actor = createBattleActor();
  const first = actor.choose(before, false);
  expect(first.command.type).toBe("play");
  const reordered = decodeSave(
    encodeSave(
      produce(before, (draft) => {
        draft.revision++;
        draft.battle.buffer.reverse();
      }),
    ),
  );
  expect(actor.choose(reordered, false)).toEqual(first);
  const repeated = decodeSave(
    encodeSave(
      produce(reordered, (draft) => {
        draft.revision++;
      }),
    ),
  );
  expect(actor.choose(repeated, false).command).not.toEqual(first.command);
});

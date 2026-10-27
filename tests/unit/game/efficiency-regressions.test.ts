import { expect, it, vi } from "vitest";
import { cardActor, drawableOwnerIds } from "../../../src/game/card-actors";
import {
  discardDrawCards,
  drawHasAnotherCard,
  journeyReturnHasDraw,
  recoverBrokenGuard,
} from "../../../src/game/card-zones";
import { chooseBattleCommand } from "../../../src/application/battle-policy";
import { battleBenefitFacts } from "../../../src/application/battle-benefits";
import * as engine from "../../../src/game/engine";
import { projectPlay } from "../../../src/game/preview";
import { cardKeywords, passiveAmount } from "../../../src/game/progression";
import { SPECIES } from "../../../src/game/content";
import { generateEncounterPack } from "../../../src/game/encounters";
import { returnDodgedCard } from "../../../src/game/combat/card-modifiers";
import { observeDecisions } from "../../../src/game/random";
import { requireBattle, teamRun } from "../../support/game";

it("keeps cached card keywords isolated from callers", () => {
  const card = { definitionId: "emberback-attack" };
  const keywords = cardKeywords(card);
  const expected = [...keywords];
  keywords.splice(0);
  expect(cardKeywords(card)).toEqual(expected);
});

it("keeps passive amounts tied to the current complete tier", () => {
  const state = structuredClone(teamRun(42, ["prismram"]));
  for (const entry of SPECIES) {
    for (let rank = 5; rank >= 0; rank--) {
      state.discovery.recruited[entry.id] = rank + 1;
      const effects = entry.passiveTiers[rank]!.effects;
      for (const { kind } of effects) {
        const expected = effects.reduce((sum, effect) => sum + (effect.kind === kind ? effect.amount : 0), 0);
        expect(passiveAmount(state, entry.id, kind)).toBe(expected);
        expect(passiveAmount(state, entry.id, kind)).toBe(expected);
      }
    }
  }
});

it("refreshes battlefield facts between decisions and keeps replacement ties in ID order", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  expect(battleBenefitFacts(state).livingAllies()).toHaveLength(2);
  state.team[0]!.health = 0;
  expect(battleBenefitFacts(state).livingAllies()).toHaveLength(1);
  state.reserves = [
    { ...state.team[1]!, id: "z-backup" },
    { ...state.team[1]!, id: "a-backup" },
  ];
  expect(chooseBattleCommand(state, false)).toMatchObject({ type: "swap", reserve: "a-backup" });
});

it("retains discard order, eligible owners and recovery events", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["oathara", "mossguard", "prismram"])));
  const [guide, fallen, living] = state.team;
  fallen!.health = 0;
  const fallenCard = state.cards.find((card) => card.ownerId === fallen!.id)!;
  const livingCards = state.cards.filter((card) => card.ownerId === living!.id).slice(0, 2);
  state.battle.discard = [livingCards[1]!.id, fallenCard.id, livingCards[0]!.id];
  state.battle.draw = [];
  state.battle.hand = [];
  state.battle.buffer = [];
  state.boons = ["cloud-cup-and-ball", "dune-shuttle"];
  expect(cardActor(state, fallenCard)?.id).toBe(guide!.id);
  expect(drawableOwnerIds(state).has(fallen!.id)).toBe(true);
  expect(discardDrawCards(state, guide!.id).map((card) => card.id)).toEqual([
    livingCards[1]!.id,
    livingCards[0]!.id,
  ]);
  expect(drawHasAnotherCard(state, fallenCard, { kind: "draw", amount: 1 })).toBe(true);
  observeDecisions(state, () => 0.99);
  const events: Parameters<typeof recoverBrokenGuard>[2] = [];
  recoverBrokenGuard(state, living!.id, events);
  expect(state.battle.hand).toEqual([livingCards[0]!.id]);
  expect(state.battle.discard).toEqual([livingCards[1]!.id, fallenCard.id]);
  expect(events.at(-1)).toMatchObject({ kind: "action", actorId: living!.id });
});

it("preserves singleton decisions and the order of every projected alternative", () => {
  const state = requireBattle(teamRun(42, ["mossguard", "prismram"]));
  const seen: number[][] = [];
  const spy = vi.spyOn(engine, "previewCard").mockImplementation((game, _card, _target, decide) => {
    const values = [
      decide!({ kind: "index", size: 1 }),
      decide!({ kind: "chance", threshold: 0 }),
      decide!({ kind: "index", size: 3 }),
      decide!({ kind: "chance", threshold: 0.25 }),
    ];
    seen.push(values);
    return { accepted: true, state: game, events: [] };
  });
  try {
    const projection = projectPlay(state, "card");
    expect(projection).toMatchObject({ kind: "complete", replays: 10 });
    expect(seen).toEqual([
      [0.5, 0, 5 / 6, 0.25],
      [0.5, 0, 5 / 6, 0],
      [0.5, 0, 0.5, 0.25],
      [0.5, 0, 0.5, 0],
      [0.5, 0, 1 / 6, 0.25],
      [0.5, 0, 1 / 6, 0],
    ]);
  } finally {
    spy.mockRestore();
  }
});

it("preserves saved encounter order and only rolls for roster conflicts", () => {
  const state = structuredClone(teamRun(42, ["mossguard"]));
  state.encounter = 2;
  const decisions: unknown[] = [];
  observeDecisions(state, (decision) => {
    decisions.push(decision);
    return 0;
  });
  expect(generateEncounterPack(state, ["prismram", "emberback", "pollenmoth"])).toEqual([
    "prismram",
    "emberback",
    "pollenmoth",
  ]);
  expect(decisions).toEqual([]);
  const pack = generateEncounterPack(state, ["mossguard", "prismram", "mossguard"]);
  expect(pack[1]).toBe("prismram");
  expect(pack[0]).not.toBe("mossguard");
  expect(pack[2]).toBe(pack[0]);
  expect(decisions).toEqual([undefined, undefined]);
});

it("keeps the copy draw fallback when both draw piles are empty", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["rookhaven", "mossguard"])));
  const card = state.cards.find((entry) => entry.ownerId === state.team[1]!.id)!;
  state.battle.draw = [];
  state.battle.discard = [];
  state.boons = ["journey-loom"];
  expect(journeyReturnHasDraw(state, card.ownerId)).toBe(false);
  expect(drawHasAnotherCard(state, card, { kind: "draw", amount: 1 })).toBe(true);
  state.team[0]!.health = 0;
  expect(drawHasAnotherCard(state, card, { kind: "draw", amount: 1 })).toBe(false);
});

it("returns a dodged card only for enemy dodges after the current ability started", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  state.boons = ["dream-yo-yo"];
  const card = state.cards.find((entry) => entry.ownerId === state.team[0]!.id)!;
  state.battle.hand = [];
  state.battle.buffer = [];
  state.battle.discard = [card.id];
  const events: Parameters<typeof returnDodgedCard>[2] = [
    {
      kind: "status",
      targetId: state.battle.enemies[0]!.id,
      status: "dodge",
      outcome: "dodge",
      text: "Dodge",
    },
    { kind: "status", targetId: state.team[0]!.id, status: "dodge", outcome: "dodge", text: "Dodge" },
  ];
  returnDodgedCard(state, card, events, 1);
  expect(state.battle.discard).toEqual([card.id]);
  events.push({
    kind: "status",
    targetId: state.battle.enemies[0]!.id,
    status: "dodge",
    outcome: "dodge",
    text: "Dodge",
  });
  returnDodgedCard(state, card, events, 1);
  expect(state.battle.hand).toEqual([card.id]);
});

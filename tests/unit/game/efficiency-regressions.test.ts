import { expect, it, vi } from "vitest";
import { cardActor, drawableOwnerIds } from "../../../src/game/card-actors";
import {
  discardDrawCards,
  drawKeyword,
  drawHasAnotherCard,
  journeyReturnHasDraw,
  recoverBrokenGuard,
} from "../../../src/game/card-zones";
import { chooseBattleCommand, rankedBattleChoices } from "../../../src/application/battle-policy";
import { createBattleActor } from "../../../src/application/battle-actor";
import { battleBenefitFacts } from "../../../src/application/battle-benefits";
import * as engine from "../../../src/game/engine";
import { projectPlay } from "../../../src/game/preview";
import { cardKeywords, passiveAmount } from "../../../src/game/progression";
import { definition, SPECIES } from "../../../src/game/content";
import { capabilities, offenseValue } from "../../../src/application/team-policy";
import { availablePlays, chosenRecipients, playTargetError } from "../../../src/game/play-queries";
import { battlefield, isDepartedMinion } from "../../../src/game/battlefield";
import { summonEcho } from "../../../src/game/combat/legendary";
import { generateEncounterPack } from "../../../src/game/encounters";
import { returnDodgedCard } from "../../../src/game/combat/card-modifiers";
import { observeDecisions } from "../../../src/game/random";
import { requireBattle, teamRun } from "../../support/game";
import { matchesPermanentKit, permanentKit } from "../../../src/game/card-kit";
import { rebuildCards } from "../../../src/game/team";
import { createMessageReader } from "../../../src/ui/shared/localization/messages";

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

it("keeps authored policy caches private and refreshes the current passive tier", () => {
  const state = structuredClone(teamRun(42, ["memento"]));
  state.discovery.recruited.memento = 1;
  const initial = capabilities(state, ["memento"]);
  const initialValues = [...initial];
  const initialOffense = offenseValue(state, "memento");
  initial.clear();
  expect([...capabilities(state, ["memento"])]).toEqual(initialValues);
  state.discovery.recruited.memento = 6;
  expect(offenseValue(state, "memento")).not.toBe(initialOffense);
  state.discovery.recruited.memento = 1;
  expect(offenseValue(state, "memento")).toBe(initialOffense);
});

it("keeps available targets current across decisions and in battlefield order", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const card = state.cards.find((entry) => entry.definitionId === "prismram-attack")!;
  const copy = { ...card, id: "copy-test" };
  state.cards.push(copy);
  state.battle.hand = [card.id, copy.id];
  const targets = chosenRecipients(state, definition(card.definitionId));
  const plays = availablePlays(state, false);
  expect(plays.map((play) => play.commands.map((command) => command.targetId))).toEqual([
    targets.map((unit) => unit.id),
    targets.map((unit) => unit.id),
  ]);
  for (const target of targets)
    expect(playTargetError(state, definition(card.definitionId), card.ownerId!, target.id)).toBeNull();
  targets[0]!.health = 0;
  expect(playTargetError(state, definition(card.definitionId), card.ownerId!, targets[0]!.id)).not.toBeNull();
  expect(availablePlays(state, false)[0]!.commands.map((command) => command.targetId)).toEqual(
    targets.slice(1).map((unit) => unit.id),
  );
});

it("keeps summons active exactly while they remain on the owner's battlefield", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["memento", "mossguard"])));
  const owner = state.team[0]!;
  summonEcho(state, owner, "player", 6, []);
  const echo = state.battle.minions![0]!;
  for (const health of [owner.health, 0, 1]) {
    owner.health = health;
    expect(isDepartedMinion(state, echo)).toBe(
      !battlefield(state, "player").some((unit) => unit.id === echo.id),
    );
  }
  state.battle.minions = [];
  expect(isDepartedMinion(state, echo)).toBe(true);
});

it("promotes buffered cards before an empty keyword draw", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  const card = state.cards[0]!;
  state.battle.draw = [];
  state.battle.discard = [];
  state.battle.hand = [];
  state.battle.buffer = [card.id];
  const rng = state.rng;
  drawKeyword(state, "light");
  expect(state.battle.hand).toEqual([card.id]);
  expect(state.battle.buffer).toEqual([]);
  expect(state.rng).toEqual(rng);
});

it("preserves the automated actor's ranked choice and repeated reads", () => {
  const state = requireBattle(teamRun(42, ["mossguard", "prismram"]));
  const actor = createBattleActor();
  const expected = rankedBattleChoices(state, false)[0]!;
  expect(actor.choose(state, false)).toEqual(expected);
  expect(actor.choose(state, false)).toEqual(expected);
});

it("validates complete kits as multisets, including repeated legendary cards", () => {
  for (const kind of ["mossguard", "memento"] as const) {
    const ids = permanentKit(kind).map(({ definition }) => definition.id);
    expect(matchesPermanentKit(kind, [...ids].reverse())).toBe(true);
    expect(matchesPermanentKit(kind, ids.slice(1))).toBe(false);
    expect(matchesPermanentKit(kind, [...ids.slice(1), "unknown"])).toBe(false);
    const extra = [...ids];
    extra[0] = extra.at(-1)!;
    if (extra[0] !== ids[0]) expect(matchesPermanentKit(kind, extra)).toBe(false);
  }
});

it("keeps the first matching card and its progress when rebuilding a lineup", () => {
  const state = structuredClone(teamRun(42, ["mossguard"]));
  const card = state.cards[0]!;
  state.cards = [
    { ...card, ownerId: "different" },
    { ...card, level: 2 },
    { ...card, level: 4 },
  ];
  rebuildCards(state);
  expect(state.cards.find((entry) => entry.id === card.id)?.level).toBe(2);
});

it("formats translated and fallback values with the correct locale across repeated reads", () => {
  const catalog = {
    value: { source: "Count {{n}}", text: "Nombre {{n}}" },
    plain: { source: "Ready", text: "Prêt" },
    broken: { source: "Ready", text: "Prêt }}" },
  };
  const reader = createMessageReader("fr", catalog);
  const french = new Intl.NumberFormat("fr").format(1234);
  const english = new Intl.NumberFormat("en").format(1234);
  for (let i = 0; i < 2; i++) {
    expect(reader.message("value", "Count {{n}}", { n: 1234 })).toBe(`Nombre ${french}`);
    expect(reader.message("value", "Total {{n}}", { n: 1234 })).toBe(`Total ${english}`);
    expect(reader.message("plain", "Ready")).toBe("Prêt");
    expect(reader.message("broken", "Ready")).toBe("Ready");
  }
});

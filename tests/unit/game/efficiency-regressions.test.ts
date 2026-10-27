import { expect, it, vi } from "vitest";
import { modifiedDamage } from "../../../src/game/combat/damage-values";
import { applyHarmfulStatus, startAction } from "../../../src/game/combat/index";
import { sharedDodgeChance } from "../../../src/game/combat/state";
import { cardCost } from "../../../src/game/ability-rules";
import { cardActor, drawableOwnerIds } from "../../../src/game/card-actors";
import {
  discardDrawCards,
  hasDiscardDrawCard,
  drawKeyword,
  drawOwner,
  draw,
  journeyReturn,
  drawHasAnotherCard,
  journeyReturnHasDraw,
  recoverBrokenGuard,
  redrawHand,
} from "../../../src/game/card-zones";
import { chooseBattleCommand, rankedBattleChoices } from "../../../src/application/battle-policy";
import { createBattleActor } from "../../../src/application/battle-actor";
import { battleBenefitFacts } from "../../../src/application/battle-benefits";
import * as engine from "../../../src/game/engine";
import { projectPlay } from "../../../src/game/preview";
import { cardKeywords, passiveAmount } from "../../../src/game/progression";
import { definition, SPECIES } from "../../../src/game/content";
import { capabilities, offenseValue } from "../../../src/application/team-policy";
import {
  availablePlays,
  chosenRecipients,
  inspectCardPlay,
  playTargetError,
} from "../../../src/game/play-queries";
import { battlefield, cleanseTargets, healingAllies, isDepartedMinion } from "../../../src/game/battlefield";
import { summonEcho } from "../../../src/game/combat/legendary";
import { generateEncounterPack } from "../../../src/game/encounters";
import { returnDodgedCard } from "../../../src/game/combat/card-modifiers";
import { observeDecisions } from "../../../src/game/random";
import { requireBattle, teamRun } from "../../support/game";
import { matchesPermanentKit, permanentKit } from "../../../src/game/card-kit";
import { rebuildCards } from "../../../src/game/team";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { snapshot } from "../../../src/application/cloud-snapshots";
import saveFormat from "../../../src/game/save-format.json" with { type: "json" };
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

it("refreshes ally recovery eligibility between play queries", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["wisterelle", "mossguard"])));
  const recovery = state.cards.find((card) => card.definitionId === "wisterelle-left-luggage")!;
  const copy = { ...recovery, id: "copy-recovery" };
  const ally = state.cards.find((card) => card.ownerId === state.team[1]!.id)!;
  state.cards.push(copy);
  state.battle.hand = [recovery.id, copy.id];
  state.battle.discard = [ally.id];
  expect(availablePlays(state).map((play) => play.card.id)).toEqual([recovery.id, copy.id]);
  expect(inspectCardPlay(state, recovery.id).allowed).toBe(true);
  state.battle.discard = [];
  expect(availablePlays(state)).toEqual([]);
  expect(inspectCardPlay(state, recovery.id).allowed).toBe(false);
  expect(inspectCardPlay(state, ally.id)).toMatchObject({
    allowed: false,
    reason: "That card is not in your hand.",
  });
});

it("preserves owner-specific draw order", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const own = state.cards.filter((card) => card.ownerId === state.team[0]!.id).slice(0, 2);
  const other = state.cards.find((card) => card.ownerId === state.team[1]!.id)!;
  state.battle.draw = [own[0]!.id, other.id, own[1]!.id];
  state.battle.discard = [];
  state.battle.hand = [];
  state.battle.buffer = [];
  expect(drawOwner(state, state.team[0]!.id, [])).toBe(true);
  expect(state.battle.hand).toEqual([own[1]!.id]);
  expect(state.battle.draw).toEqual([own[0]!.id, other.id]);
});

it("validates card ownership when resuming a battle", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  expect(decodeSave(encodeSave(state))).toEqual(state);
  const card = state.cards.find((entry) => entry.ownerId === state.team[0]!.id)!;
  card.ownerId = state.team[1]!.id;
  expect(() => decodeSave(encodeSave(state))).toThrow("Save contains inconsistent game data.");
});

it("matches discard eligibility and refreshes policy facts for each decision", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["wisterelle", "mossguard", "prismram"])));
  const [owner, ally, fallen] = state.team;
  fallen!.health = 0;
  const own = state.cards.find((card) => card.ownerId === owner!.id)!;
  const living = state.cards.find((card) => card.ownerId === ally!.id)!;
  const knockedOut = state.cards.find((card) => card.ownerId === fallen!.id)!;
  const shared = { ...living, id: "shared", ownerId: null };
  state.cards.push(shared);
  for (const discard of [
    [],
    [own.id],
    [living.id],
    [knockedOut.id],
    [shared.id],
    [knockedOut.id, living.id],
    [living.id, own.id],
  ]) {
    state.battle.discard = discard;
    const facts = battleBenefitFacts(state);
    for (const actor of [undefined, owner!.id, ally!.id]) {
      const expected = discardDrawCards(state, actor).length > 0;
      expect(hasDiscardDrawCard(state, actor)).toBe(expected);
      expect(facts.recoverable(actor)).toBe(expected);
      expect(facts.recoverable(actor)).toBe(expected);
    }
  }
  state.battle.discard = [];
  expect(battleBenefitFacts(state).recoverable(owner!.id)).toBe(false);
  state.battle.discard = [living.id];
  expect(battleBenefitFacts(state).recoverable(owner!.id)).toBe(true);
});

it("keeps free card grants and shared food costs independent of card keyword copies", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["reedstag"])));
  const card = state.cards.find((entry) => cardKeywords(entry).includes("nature"))!;
  expect(cardCost(card, state)).toBe(1);
  state.team[0]!.combat!.freeNature = true;
  expect(cardCost(card, state)).toBe(0);
  const food = { definitionId: "food-apple", ownerId: null };
  expect(cardCost(food, state)).toBe(1);
  state.boons.push("blossom-cake-stand");
  expect(cardCost(food, state)).toBe(0);
});

it("keeps passive protection tied to the living deployed battlefield", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["shadebrim", "dunefox", "mossguard"])));
  const [shadebrim, dunefox, ally] = state.team;
  const backup = { ...ally!, id: "backup", combat: structuredClone(ally!.combat) };
  state.reserves.push(backup);
  const source = state.battle.enemies[0]!;
  const burn = (target: typeof ally) =>
    modifiedDamage(state, source, target!, 100, "burn", { origin: "periodic" }, false);
  expect(burn(ally)).toBe(90);
  expect(burn(backup)).toBe(100);
  expect(sharedDodgeChance(state, ally!)).toBe(0.75);
  shadebrim!.health = 0;
  dunefox!.health = 0;
  expect(burn(ally)).toBe(100);
  expect(sharedDodgeChance(state, ally!)).toBe(0);
});

it("reuses the first fallen Echo and restores living Echoes in their original order", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["memento", "mossguard"])));
  const owner = state.team[0]!;
  summonEcho(state, owner, "player", 6, []);
  summonEcho(state, owner, "player", 6, []);
  const [first, second] = state.battle.minions!;
  first!.health = 0;
  const events: Parameters<typeof summonEcho>[4] = [];
  summonEcho(state, owner, "player", 8, events);
  expect(state.battle.minions!.map((unit) => unit.id)).toEqual([first!.id, second!.id]);
  expect(state.battle.minions![0]!.health).toBe(8);
  expect(events[0]).toMatchObject({ kind: "action", targetId: first!.id });
  state.battle.minions![0]!.health = 1;
  second!.health = 1;
  const healing: Parameters<typeof summonEcho>[4] = [];
  summonEcho(state, owner, "player", 6, healing);
  expect(healing.filter((event) => event.kind === "heal").map((event) => event.targetId)).toEqual([
    first!.id,
    second!.id,
  ]);
});

it("preserves buffer promotion and RNG when draw piles are empty", () => {
  for (const method of ["draw", "owner", "journey"] as const) {
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
    const card = state.cards[0]!;
    state.battle.draw = [];
    state.battle.discard = [];
    state.battle.hand = [];
    state.battle.buffer = [card.id];
    state.boons = ["journey-loom"];
    const rng = state.rng;
    const events: Parameters<typeof draw>[2] = [];
    if (method === "draw") expect(draw(state, 1, events)).toBe(0);
    else if (method === "owner") expect(drawOwner(state, card.ownerId!, events)).toBe(false);
    else journeyReturn(state, card.ownerId, events);
    expect(state.battle.hand).toEqual([card.id]);
    expect(state.battle.buffer).toEqual([]);
    expect(state.rng).toEqual(rng);
    expect(events).toEqual([]);
  }
});

it("keeps healing and expanded Cleanse targets in battlefield and backup order", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram", "emberback"])));
  const [first, fallen, last] = state.team;
  fallen!.health = 0;
  const backup = { ...last!, id: "backup", combat: structuredClone(last!.combat) };
  state.reserves = [backup];
  state.boons = ["camp-hammock", "miracle-megaphone"];
  expect(healingAllies(state).map((unit) => unit.id)).toEqual([first!.id, last!.id, backup.id]);
  expect(cleanseTargets(state, last!).map((unit) => unit.id)).toEqual([last!.id, first!.id]);
  expect(state.team.map((unit) => unit.id)).toEqual([first!.id, fallen!.id, last!.id]);
});

it("counts multibyte and unpaired surrogate text at the save size boundary", () => {
  const state = teamRun(42, ["mossguard"]);
  const raw = `{"ignored":"é😀\ud800",${encodeSave(state).slice(1)}`;
  const exact = raw.padEnd(raw.length + saveFormat.maxBytes - Buffer.byteLength(raw));
  expect(decodeSave(exact)).toEqual(state);
  expect(() => decodeSave(exact + " ")).toThrow("Save exceeds the supported size.");
});

it("keeps direct cloud heads and the earliest unique ancestry at the history limit", async () => {
  const payload = encodeSave(teamRun(42, ["mossguard"]));
  const identity = {
    available: true,
    device: "a".repeat(32),
    profile: "b".repeat(32),
    importAvailable: false,
  };
  const id = (n: number) => n.toString(16).padStart(64, "0");
  const parent = await snapshot(payload, identity, 1);
  const first = { ...parent, id: id(100), ancestors: Array.from({ length: 64 }, (_, index) => id(index)) };
  const second = { ...parent, id: id(101), ancestors: [id(50), id(102)] };
  const child = await snapshot(payload, identity, 2, [first, second]);
  expect(child.ancestors).toEqual([id(100), id(101), ...Array.from({ length: 62 }, (_, index) => id(index))]);
});

it("heals Tidal Regeneration only on its deployed creature's alternating turns", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["neradora", "mossguard"])));
  const [tide, other] = state.team;
  tide!.health = 10;
  state.battle.turn = 1;
  startAction(tide!, [], state);
  expect(tide!.health).toBe(11);
  state.battle.turn = 2;
  startAction(tide!, [], state);
  expect(tide!.health).toBe(11);
  state.team = [other!];
  state.reserves = [tide!];
  state.battle.turn = 3;
  startAction(tide!, [], state);
  expect(tide!.health).toBe(11);
});

it("preserves reflected status targeting and random decisions", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  const target = state.team[0]!;
  const source = state.battle.enemies[0]!;
  const decisions: unknown[] = [];
  observeDecisions(state, (decision) => {
    decisions.push(decision);
    return 0;
  });
  const events: Parameters<typeof applyHarmfulStatus>[5] = [];
  applyHarmfulStatus(state, source, target, 2, "poison", events);
  expect(target.combat!.poison).toBe(2);
  expect(decisions).toEqual([]);
  target.combat!.reflect = true;
  applyHarmfulStatus(state, source, target, 2, "poison", events);
  expect(target.combat!.poison).toBe(2);
  expect(source.combat.poison).toBe(2);
  expect(decisions).toEqual([{ kind: "index", size: state.battle.enemies.length }]);
});

it("keeps promotion, pile order and randomness when draw eligibility is empty", () => {
  for (const method of ["owner", "keyword", "journey"] as const) {
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
    const card = state.cards[0]!;
    state.battle.draw = [card.id];
    state.battle.discard = [];
    state.battle.hand = [];
    state.battle.buffer = [state.cards[1]!.id];
    state.boons = ["journey-loom"];
    const rng = state.rng;
    const events: Parameters<typeof draw>[2] = [];
    if (method === "owner") expect(drawOwner(state, "absent", events)).toBe(false);
    else if (method === "keyword") drawKeyword(state, "light", events);
    else journeyReturn(state, card.ownerId, events);
    expect(state.battle.hand).toEqual([state.cards[1]!.id]);
    expect(state.battle.draw).toEqual([card.id]);
    expect(state.rng).toBe(rng);
    expect(events).toEqual([]);
  }
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  state.battle.hand = [];
  const before = structuredClone(state.battle);
  const rng = state.rng;
  redrawHand(state, []);
  expect(state.battle).toEqual(before);
  expect(state.rng).toBe(rng);
});

it("rejects duplicate and missing cards in resumed battle zones", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  expect(decodeSave(encodeSave(state))).toEqual(state);
  const zones = [state.battle.draw, state.battle.hand, state.battle.buffer, state.battle.discard];
  const occupied = zones.filter((zone) => zone.length > 0);
  const id = occupied[0]![0]!;
  occupied[0]!.splice(0, 1);
  expect(() => decodeSave(encodeSave(state))).toThrow("Save contains inconsistent game data.");
  occupied[0]!.push(id, id);
  expect(() => decodeSave(encodeSave(state))).toThrow("Save contains inconsistent game data.");
});

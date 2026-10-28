import { grantStatus } from "../../../src/game/combat/index";
import { recruitLineup, swapFromCard } from "../../../src/game/team";
import { enemyReflectionRecipients } from "../../../src/game/battlefield";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { freshCombat } from "../../../src/game/combat/state";
import { enemyCardValue, chooseEnemyCard } from "../../../src/game/combat/enemy-policy";
import { swapBackup } from "../../../src/game/team";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { offerBoons, rosterBoonKeywords } from "../../../src/game/boon-offers";
import { BOON_KEYWORDS } from "../../../src/game/content/boon-keywords";
import { boonRule } from "../../../src/game/rules/boons";
import { scoopBonus } from "../../../src/game/combat/healing-values";
import { harmfulStatuses } from "../../../src/game/combat/state";
import { passiveCardBonus } from "../../../src/game/ability-rules";
import { CARDS } from "../../../src/game/content";
import { roll } from "../../../src/game/random";
import { expect, it, vi } from "vitest";
import { modifiedDamage } from "../../../src/game/combat/damage-values";
import { applyHarmfulStatus, removeEffects, startAction } from "../../../src/game/combat/index";
import { sharedDodgeChance } from "../../../src/game/combat/state";
import { actionValue, cardCost, enemyAbilityValue } from "../../../src/game/ability-rules";
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
import {
  abilityKeywords,
  availablePoints,
  canBuyTalent,
  cardKeywords,
  passiveAmount,
  starterOfferPool,
  talentPoints,
  validTalentSelection,
} from "../../../src/game/progression";
import { definitionKeywords } from "../../../src/game/keywords";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { packetPolicy, packetPolicyView, type DamagePacket } from "../../../src/game/combat/policy";
import { abilityExtras, scalePower } from "../../../src/game/combat/ability-values";
import { abilityRule } from "../../../src/game/rules/abilities";
import { supplementalRule } from "../../../src/game/rules/supplemental";
import { selectCombatCue } from "../../../src/ui/audio/combat-audio";
import { feedbackFrames } from "../../../src/ui/battle/combat-feedback-model";
import type { GameEvent } from "../../../src/game/types";
import { BOONS, definition, findBoon, speciesCards, SPECIES, TALENTS } from "../../../src/game/content";
import { capabilities, offenseValue } from "../../../src/application/team-policy";
import {
  availablePlays,
  hasAvailablePlay,
  chosenRecipients,
  inspectCardPlay,
  playTargetError,
} from "../../../src/game/play-queries";
import { battlefield, cleanseTargets, healingAllies, isDepartedMinion } from "../../../src/game/battlefield";
import { bossDeck, summonEcho } from "../../../src/game/combat/legendary";
import { generateEncounterPack } from "../../../src/game/encounters";
import { returnDodgedCard } from "../../../src/game/combat/card-modifiers";
import { observeDecisions, shuffle } from "../../../src/game/random";
import { requireBattle, teamRun } from "../../support/game";
import { matchesPermanentKit, permanentKit } from "../../../src/game/card-kit";
import { ownedCards, rebuildCards } from "../../../src/game/team";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { snapshot } from "../../../src/application/cloud-snapshots";
import { chance } from "../../../src/game/chance";
import { newestHeads } from "../../../src/application/cloud-policy";
import saveFormat from "../../../src/game/save-format.json" with { type: "json" };
import { createMessageReader } from "../../../src/ui/shared/localization/messages";
import { immediateArtwork, likelyArtwork } from "../../../src/ui/startup/artwork";
import { assetUrl } from "../../../src/ui/shared/assets";
import { playPreviewModel } from "../../../src/ui/battle/play-preview-model";

it("keeps automatic turn completion aligned with legal card commands", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const attack = state.cards.find((card) => card.definitionId === "prismram-attack")!;
  state.battle.hand = [attack.id];
  const check = () =>
    expect(hasAvailablePlay(state)).toBe(availablePlays(state).some((play) => play.commands.length > 0));
  check();
  expect(hasAvailablePlay(state)).toBe(true);
  const other = state.cards.find((card) => card.ownerId !== attack.ownerId)!;
  state.battle.hand = [attack.id, other.id];
  check();
  state.battle.hand = [other.id, attack.id];
  check();
  state.battle.hand = [attack.id];
  state.battle.mana = 0;
  check();
  expect(hasAvailablePlay(state)).toBe(false);
  state.team.find((unit) => unit.id === attack.ownerId)!.combat!.freeCard = true;
  check();
  expect(hasAvailablePlay(state)).toBe(true);
  state.battle.enemies.forEach((enemy) => (enemy.health = 0));
  check();
  expect(hasAvailablePlay(state)).toBe(false);
  state.team[0]!.health = 0;
  state.reserves.push({ ...state.team[1]!, id: "backup" });
  check();
  state.battle.hand = [];
  check();
});

it("keeps cached card keywords isolated from callers", () => {
  const card = { definitionId: "emberback-attack" };
  const keywords = cardKeywords(card);
  const expected = [...keywords];
  keywords.splice(0);
  expect(cardKeywords(card)).toEqual(expected);
  const authored = definition(card.definitionId);
  expect(abilityKeywords(authored)).toEqual(definitionKeywords(authored));
  expect(Object.isFrozen(abilityKeywords(authored))).toBe(true);
  const adapted = { ...authored, leech: false };
  expect(abilityKeywords(adapted)).toEqual(definitionKeywords(adapted));
  adapted.leech = true;
  expect(abilityKeywords(adapted)).toEqual(definitionKeywords(adapted));
});

it("preserves the browser save byte boundary for multibyte text", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage;
  const saves = createBrowserPlatform(storage).saves;
  const exact = "é".repeat(saveFormat.maxBytes / 2);
  await saves.write(exact);
  await expect(saves.write(`${exact}é`)).rejects.toThrow("Invalid save payload");
  expect(values.get("fauna.save.v1")).toBe(exact);
});

it("keeps packet policies independent and preserves every delivery rule", () => {
  const cases: [DamagePacket, boolean, boolean, boolean, boolean, boolean][] = [
    [{ origin: "ability" }, true, true, true, true, false],
    [{ origin: "ability", delivery: "bounce" }, true, false, true, false, false],
    [{ origin: "ability", delivery: "reflection" }, true, false, false, false, false],
    [{ origin: "proc" }, true, false, true, true, false],
    [{ origin: "proc", delivery: "bounce" }, true, false, true, false, false],
    [{ origin: "resonance" }, true, false, false, true, false],
    [{ origin: "resonance", delivery: "bounce" }, true, false, false, false, false],
    [{ origin: "periodic" }, false, false, false, false, true],
    [{ origin: "retaliation" }, false, false, false, false, false],
    [{ origin: "statusRetaliation" }, false, false, false, false, false],
    [{ origin: "boon" }, false, false, false, false, false],
    [{ origin: "derived" }, false, false, false, false, true],
    [{ origin: "chain" }, false, false, false, false, true],
    [{ origin: "overkill" }, false, false, false, false, true],
  ];
  for (const [packet, attack, wrongFoot, resonance, bounce, deadSource] of cases) {
    const view = packetPolicyView(packet);
    expect(view).toMatchObject({ attack, wrongFoot, resonance, bounce, deadSource });
    expect(view.buildup).toBe(attack || packet.origin === "statusRetaliation" || packet.origin === "boon");
    expect(view.direct).toBe(packet.origin === "ability");
    expect(view.leechRewards).toBe(packet.origin !== "overkill");
    const copy = packetPolicy(packet);
    copy.attack = !copy.attack;
    expect(packetPolicyView(packet)).toEqual(view);
  }
});

it("keeps scaled extras in order for authored and mutable ability definitions", () => {
  for (const creature of SPECIES)
    for (const card of speciesCards(creature.id))
      for (const power of [1, 1, 1.2]) {
        const expected = (card.effects ?? []).map((effect) =>
          supplementalRule(effect.kind).scaling === "power"
            ? { ...effect, amount: scalePower(effect.amount, power) }
            : effect,
        );
        expect(abilityExtras(card, power)).toEqual(expected);
      }
  const authored = speciesCards("emberback").find((card) => card.effects?.length)!;
  const mutable = structuredClone(authored);
  if (mutable.effects?.[0]) mutable.effects[0].amount = 1.5;
  expect(abilityExtras(mutable)[0]?.amount).toBe(
    supplementalRule(mutable.effects![0]!.kind).scaling === "power" ? 2 : 1.5,
  );
});

it("keeps combat feedback frames and strongest sound in event order", () => {
  const events: GameEvent[] = [
    { kind: "action", actionType: "support", actorId: "ally", text: "Support" },
    { kind: "heal", targetId: "ally", amount: 4, text: "Heal" },
    { kind: "block", targetId: "ally", amount: -5, text: "Block" },
    { kind: "damage", targetId: "enemy", amount: 5, damageType: "burn", text: "Damage" },
    { kind: "action", actionType: "attack", actorId: "ally", text: "Attack" },
    { kind: "status", targetId: "enemy", status: "burn", outcome: "gain", text: "Status" },
  ];
  expect(feedbackFrames(events)).toEqual([events.slice(0, 4), events.slice(4)]);
  expect(selectCombatCue(events)).toBe("fire");
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

it("returns a sole eligible Discard card without consuming a random decision", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const owner = state.team[0]!;
  const card = state.cards.find((entry) => entry.ownerId === owner.id)!;
  state.boons = ["cloud-cup-and-ball"];
  state.battle.discard = [card.id];
  state.battle.hand = [];
  state.battle.buffer = [];
  const rng = state.rng;
  const events: Parameters<typeof recoverBrokenGuard>[2] = [];
  recoverBrokenGuard(state, owner.id, events);
  expect(state.battle.hand).toEqual([card.id]);
  expect(state.battle.discard).toEqual([]);
  expect(state.rng).toBe(rng);
  expect(events.at(-1)).toMatchObject({ kind: "action", actorId: owner.id });
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

it("preserves chance thresholds and Good Fortune retries in both directions", () => {
  for (const above of [false, true]) {
    const state = requireBattle(structuredClone(teamRun(42, ["euphera"])));
    const values = above ? [0.1, 0, 0.9] : [0.9, 0, 0.1];
    const decisions: unknown[] = [];
    observeDecisions(state, (decision) => {
      decisions.push(decision);
      return values.shift()!;
    });
    const events: Parameters<typeof chance>[3] = [];
    expect(chance(state, 0.3, false, events, above)).toBe(true);
    expect(decisions).toEqual([
      { kind: "chance", threshold: above ? 0.7 : 0.3 },
      { kind: "chance", threshold: 0.1 },
      { kind: "chance", threshold: above ? 0.7 : 0.3 },
    ]);
    expect(events).toHaveLength(1);
    expect(chance(state, 0, false, events, above)).toBe(false);
    expect(chance(state, 1, false, events, above)).toBe(true);
    expect(decisions).toHaveLength(3);
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

it("selects the first ranked command across changing visible battle states", () => {
  for (const seed of [7, 42, 91]) {
    const state = requireBattle(structuredClone(teamRun(seed, ["mossguard", "prismram"])));
    for (const health of [state.team[0]!.health, 1, 0]) {
      state.team[0]!.health = health;
      expect(chooseBattleCommand(state, false)).toEqual(
        rankedBattleChoices(state, false)[0]?.command ?? { type: "endTurn" },
      );
    }
  }
});

it("preserves permanent card order and boss shuffle decisions", () => {
  for (const kind of ["mossguard", "memento"] as const) {
    const kit = permanentKit(kind);
    expect(ownedCards("owner", kind).map((card) => card.definitionId)).toEqual(
      kit.map(({ definition }) => definition.id),
    );
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
    const expected = structuredClone(state);
    const enemy = { ...state.battle.enemies[0]!, species: kind };
    const ids = shuffle(
      expected,
      kit.map(({ definition }) => definition.id),
    );
    expect(bossDeck(state, enemy).draw).toEqual(ids);
    expect(state.rng).toBe(expected.rng);
  }
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

it("uses the borrowing creature's free play when a fallen owner's card is inspected", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["oathara", "mossguard"])));
  const [guide, fallen] = state.team;
  fallen!.health = 0;
  guide!.combat!.freeCard = true;
  const card = state.cards.find(
    (entry) => entry.ownerId === fallen!.id && entry.definitionId === "mossguard-attack",
  )!;
  state.battle.hand = [card.id];
  state.battle.mana = 0;
  expect(cardActor(state, card)).toBe(guide);
  expect(cardCost(card, state)).toBe(0);
  expect(inspectCardPlay(state, card.id).allowed).toBe(true);
  expect(availablePlays(state).map((play) => play.card.id)).toEqual([card.id]);
});

it("handles a single discarded card consistently for recovery and draw previews", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["wisterelle", "mossguard"])));
  const [owner, ally] = state.team;
  const own = state.cards.find((card) => card.ownerId === owner!.id)!;
  const other = state.cards.find((card) => card.ownerId === ally!.id)!;
  state.battle.draw = [];
  state.battle.discard = [other.id];
  expect(discardDrawCards(state, owner!.id)).toEqual([other]);
  expect(drawHasAnotherCard(state, own, { kind: "draw", amount: 1 })).toBe(true);
  ally!.health = 0;
  expect(discardDrawCards(state, owner!.id)).toEqual([]);
  expect(drawHasAnotherCard(state, own, { kind: "draw", amount: 1 })).toBe(false);
});

it("draws an eligible single card without changing decisions or buffer promotion", () => {
  for (const method of ["owner", "keyword"] as const) {
    for (const pile of ["draw", "discard"] as const) {
      const state = requireBattle(structuredClone(teamRun(42, ["emberback"])));
      const card = state.cards.find((entry) => cardKeywords(entry).includes("burn"))!;
      state.battle.draw = [];
      state.battle.discard = [];
      state.battle[pile] = [card.id];
      state.battle.hand = [];
      const buffered = state.cards.find((entry) => entry.id !== card.id)!.id;
      state.battle.buffer = [buffered];
      const decisions: unknown[] = [];
      observeDecisions(state, (decision) => {
        decisions.push(decision);
        return 0;
      });
      const events: Parameters<typeof draw>[2] = [];
      if (method === "owner") expect(drawOwner(state, card.ownerId!, events)).toBe(true);
      else drawKeyword(state, "burn", events);
      expect(state.battle.hand).toEqual([buffered, card.id]);
      expect(state.battle.buffer).toEqual([]);
      expect(state.battle.draw).toEqual([]);
      expect(state.battle.discard).toEqual([]);
      expect(decisions).toEqual([undefined]);
    }
  }
});

it("preserves drawable owner order when a fallen creature can borrow", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "oathara", "prismram"])));
  state.team[0]!.health = 0;
  expect([...drawableOwnerIds(state)]).toEqual(state.team.map((unit) => unit.id));
  state.team[1]!.health = 0;
  expect([...drawableOwnerIds(state)]).toEqual([state.team[2]!.id]);
});

it("preserves Cleanse feedback when control and buildup share a status", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  const unit = state.team[0]!;
  unit.combat!.controlled = "freeze";
  unit.combat!.controlTurns = 1;
  unit.combat!.freeze = 2;
  const events: Parameters<typeof removeEffects>[3] = [];
  expect(removeEffects(unit, "cleanse", 2, events, state)).toBe(1);
  expect(events.filter((event) => event.kind === "status" && event.outcome === "remove")).toHaveLength(1);
  expect(unit.combat!.controlled).toBeNull();
  expect(unit.combat!.freeze).toBe(0);
});

it("retains the last duplicate cloud record and its ancestry", async () => {
  const payload = encodeSave(teamRun(42, ["mossguard"]));
  const identity = {
    available: true,
    device: "a".repeat(32),
    profile: "b".repeat(32),
    importAvailable: false,
  };
  const first = await snapshot(payload, identity, 1);
  const updated = { ...first, ancestors: [first.id] };
  expect(newestHeads([updated, first])).toEqual([first]);
  expect(newestHeads([first, updated])).toEqual([]);
  const second = { ...first, id: "c".repeat(64), ancestors: [first.id] };
  expect(newestHeads([first, second])).toEqual([second]);
  expect(newestHeads([second, first])).toEqual([second]);
  expect(newestHeads([first, second, first])).toEqual([second]);
  expect(newestHeads([second, first, updated])).toEqual([second]);
  expect(newestHeads([first, { ...second, ancestors: [] }])).toEqual([first, { ...second, ancestors: [] }]);
  const third = { ...first, id: "d".repeat(64), ancestors: [] };
  const records = Object.freeze([first, third, second]);
  expect(newestHeads(records)).toEqual([third, second]);
  expect(records).toEqual([first, third, second]);
});

it("keeps Journey Loom's single-card eligibility, draw order and decisions", () => {
  for (const pile of ["draw", "discard"] as const) {
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
    const [owner, other] = state.team;
    const card = state.cards.find((entry) => entry.ownerId === other!.id)!;
    state.boons = ["journey-loom"];
    state.battle.draw = [];
    state.battle.discard = [];
    state.battle[pile] = [card.id];
    state.battle.hand = [];
    state.battle.buffer = [];
    expect(journeyReturnHasDraw(state, owner!.id)).toBe(true);
    other!.health = 0;
    expect(journeyReturnHasDraw(state, owner!.id)).toBe(false);
    other!.health = 1;
    const decisions: unknown[] = [];
    observeDecisions(state, (decision) => {
      decisions.push(decision);
      return 0;
    });
    journeyReturn(state, owner!.id, []);
    expect(state.battle.hand).toEqual([card.id]);
    expect(state.battle.draw).toEqual([]);
    expect(state.battle.discard).toEqual([]);
    expect(decisions).toEqual([undefined]);
  }
});

it("rebuilds permanent cards in kit order while retaining the matching original", () => {
  const state = structuredClone(teamRun(42, ["mossguard", "prismram"]));
  const retained = state.cards[0]!;
  retained.level = 2;
  const expected = state.team.flatMap((unit) => ownedCards(unit.id, unit.species).map((card) => card.id));
  rebuildCards(state);
  expect(state.cards.map((card) => card.id)).toEqual(expected);
  expect(state.cards[0]).toBe(retained);
  expect(state.cards[0]!.level).toBe(2);
});

it("keeps authored Boon lookup and artwork prefetch order", () => {
  for (const entry of BOONS) expect(findBoon(entry.id)).toBe(entry);
  expect(findBoon(null)).toBeUndefined();
  expect(findBoon("missing")).toBeUndefined();
  for (const state of [engine.createGame(42), requireBattle(teamRun(42, ["mossguard", "prismram"]))]) {
    const visible = new Set(immediateArtwork(state));
    const definitions =
      state.phase === "draft"
        ? (state.selected.length ? state.selected : state.starterOffers).flatMap(speciesCards)
        : state.cards.map((card) => definition(card.definitionId));
    const expected = [
      ...new Set(definitions.map((card) => assetUrl(card.artwork ?? `action.${card.species}`))),
    ]
      .filter((url) => !visible.has(url))
      .slice(0, 8);
    expect(likelyArtwork(state)).toEqual(expected);
  }
});

it("keeps single-world forecasts identical to repeated equivalent worlds", () => {
  const state = requireBattle(teamRun(42, ["mossguard", "prismram"]));
  const outcome = {
    accepted: true as const,
    state,
    events: [{ kind: "status" as const, amount: 1, text: "Notice" }],
  };
  const single = playPreviewModel(
    state,
    { kind: "complete", outcomes: [outcome], replays: 1 },
    state.team[0]!.id,
  );
  const repeated = playPreviewModel(
    state,
    { kind: "complete", outcomes: [outcome, outcome], replays: 2 },
    state.team[0]!.id,
  );
  expect(single).toEqual(repeated);
  expect(single.messages).toEqual(["Notice"]);
});

it("keeps authored ability values independent of levels, passives and enemy room power", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["memento"])));
  const actor = state.team[0]!;
  const enemy = { ...state.battle.enemies[0]!, power: 2 };
  let checked = 0;
  for (const entry of SPECIES) {
    for (const def of speciesCards(entry.id)) {
      if (abilityRule(def.effect).scaling !== "authored") continue;
      const card = { id: "test", definitionId: def.id, ownerId: actor.id, level: 4 };
      expect(actionValue(card, actor, state, def)).toBe(def.value);
      expect(enemyAbilityValue(enemy, def)).toBe(def.value);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
});

it("preserves talent prerequisites and points for short and complete selections", () => {
  const keywordXP = Object.fromEntries(
    [...new Set(TALENTS.map((talent) => talent.keyword))].map((id) => [id, 1000]),
  );
  for (const talent of TALENTS) {
    const prerequisites = TALENTS.filter(
      (entry) => entry.keyword === talent.keyword && entry.row < talent.row,
    );
    const state = { talents: prerequisites.map((entry) => entry.id), keywordXP };
    expect(canBuyTalent(state, talent.id)).toBe(true);
    expect(validTalentSelection({ ...state, talents: [talent.id] })).toBe(prerequisites.length === 0);
    for (const xp of [0, 10, 1000]) {
      const test = { ...state, keywordXP: { ...keywordXP, [talent.keyword]: xp } };
      const total = TALENTS.filter((entry) => entry.keyword === talent.keyword).length;
      expect(availablePoints(test, talent.keyword)).toBe(
        Math.max(0, Math.min(talentPoints(xp), total) - state.talents.length),
      );
    }
  }
});

it("preserves starter offer order with one selected creature", () => {
  const state = structuredClone(teamRun(42, ["mossguard"]));
  state.selected = ["mossguard"];
  const pool = ["mossguard", "prismram", "memento", "emberback"] as const;
  expect(starterOfferPool(state, pool)).toEqual(["prismram", "emberback"]);
});

it("keeps enemy ability validation and committed victory rewards across save and resume", () => {
  const battle = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  const enemy = battle.battle.enemies[0]!;
  enemy.lastAbility = speciesCards(enemy.species)[0]!.id;
  expect(decodeSave(encodeSave(battle))).toEqual(battle);
  enemy.lastAbility = "not-an-ability";
  expect(() => decodeSave(encodeSave(battle))).toThrow();
  enemy.lastAbility = null;
  const expectedRecruits = [...battle.expedition.pack!];
  const result = engine.dispatch(battle, { type: "devWinBattle" }, true);
  expect(result.accepted).toBe(true);
  expect(result.state.reward?.recruits).toEqual(expectedRecruits);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("detects injured deployed and eligible reserve allies without changing heal targets", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const backup = state.team.pop()!;
  state.reserves.push(backup);
  backup.health--;
  expect(battleBenefitFacts(state).injuredAllies).toBe(false);
  state.boons.push("camp-hammock");
  expect(battleBenefitFacts(state).injuredAllies).toBe(true);
  backup.health = 0;
  expect(battleBenefitFacts(state).injuredAllies).toBe(false);
  state.team[0]!.health--;
  expect(battleBenefitFacts(state).injuredAllies).toBe(true);
});

it("preserves weighted Boon choices and RNG with shrinking and exhausted pools", () => {
  for (const seed of [1, 42, 591])
    for (const unowned of [0, 1, 2, 3, BOONS.length]) {
      const state = structuredClone(teamRun(seed, ["mossguard", "prismram"]));
      state.boons = BOONS.slice(0, BOONS.length - unowned).map((boon) => boon.id);
      const reference = structuredClone(state);
      const owned = new Set(reference.boons);
      const keywords = rosterBoonKeywords(reference);
      const pool = BOONS.filter((boon) => !owned.has(boon.id)).map((boon) => ({
        id: boon.id,
        weight: BOON_KEYWORDS[boon.id]?.some((keyword) => keywords.has(keyword)) ? 2 : 1,
      }));
      const expected = [];
      while (pool.length && expected.length < 3) {
        let choice = roll(reference) * pool.reduce((sum, boon) => sum + boon.weight, 0);
        let index = 0;
        while (index < pool.length - 1 && choice >= pool[index]!.weight) choice -= pool[index++]!.weight;
        expected.push(pool.splice(index, 1)[0]!.id);
      }
      expect(offerBoons(state)).toEqual(expected);
      expect(state).toEqual(reference);
    }
});

it("counts Scoop effects once per status and refreshes live combat changes", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  state.boons = ["clover-measuring-scoop"];
  const unit = state.team[0]!;
  const stats = unit.combat!;
  for (const status of harmfulStatuses) {
    stats[status] = 3;
    const expected = harmfulStatuses.filter(
      (entry) => stats.controlled === entry || Number(stats[entry]) > 0,
    ).length;
    expect(scoopBonus(state, unit, 1)).toBe(expected * boonRule("clover-measuring-scoop").healing);
  }
  stats.controlled = "freeze";
  expect(scoopBonus(state, unit, 1)).toBe(
    harmfulStatuses.length * boonRule("clover-measuring-scoop").healing,
  );
  expect(scoopBonus(state, unit, 0)).toBe(0);
  for (const status of harmfulStatuses) stats[status] = 0;
  stats.controlled = null;
  expect(scoopBonus(state, unit, 1)).toBe(0);
});

it("preserves passive card bonuses across authored tiers and attack state", () => {
  for (const kind of SPECIES)
    for (const tier of kind.passiveTiers)
      for (const def of CARDS) {
        for (const attacked of [false, true]) {
          const expected = tier.effects.reduce((sum, effect) => {
            if (effect.kind !== "cardBonus") return sum;
            const applies =
              effect.trigger === "firstAttack"
                ? def.effect === "attack" && !attacked
                : effect.trigger === "stunAttack"
                  ? def.effect === "attack" && def.damageType === "stun"
                  : effect.trigger === "heal"
                    ? def.effect === "heal"
                    : def.effect === "guard" ||
                      def.effect === "redistributeBlock" ||
                      def.effect === "teamProtection";
            return sum + (applies ? effect.amount : 0);
          }, 0);
          expect(passiveCardBonus(def, tier, attacked)).toBe(expected);
        }
      }
});

it("keeps diagnostic snapshots immutable and independent after bounded retention", () => {
  const diagnostics = createDiagnostics();
  diagnostics.record("render", "first failure");
  const first = diagnostics.snapshot();
  for (let index = 0; index < 55; index++) diagnostics.record("render", `failure ${index}`);
  const latest = diagnostics.snapshot();
  expect(first).toEqual([{ source: "render", message: "first failure", count: 1 }]);
  expect(latest).toHaveLength(50);
  expect(latest[0]!.message).toBe("failure 5");
  expect(latest[49]!.message).toBe("failure 54");
  expect(Object.isFrozen(latest)).toBe(true);
  expect(latest.every(Object.isFrozen)).toBe(true);
  diagnostics.record("render", "failure 54");
  expect(diagnostics.snapshot()[49]!.count).toBe(2);
  expect(latest[49]!.count).toBe(1);
  diagnostics.dispose();
});

it("snapshots reflected victims in attacker-first order and excludes departed summons", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  const source = state.battle.enemies[1]!;
  summonEcho(state, source, "enemy", 12, []);
  const echo = state.battle.minions![0]!;
  const expected = [
    source,
    ...battlefield(state, "enemy").filter((unit) => unit.health > 0 && unit.id !== source.id),
  ];
  const recipients = enemyReflectionRecipients(state, source);
  expect(recipients).toEqual(expected);
  expect(recipients.filter((unit) => unit === source)).toHaveLength(1);
  state.battle.enemies.splice(1, 1);
  expect(recipients).toEqual(expected);
  expect(enemyReflectionRecipients(state, source)).not.toContain(echo);
  expect(enemyReflectionRecipients(state, source)[0]).toBe(source);
});

it("keeps alternate attack estimates in damage-type order without touching state", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["prismram"])));
  const actor = state.team[0]!;
  const enemy = state.battle.enemies[0]!;
  const def = definition("prismram-attack");
  if (def.effect !== "attack") throw new Error("Expected attack");
  const before = structuredClone(state);
  for (const cost of [0, 1]) {
    const dual = { ...def, damageType: "physical", alternateDamageType: "water" } as const;
    expect(ordinaryAttackFacts(state, actor, dual, 12, enemy, cost)).toEqual([
      ...ordinaryAttackFacts(state, actor, { ...dual, alternateDamageType: undefined }, 12, enemy, cost),
      ...ordinaryAttackFacts(
        state,
        actor,
        { ...dual, damageType: "water", alternateDamageType: undefined },
        12,
        enemy,
        cost,
      ),
    ]);
  }
  expect(state).toEqual(before);
});

it("keeps enemy probe values live without mutating battle or RNG", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  state.boons = [];
  state.talents = [];
  const enemy = state.battle.enemies[0]!;
  enemy.species = "mossguard";
  enemy.health = 97;
  enemy.maxHealth = 100;
  enemy.combat = freshCombat();
  state.battle.enemies = [enemy];
  const heal = {
    ...definition("mossguard-attack"),
    effect: "heal",
    value: 10,
    target: undefined,
    effects: undefined,
  } as const;
  const before = structuredClone(state);
  expect(enemyCardValue(state, enemy, heal, undefined, enemy.id)).toBe(3);
  expect(chooseEnemyCard(state, enemy, [heal, heal])?.value).toBe(3);
  expect(state).toEqual(before);
  enemy.health = 100;
  expect(enemyCardValue(state, enemy, heal, undefined, enemy.id)).toBe(0);
});

it("retains replacement slots and valid battle zones for manual and card-driven swaps", () => {
  for (const fromCard of [false, true]) {
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram", "emberback"])));
    const backup = state.team.pop()!;
    state.reserves.push(backup);
    rebuildCards(state);
    state.battle.hand = [];
    state.battle.buffer = [];
    state.battle.discard = [];
    state.battle.draw = state.cards.map((card) => card.id);
    const outgoing = state.team[0]!;
    const slots = state.cards.filter((card) => card.ownerId === outgoing.id).map((card) => card.id);
    swapBackup(state, outgoing.id, backup.id, [], fromCard);
    expect(state.cards.filter((card) => card.ownerId === backup.id).map((card) => card.id)).toEqual(slots);
    const zones = [
      ...state.battle.hand,
      ...state.battle.buffer,
      ...state.battle.draw,
      ...state.battle.discard,
    ];
    expect([...zones].sort()).toEqual(state.cards.map((card) => card.id).sort());
    expect(new Set(zones).size).toBe(zones.length);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  }
});

it("preserves redraw state, events, buffer order and RNG against the original exchange", () => {
  for (const seed of [1, 42, 591]) {
    const state = requireBattle(structuredClone(teamRun(seed, ["mossguard", "prismram"])));
    const reference = structuredClone(state);
    const events: GameEvent[] = [];
    const expected: GameEvent[] = [];
    const returned = reference.battle.hand.splice(0);
    reference.battle.draw.push(...returned);
    shuffle(reference, reference.battle.draw);
    draw(reference, returned.length, expected);
    redrawHand(state, events);
    expect(state).toEqual(reference);
    expect(events).toEqual(expected);
  }
});

it("keeps Mossball's first tied living recipient and excludes the source", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["prismram", "emberback", "mossguard"])));
  state.boons = ["mossball"];
  const [source, first, second] = state.team;
  for (const unit of state.team) unit.combat = freshCombat();
  first!.combat!.thorns = 4;
  second!.combat!.thorns = 4;
  const rng = state.rng;
  const events: GameEvent[] = [];
  grantStatus(source!, "thorns", 1, events, state);
  expect(first!.combat!.thorns).toBe(4 + boonRule("mossball").thorns);
  expect(second!.combat!.thorns).toBe(4);
  expect(state.rng).toBe(rng);
  first!.health = 0;
  grantStatus(source!, "thorns", 1, [], state);
  expect(second!.combat!.thorns).toBe(4 + boonRule("mossball").thorns);
});

it("keeps card-driven position swaps and their random choice aligned", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["prismram", "emberback", "mossguard"])));
  const actor = state.team[0]!;
  const original = [...state.team];
  const reference = structuredClone(state);
  const others = original.slice(1);
  const other = others[Math.floor(roll(reference, { kind: "index", size: others.length }) * others.length)]!;
  expect(swapFromCard(state, actor, [])).toBe(other);
  expect(state.team[0]).toBe(other);
  expect(state.team[original.indexOf(other)]).toBe(actor);
  expect(state.rng).toBe(reference.rng);
});

it("returns an independent recruit lineup without changing deployment", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["prismram", "emberback"])));
  const before = state.team.map((unit) => unit.id);
  const incoming = { ...state.team[0]!, id: "incoming", species: "mossguard" as const };
  expect(recruitLineup(state, incoming)).toEqual([...before, incoming.id]);
  expect(state.team.map((unit) => unit.id)).toEqual(before);
});

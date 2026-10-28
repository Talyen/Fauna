import { addReserve, accept, prepareDestination, requireBattle, teamRun } from "../../support/game";
import { setBattleCards } from "../../support/cards";
import saveFormat from "../../../src/game/save-format.json" with { type: "json" };
import { createHash } from "node:crypto";
import { recordedTraceDigest as digest } from "../../support/modifier-trace";
import { produce } from "immer";
import { describe, expect, it } from "vitest";
import {
  CARDS,
  SPECIES,
  FOOD_CARDS,
  definition,
  species,
  speciesCards,
  FIRST_RUN_STARTERS,
  type SpeciesId,
} from "../../../src/game/content";
import { PEARL } from "../../../src/game/content/creatures/memento";
import { cardTargeting, cardText, enemyCard, enemyCanUse } from "../../../src/game/card-rules";
import { definitionKeywords } from "../../../src/game/keywords";
import { primaryAbilityValue, abilityExtras } from "../../../src/game/combat/ability-values";
import { availablePlays } from "../../../src/game/play-queries";
import { dispatch, previewCard } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { rankedBattleChoices } from "../../../src/application/battle-policy";

import { arabescaBattle } from "../../support/arabesca";
import { freshCombat, hit, grantTemporaryDodge, startAction } from "../../../src/game/combat/index";
import { executeAbility } from "../../../src/game/combat/abilities";
import { swapFromCard, swapBackup } from "../../../src/game/team";
import { createFood } from "../../../src/game/combat/food";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { battleChoices } from "../../../src/application/battle-policy";
import type { BattleState, GameEvent } from "../../../src/game/types";

// Preserve values and array order while allowing builders to assemble object
// properties in a different order. Card digest updated for Undertow Knot and Spark Decoy.
// Species digest includes Bloomquail's clarification that conversion uses gained Block.
it("preserves every authored creature, passive tier, card and Pearl", () => {
  const digest = (value: unknown) =>
    createHash("sha256")
      .update(
        JSON.stringify(value, (_key, entry) =>
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
            : entry,
        ),
      )
      .digest("hex");
  expect({
    cards: digest(CARDS),
    species: digest(SPECIES),
    pearl: digest(PEARL),
  }).toMatchInlineSnapshot(`
    {
      "cards": "75badaf3a772c0a564200c08f237c37951ff0fa01f433d156ff4ae1ac710e033",
      "pearl": "1ae0c37e2fc0a8088a6fe7b827c5e7f23512457a723269b79b7e1fc78417ebda",
      "species": "9c5cbe00d41d492d377f9f5a9d10626fc1fe4a73dfb1541813d6cf169a4c6a4a",
    }
  `);
});

// The targeting refactor changes only these two enemy definition representations.
// Assert their new scope, then retain the recorded shape so the original oracle
// still detects every other change to authored data and enemy adaptation.
function recordedEnemy(card: (typeof CARDS)[number]) {
  const enemy = enemyCard(card);
  if (card.id !== "pollenmoth-teamGuard" && card.id !== "cadenza-rousing-refrain") return enemy;
  expect(enemy.effect).toBe(card.id === "pollenmoth-teamGuard" ? "guard" : "dodge");
  expect(enemy.target).toBe("allAllies");
  expect(cardTargeting(enemy)).toBe("automatic");
  const { target: _target, ...recorded } = enemy;
  return { ...recorded, effect: card.id === "pollenmoth-teamGuard" ? "teamGuard" : "teamDodge" };
}

// Catalog hashes use sorted enemy properties captured from the unchanged catalog on 2026-10-26,
// after the original oracle passed. Gameplay trace hashes below remain unchanged.
// Never regenerate these to accept a refactor.
it("preserves authored text, targeting, scaling, keywords and enemy adaptations", () => {
  // The complete catalog digest above owns order; per-card expectations use stable IDs.
  // New kits have direct contracts below or in creatures/*.test.ts; preserve the older oracle.
  const cards = [
    ...CARDS.filter(
      (card) => !["arabesca", "skybex", "dulcera", "pyrella", "alpenglen"].includes(card.species ?? ""),
    ),
    PEARL,
    ...FOOD_CARDS,
  ];
  expect(
    Object.fromEntries(
      cards.map((card) => [
        card.id,
        digest({
          targeting: cardTargeting(card),
          keywords: definitionKeywords(card),
          // Property order is not an authored rule; canonicalize only this catalog object.
          enemy: JSON.parse(
            JSON.stringify(recordedEnemy(card), (_key, entry) =>
              entry && typeof entry === "object" && !Array.isArray(entry)
                ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
                : entry,
            ),
          ),
          enemySupported: enemyCanUse(card),
          variants: [1, 1.6].flatMap((power) =>
            [0, 2].map((level) => ({
              text: cardText(card, level, undefined, power),
              resolvedText: cardText(card, level, 19, power),
              value: primaryAbilityValue(card, card.value + level * 2, power),
              extras: abilityExtras(card, power),
            })),
          ),
        }),
      ]),
    ),
  ).toMatchSnapshot();
});

const scenarios: { name: string; species: SpeciesId; effect: string; reflection?: boolean }[] = [
  { name: "recipient healing and cleanse", species: "reedstag", effect: "heal" },
  { name: "recovery and recipient healing", species: "almanelle", effect: "recover" },
  { name: "generated Food", species: "orifable", effect: "createFood" },
  { name: "generated Pearls", species: "memento", effect: "createPearls" },
  { name: "random attack", species: "pollenmoth", effect: "attack" },
  { name: "reflected attack and extras", species: "emberback", effect: "attack", reflection: true },
  { name: "group protection", species: "ringpalm", effect: "teamProtection" },
  { name: "attack reflection grant", species: "oathara", effect: "reflectAttack" },
];

it.each(scenarios)("preserves commands, previews, save/resume and rankings: $name", (scenario) => {
  const game = requireBattle(
    produce(teamRun(42, [scenario.species]), (draft) => {
      const card = draft.cards.find((entry) => definition(entry.definitionId).effect === scenario.effect)!;
      expect(card).toBeDefined();
      setBattleCards(draft, [card.id]);
      draft.team[0]!.health = 5;
      draft.team[0]!.combat!.poison = 2;
      if (scenario.reflection) {
        for (const enemy of draft.battle!.enemies) enemy.combat.attackReflection = true;
      }
    }),
  );
  const before = encodeSave(game);
  const command = availablePlays(game, false)[0]!.commands[0]!;
  const result = dispatch(game, command);
  expect(result.accepted).toBe(true);
  expect(result.events).toContainEqual(
    expect.objectContaining({
      kind: "action",
      announcement: {
        kind: "useAbility",
        definitionId: game.cards.find((card) => card.id === command.cardId)!.definitionId,
      },
    }),
  );
  expect(dispatch(decodeSave(before), command)).toEqual(result);
  expect(result.state.rng).toBe(dispatch(game, command).state.rng);
  const preview = previewCard(game, command.cardId, command.targetId);
  const rejection = dispatch(game, { ...command, cardId: "missing" });
  expect(rejection.accepted).toBe(false);
  expect(rejection.state).toBe(game);
  expect(encodeSave(game)).toBe(before);
  expect({
    command,
    committed: digest(result),
    preview: digest(preview),
    rankings: rankedBattleChoices(game, false),
    enemyTurn: digest(dispatch(game, { type: "endTurn" })),
  }).toMatchSnapshot();
});

// Arabesca extends the ability contracts with a shared next-card grant.

const snare = "arabesca-ribbon-snare";
const spring = "arabesca-springbound";
const double = "arabesca-dancing-double";
function playArabesca(game: BattleState, id: string, targetId?: string) {
  return dispatch(game, {
    type: "play",
    cardId: game.cards.find((card) => card.definitionId === id)!.id,
    targetId,
    autoEndTurn: false,
  });
}
function enemyArabesca(game: BattleState, id: string, events: GameEvent[]) {
  const enemy = game.battle.enemies[0]!;
  executeAbility(
    game,
    {
      side: "enemy",
      actor: enemy,
      def: definition(id),
      value: definition(id).value,
      targetId: game.team[0]!.id,
      allyTargetId: enemy.id,
    },
    events,
    { swap: swapFromCard },
  );
}

describe("Arabesca's selected ability contracts", () => {
  it("exposes the selected rules, six complete tiers and encounter availability", () => {
    expect(speciesCards("arabesca").map((card) => [cardText(card), card.cost, enemyCanUse(card)])).toEqual([
      ["Deal 6 Stun damage", 1, true],
      ["Cleanse all Freeze build-up from allies / Gain 30% Dodge until next turn", 1, true],
      ["Your next card is played twice", 1, true],
    ]);
    expect(species("arabesca").passiveTiers.map((tier) => tier.effects)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => [{ kind: "petalwake", amount }]),
    );
    expect(FIRST_RUN_STARTERS).not.toContain("arabesca");
    expect(COMBAT_PACKS.some((pack) => pack.some((kind) => kind === "arabesca"))).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    "restores %i Health to all living deployed allies, including herself, on every Dodge",
    (amount) => {
      const events: GameEvent[] = [];
      const game = produce(arabescaBattle(), (draft) => {
        draft.discovery.recruited.arabesca = amount;
        for (let n = 0; n < 2; n++)
          hit(draft, draft.battle.enemies[0]!, draft.team[0]!, 6, "physical", events, {
            origin: "ability",
            blindMiss: true,
          });
      });
      expect(game.team.map((unit) => unit.health)).toEqual([
        10 + amount * 2,
        10 + amount * 2,
        10 + amount * 2,
      ]);
      expect(events.filter((event) => event.kind === "heal")).toHaveLength(6);
      expect(decodeSave(encodeSave(game))).toEqual(game);
    },
  );

  it("does not heal on hits, another creature's Dodge or periodic damage; excludes backups and knockouts", () => {
    const game = produce(arabescaBattle(), (draft) => {
      addReserve(draft, "backup", "arabesca", 5, freshCombat());
      draft.team[2]!.health = 0;
      hit(draft, draft.battle.enemies[0]!, draft.team[1]!, 6, "physical", [], {
        origin: "ability",
        blindMiss: true,
      });
      expect(draft.team[0]!.health).toBe(10);
      hit(draft, draft.battle.enemies[0]!, draft.team[0]!, 2, "physical", [], { origin: "periodic" });
      expect(draft.team[1]!.health).toBe(10);
      hit(draft, draft.battle.enemies[0]!, draft.team[0]!, 6, "physical", [], {
        origin: "ability",
        blindMiss: true,
      });
    });
    expect(game.team.map((unit) => unit.health)).toEqual([9, 11, 0]);
    expect(game.reserves[0]!.health).toBe(5);
  });

  it("uses Camp Hammock's shared healing recipients for Petalwake", () => {
    const game = produce(arabescaBattle(), (draft) => {
      draft.boons = ["camp-hammock"];
      addReserve(draft, "backup", "prismram", 5, freshCombat());
      hit(draft, draft.battle.enemies[0]!, draft.team[0]!, 6, "physical", [], {
        origin: "ability",
        blindMiss: true,
      });
    });
    expect(game.reserves[0]!.health).toBe(6);
    expect(game.team.map((unit) => unit.health)).toEqual([11, 11, 11]);
  });

  it("uses the base passive for an enemy Arabesca and heals only her side", () => {
    const game = produce(arabescaBattle(), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      enemy.species = "arabesca";
      enemy.name = "Arabesca";
      enemy.health = 10;
      enemy.maxHealth = 26;
      draft.discovery.recruited.arabesca = 6;
      draft.battle.enemies[1]!.health = 10;
      hit(draft, draft.team[0]!, enemy, 6, "physical", [], { origin: "ability", blindMiss: true });
    });
    expect(game.battle.enemies.slice(0, 2).map((unit) => unit.health)).toEqual([11, 11]);
    expect(game.team.map((unit) => unit.health)).toEqual([10, 10, 10]);
  });

  it("clears allied Freeze buildup and grants Dodge only to Arabesca, with ordinary expiry", () => {
    const game = arabescaBattle();
    const result = playArabesca(game, spring);
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((unit) => unit.combat!.freeze)).toEqual([0, 0, 0]);
    expect(result.state.team.map((unit) => unit.combat!.temporaryDodge)).toEqual([30, 0, 0]);
    expect(result.state.battleXP).toMatchObject({ health: 1, dodge: 1 });
    expect(previewCard(game, game.cards.find((card) => card.definitionId === spring)!.id)).toEqual(result);
    const expired = produce(result.state, (draft) => {
      startAction(draft.team[0]!, [], draft);
    });
    expect(expired.team[0]!.combat!.temporaryDodge).toBe(0);
  });

  it("keeps active Freeze distinct from buildup and preserves unrelated statuses", () => {
    const game = produce(arabescaBattle(), (draft) => {
      draft.team[1]!.combat!.freeze = 0;
      draft.team[1]!.combat!.controlled = "freeze";
      draft.team[1]!.combat!.controlTurns = 1;
      draft.team[2]!.combat!.stun = 3;
      draft.team[2]!.combat!.burn = 2;
    });
    const result = playArabesca(game, spring);
    expect(result.state.team[1]!.combat!.controlled).toBe("freeze");
    expect(result.state.team[2]!.combat).toMatchObject({ stun: 3, burn: 2 });
  });

  it("applies upgrades to Snare damage and Springbound Dodge while retaining the fixed double", () => {
    expect(cardText(definition(snare), 3)).toBe("Deal 12 Stun damage");
    expect(cardText(definition(spring), 3)).toContain("36% Dodge");
    expect(cardText(definition(double), 3)).toBe("Your next card is played twice");
  });

  it("doubles a teammate's complete card for one Mana and one accepted play", () => {
    const game = requireBattle(
      accept(arabescaBattle(), {
        type: "play",
        cardId: arabescaBattle().cards.find((card) => card.definitionId === double)!.id,
        autoEndTurn: false,
      }),
    );
    expect(game.battle.repeatNext.player).toBe(true);
    const result = playArabesca(game, "emberback-attack", game.battle.enemies[0]!.id);
    expect(result.accepted).toBe(true);
    expect(
      result.events.filter((event) => event.kind === "damage" && event.damageType === "physical"),
    ).toHaveLength(2);
    expect(result.state.battle!.mana).toBe(2);
    expect(result.state.battle!.cardsPlayedThisTurn).toBe(2);
    expect(result.state.team[1]!.combat!.cardsPlayedThisTurn).toBe(1);
    expect(result.state.battleXP.physical).toBe(1);
    expect(result.state.team[1]!.combat!.armor).toBe(4);
    expect(result.state.battle!.repeatNext.player).toBe(false);
    expect(
      previewCard(
        game,
        game.cards.find((card) => card.definitionId === "emberback-attack")!.id,
        game.battle.enemies[0]!.id,
      ),
    ).toEqual(result);
  });

  it("doubles Springbound, consuming the grant and capping ordinary Dodge", () => {
    const game = produce(arabescaBattle(), (draft) => {
      draft.battle.repeatNext.player = true;
      grantTemporaryDodge(draft.team[0]!, 25, []);
    });
    const result = playArabesca(game, spring);
    expect(result.state.team[0]!.combat!.temporaryDodge).toBe(70);
    expect(result.state.battle!.repeatNext.player).toBe(false);
  });

  it("repeating Dancing Double refreshes one future card, with no recursive resolution", () => {
    const game = produce(arabescaBattle(), (draft) => {
      draft.battle.repeatNext.player = true;
    });
    const result = playArabesca(game, double);
    expect(result.state.battle!.repeatNext.player).toBe(true);
    expect(result.events.filter((event) => event.text === "Your next card is played twice")).toHaveLength(2);
    expect(result.state.battle!.mana).toBe(3);
  });

  it("spends an admitted double even when a before-ability reaction knocks out the actor", () => {
    const events: GameEvent[] = [];
    const game = produce(arabescaBattle(), (draft) => {
      draft.battle.repeatNext.player = true;
      const actor = draft.team[0]!;
      actor.health = 1;
      actor.combat!.deathDoorUsed = true;
      draft.talents = ["leech.armor-siphon"];
      draft.battle.enemies[0]!.combat.armor = 1;
      executeAbility(
        draft,
        {
          side: "player",
          actor,
          def: { ...definition(snare), leech: true },
          value: 6,
          targetId: draft.battle.enemies[0]!.id,
        },
        events,
        { swap: swapFromCard },
      );
    });
    expect(game.team[0]!.health).toBe(0);
    expect(game.battle.repeatNext.player).toBe(false);
    expect(events.some((event) => event.kind === "damage" && event.damageType === "stun")).toBe(false);
  });

  it("does not stack other repeat sources beyond two resolutions", () => {
    const events: GameEvent[] = [];
    const game = produce(arabescaBattle(), (draft) => {
      draft.battle.repeatNext.player = true;
      const def = definition(spring);
      executeAbility(
        draft,
        { side: "player", actor: draft.team[0]!, def: { ...def, repeatChance: 100 }, value: 30 },
        events,
        { swap: swapFromCard },
      );
    });
    expect(game.team[0]!.combat!.temporaryDodge).toBe(60);
    expect(game.battle.repeatNext.player).toBe(false);
  });

  it("repeats shared Food before consuming it once, without spending creature grants", () => {
    const game = produce(arabescaBattle(), (draft) => {
      draft.rng = 0;
      createFood(draft, draft.team[0]!, 1, []);
      const food = draft.cards.find((card) => card.ownerId === null)!;
      food.definitionId = "food-apple";
      draft.battle.repeatNext.player = true;
      draft.team[1]!.combat!.freeCard = true;
    });
    const result = playArabesca(game, "food-apple", game.team[1]!.id);
    expect(result.accepted).toBe(true);
    expect(result.state.team[1]!.health).toBe(22);
    expect(result.state.team[1]!.combat!.freeCard).toBe(true);
    expect(result.state.cards.filter((card) => card.ownerId === null)).toHaveLength(0);
    expect(result.state.battle!.repeatNext.player).toBe(false);
  });

  it("preserves the grant through turns, swaps and save/resume; rejection preserves state and RNG", () => {
    const game = produce(arabescaBattle(), (draft) => {
      draft.battle.repeatNext.player = true;
      draft.battle.enemies.forEach((unit) => {
        unit.combat.controlled = "freeze";
        unit.combat.controlTurns = 1;
      });
      addReserve(draft, "backup", "prismram", 30, freshCombat());
    });
    const rejected = playArabesca(game, snare, "missing");
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(game);
    const ended = requireBattle(accept(game, { type: "endTurn" }));
    const swapped = produce(ended, (draft) => {
      swapBackup(draft, draft.team[0]!.id, "backup", []);
    });
    expect(swapped.battle.repeatNext.player).toBe(true);
    const resumed = requireBattle(decodeSave(encodeSave(swapped)));
    expect(resumed).toEqual(swapped);
    const playable = produce(resumed, (draft) => {
      const card = draft.cards.find((card) => card.definitionId === "emberback-attack")!;
      setBattleCards(draft, [card.id]);
    });
    const result = playArabesca(playable, "emberback-attack", playable.battle.enemies[0]!.id);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.repeatNext.player).toBe(false);
    const next = produce(resumed, (draft) => {
      prepareDestination(draft);
    });
    expect(accept(next, { type: "beginBattle" }).battle!.repeatNext).toEqual({ player: false, enemy: false });
  });

  it("supports enemy Springbound and an independent enemy next-card grant", () => {
    const events: GameEvent[] = [];
    const game = produce(arabescaBattle(), (draft) => {
      draft.battle.enemies[0]!.species = "arabesca";
      draft.battle.enemies[0]!.combat.freeze = 4;
      draft.battle.enemies[1]!.combat.freeze = 5;
      draft.battle.repeatNext.player = true;
      enemyArabesca(draft, spring, events);
      expect(draft.battle.enemies[0]!.combat.temporaryDodge).toBe(30);
      expect(draft.battle.enemies[1]!.combat.freeze).toBe(0);
      enemyArabesca(draft, double, events);
      expect(draft.battle.repeatNext.enemy).toBe(true);
      enemyArabesca(draft, snare, events);
    });
    expect(events.filter((event) => event.kind === "damage" && event.damageType === "stun")).toHaveLength(2);
    expect(game.battle.repeatNext).toEqual({ player: true, enemy: false });
  });

  it("recognizes Springbound's Dodge benefit even when nobody has Freeze buildup", () => {
    const game = produce(arabescaBattle(), (draft) => {
      draft.team.forEach((unit) => {
        unit.combat!.freeze = 0;
      });
      draft.battle.hand = [draft.cards.find((card) => card.definitionId === spring)!.id];
    });
    expect(
      battleChoices(game, false).some(
        (choice) => choice.type === "play" && choice.cardId === game.battle.hand[0],
      ),
    ).toBe(true);
  });

  it("validates repeat flags and rejects the obsolete development save", () => {
    const raw = JSON.parse(encodeSave(arabescaBattle()));
    expect(raw.version).toBe(saveFormat.version);
    raw.battle.repeatNext.player = "true";
    expect(() => decodeSave(JSON.stringify(raw))).toThrow();
    raw.battle.repeatNext.player = false;
    raw.version = saveFormat.version - 1;
    expect(() => decodeSave(JSON.stringify(raw))).toThrow();
  });
});

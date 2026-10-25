import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { orifableBattle } from "../../../support/orifable";
import { addBackups, prepareDestination, requireBattle, teamRun } from "../../../support/game";
import { dispatch, previewCard } from "../../../../src/game/engine";
import {
  definition,
  species,
  speciesCards,
  FOOD_CARDS,
  FIRST_RUN_STARTERS,
} from "../../../../src/game/content";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import { validateCatalog } from "../../../../src/game/content-validation";
import { cardCost } from "../../../../src/game/ability-rules";
import { inspectCardPlay } from "../../../../src/game/play-queries";
import { createFood } from "../../../../src/game/combat/food";
import { expressDelivery, draw, MAX_BATTLE_CARDS } from "../../../../src/game/card-zones";
import { freshCombat } from "../../../../src/game/combat/index";
import { swapBackup } from "../../../../src/game/team";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import type { BattleState, GameEvent } from "../../../../src/game/types";

function play(game: BattleState, definitionId: string, targetId?: string) {
  const card = game.cards.find((entry) => entry.definitionId === definitionId)!;
  return dispatch(game, { type: "play", cardId: card.id, targetId, autoEndTurn: false });
}

describe("Orifable and shared Food", () => {
  it("authors the selected kit, six delivery tiers and three neutral consumables", () => {
    expect(speciesCards("orifable").map((card) => [cardText(card), card.cost])).toEqual([
      ["Add 2 Food to your hand", 1],
      ["Restore 6 Health to the most injured ally", 1],
      ["Deal 2 Physical damage to all enemies", 1],
    ]);
    expect(species("orifable").passiveTiers.map((tier) => tier.effects[0]!.amount)).toEqual([
      50, 60, 70, 80, 90, 100,
    ]);
    expect(FOOD_CARDS.map((card) => [card.species, card.cost, cardText(card)])).toEqual([
      [null, 1, "Restore 6 Health; Consume"],
      [null, 1, "Gain 2 Mana; Consume"],
      [null, 1, "Gain 6 Block; Consume"],
    ]);
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
    expect(FIRST_RUN_STARTERS).not.toContain("orifable");
    expect(enemyCanUse(definition("orifable-createFood"))).toBe(false);
    expect(enemyCanUse(definition("orifable-heal"))).toBe(true);
    expect(enemyCanUse(definition("orifable-attack"))).toBe(true);
  });

  it.each([50, 60, 70, 80, 90, 100])("draws exactly once on success at the %i%% tier", (chance) => {
    const events: GameEvent[] = [];
    const game = produce(orifableBattle(), (draft) => {
      draft.discovery.recruited.orifable = (chance - 50) / 10 + 1;
      draft.rng = 0; // The first seeded roll is below every authored delivery chance
      expressDelivery(draft, events);
    });
    expect(game.battle.hand).toHaveLength(5);
    expect(events.filter((event) => event.text === "Express Delivery draws an extra card")).toHaveLength(1);
    expect(game.rng === 0).toBe(chance === 100);
  });

  it.each([50, 60, 70, 80, 90])("does not draw on a failed %i%% roll", (chance) => {
    const before = orifableBattle();
    const game = produce(before, (draft) => {
      draft.discovery.recruited.orifable = (chance - 50) / 10 + 1;
      draft.rng = 1900; // First seeded roll exceeds 97%, with no Good Fortune provider
      expressDelivery(draft, []);
    });
    expect(game.battle.hand).toEqual(before.battle.hand);
  });

  it("delivers on the opening and subsequent turns, without treating ordinary draws as new turns", () => {
    const ready = produce(orifableBattle(), (draft) => {
      draft.discovery.recruited.orifable = 6;
      prepareDestination(draft);
    });
    const started = dispatch(ready, { type: "beginBattle" });
    expect(started.accepted).toBe(true);
    expect(started.state.battle!.hand).toHaveLength(5);
    const ended = dispatch(started.state, { type: "endTurn" });
    expect(ended.accepted).toBe(true);
    expect(
      ended.events.filter((event) => event.text === "Express Delivery draws an extra card"),
    ).toHaveLength(1);
    const events: GameEvent[] = [];
    produce(requireBattle(ended.state), (draft) => {
      draw(draft, 1, events);
    });
    expect(events.some((event) => event.text.includes("Express Delivery"))).toBe(false);
  });

  it("does not deliver from a fallen or backup Orifable", () => {
    const before = orifableBattle();
    const game = produce(before, (draft) => {
      draft.discovery.recruited.orifable = 6;
      draft.team[0]!.health = 0;
      addBackups(draft, {
        id: "backup",
        species: "orifable",
        health: 26,
        block: 0,
        attacked: false,
        combat: freshCombat(),
      });
      expressDelivery(draft, []);
    });
    expect(game.battle.hand).toEqual(before.battle.hand);
  });

  it("creates two independent random Food cards, allows duplicates and preserves preview RNG", () => {
    const game = produce(orifableBattle(), (draft) => {
      draft.rng = 0;
    });
    const before = encodeSave(game);
    const id = game.cards.find((card) => card.definitionId === "orifable-createFood")!.id;
    const preview = previewCard(game, id);
    const played = play(game, "orifable-createFood");
    expect(preview).toEqual(played);
    expect(encodeSave(game)).toBe(before);
    const food = played.state.cards.filter((card) => card.ownerId === null);
    expect(food).toHaveLength(2);
    expect(food.map((card) => card.definitionId)).toEqual(["food-apple", "food-apple"]);
    expect(food.every((card) => card.temporary && card.level === 0)).toBe(true);
    expect(decodeSave(encodeSave(played.state))).toEqual(played.state);
  });

  it("heals the most injured ally and resolves one Physical hit against each enemy", () => {
    const game = orifableBattle();
    const healed = play(game, "orifable-heal");
    expect(healed.accepted).toBe(true);
    expect(healed.state.team.map((unit) => unit.health)).toEqual([20, 14, 18]);
    const ready = produce(game, (draft) => {
      draft.rng = 0;
      draft.battle.enemies.forEach((unit) => {
        unit.block = 0;
        unit.combat.armor = 0;
        unit.combat.controlled = "freeze";
        unit.combat.controlTurns = 1;
      });
    });
    const attacked = play(ready, "orifable-attack");
    expect(attacked.accepted).toBe(true);
    expect(
      attacked.state.battle!.enemies.map((unit, index) => ready.battle.enemies[index]!.health - unit.health),
    ).toEqual([2, 2, 2]);
    expect(attacked.state.battleXP.physical).toBe(1);
  });

  it.each(["food-apple", "food-mana-berries", "food-trail-bread"])(
    "uses and consumes %s without creature charges or repeats",
    (id) => {
      const game = produce(orifableBattle(true), (draft) => {
        draft.battle.mana = 2;
        draft.team[0]!.combat!.freeCard = true;
        draft.team[0]!.combat!.controlled = "freeze";
        draft.team[0]!.combat!.controlTurns = 1;
      });
      const card = game.cards.find((entry) => entry.definitionId === id)!;
      expect(cardCost(card, game)).toBe(1);
      expect(inspectCardPlay(game, card.id).allowed).toBe(true);
      const target = id === "food-mana-berries" ? undefined : game.team[1]!.id;
      const result = play(game, id, target);
      expect(result.accepted).toBe(true);
      expect(result.state.battle!.mana).toBe(id === "food-mana-berries" ? 3 : 1);
      expect(result.state.team[0]!.combat!.freeCard).toBe(true);
      expect(
        result.state.team.every(
          (unit) => unit.combat!.cardsPlayedThisTurn === 0 && unit.combat!.fallenCardsPlayedThisTurn === 0,
        ),
      ).toBe(true);
      if (id === "food-apple") expect(result.state.team[1]!.health).toBe(game.team[1]!.health + 6);
      if (id === "food-trail-bread") expect(result.state.team[1]!.block).toBe(6);
      expect(result.state.cards.some((entry) => entry.id === card.id)).toBe(false);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    },
  );

  it("retains shared Food across a creator knockout, ordinary swap and Legendary formation change", () => {
    for (const legendary of [false, true]) {
      const game = produce(orifableBattle(true), (draft) => {
        draft.team[0]!.health = 0;
        addBackups(draft, {
          id: "backup",
          species: legendary ? "memento" : "prismram",
          health: species(legendary ? "memento" : "prismram").health,
          block: 0,
          attacked: false,
          combat: freshCombat(),
        });
        swapBackup(draft, draft.team[0]!.id, "backup", []);
      });
      expect(game.cards.filter((card) => card.ownerId === null)).toHaveLength(3);
      const card = game.cards.find((card) => card.definitionId === "food-mana-berries")!;
      expect(inspectCardPlay(game, card.id).allowed).toBe(true);
      expect(decodeSave(encodeSave(game))).toEqual(game);
      expect(play(game, "food-mana-berries").accepted).toBe(true);
    }
  });

  it("copies neutral Food through Well Read without acquiring an owner", () => {
    const game = produce(requireBattle(teamRun(42, ["rookhaven", "emberback", "mossguard"])), (draft) => {
      draft.discovery.recruited.rookhaven = 6;
      createFood(draft, draft.team[0]!, 1, []);
      const food = draft.cards.find((card) => card.ownerId === null)!;
      draft.battle.hand = [];
      draft.battle.buffer = [];
      draft.battle.discard = [];
      draft.battle.draw = draft.cards
        .filter((card) => card.id !== food.id)
        .map((card) => card.id)
        .concat(food.id);
      draw(draft, 1);
    });
    expect(game.battle.hand).toHaveLength(2);
    expect(game.cards.filter((card) => card.ownerId === null)).toHaveLength(2);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });

  it("uses overflow and stops generation at the shared card limit without spending extra RNG", () => {
    const game = produce(orifableBattle(true), (draft) => {
      createFood(draft, draft.team[0]!, MAX_BATTLE_CARDS, []);
      expect(draft.cards).toHaveLength(MAX_BATTLE_CARDS);
      expect(draft.battle.hand).toHaveLength(6);
      expect(draft.battle.buffer.length).toBeGreaterThan(0);
      const rng = draft.rng;
      createFood(draft, draft.team[0]!, 2, []);
      expect(draft.rng).toBe(rng);
    });
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });

  it("rejects invalid targets and unaffordable plays without consuming Food or RNG", () => {
    const game = orifableBattle(true);
    const apple = game.cards.find((card) => card.definitionId === "food-apple")!;
    const badTarget = play(game, "food-apple", game.battle.enemies[0]!.id);
    expect(badTarget.accepted).toBe(false);
    expect(badTarget.state).toBe(game);
    const empty = produce(game, (draft) => {
      draft.battle.mana = 0;
    });
    const rejected = dispatch(empty, { type: "play", cardId: apple.id });
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(empty);
  });

  it("rejects forged neutral ownership, upgraded Food and obsolete saves", () => {
    for (const mutate of [
      (game: BattleState) => {
        game.cards.find((card) => card.ownerId !== null)!.ownerId = null;
      },
      (game: BattleState) => {
        game.cards.find((card) => card.ownerId === null)!.ownerId = game.team[0]!.id;
      },
      (game: BattleState) => {
        game.cards.find((card) => card.ownerId === null)!.level = 1;
      },
    ])
      expect(() => decodeSave(encodeSave(produce(orifableBattle(true), mutate)))).toThrow();
    const old = JSON.parse(encodeSave(orifableBattle(true)));
    old.version = 55;
    expect(() => decodeSave(JSON.stringify(old))).toThrow();
  });
});

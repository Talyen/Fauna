import {
  addReserve,
  accept,
  completeRecruitment,
  prepareDestination,
  requireBattle,
  teamRun,
  winBattle,
} from "../../../support/game";
import { playCard as play } from "../../../support/cards";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { aerostatBattle } from "../../../support/aerostat";
import { previewCard } from "../../../../src/game/engine";
import { definition, species, speciesCards, FIRST_RUN_STARTERS } from "../../../../src/game/content";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import { validateCatalog } from "../../../../src/game/content-validation";
import { draw, MAX_BATTLE_CARDS } from "../../../../src/game/card-zones";
import { createFood } from "../../../../src/game/combat/food";
import { freshCombat } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { swapBackup, swapFromCard } from "../../../../src/game/team";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { battleChoices } from "../../../../src/application/battle-policy";
import type { BattleState } from "../../../../src/game/types";

const rest = "aerostat-voyagers-rest";
const bearing = "aerostat-true-bearing";
const parcel = "aerostat-parcel-drop";
const food = (game: { cards: BattleState["cards"] }) => game.cards.filter((card) => card.ownerId === null);

function ready(amount = 1, copies = 1) {
  return produce(
    teamRun(
      42,
      copies === 2 ? ["aerostat", "aerostat", "emberback"] : ["aerostat", "emberback", "mossguard"],
    ),
    (draft) => {
      prepareDestination(draft);
      draft.discovery.recruited.aerostat = amount;
    },
  );
}

describe("Aerostat and battle provisions", () => {
  it("authors the chosen kit and six starting Food tiers", () => {
    expect(speciesCards("aerostat").map((card) => [cardText(card), card.cost])).toEqual([
      ["Gain 6 Block", 1],
      ["Draw 2 cards / Cleanse Blind from allies", 1],
      ["Add 2 Food to your hand", 1],
    ]);
    expect(species("aerostat").passiveTiers.map((tier) => tier.effects)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => [{ kind: "wellProvisioned", amount }]),
    );
    expect(FIRST_RUN_STARTERS).not.toContain("aerostat");
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it.each([1, 2, 3, 4, 5, 6])("shuffles %i Food into the deck before the opening draw", (amount) => {
    const before = ready(amount);
    const game = requireBattle(accept(before, { type: "beginBattle" }));
    expect(food(game)).toHaveLength(amount);
    expect(game.battle.hand).toHaveLength(4);
    expect(game.battle.draw.length + game.battle.hand.length).toBe(9 + amount);
    expect(
      food(game).every((card) => card.temporary && card.level === 0 && definition(card.definitionId).consume),
    ).toBe(true);
    expect(accept(before, { type: "beginBattle" })).toEqual(game);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });

  it("can draw the shuffled supplies in the opening hand rather than adding them after it", () => {
    expect(
      [1, 2, 3, 4, 5, 6].some((amount) => {
        const game = requireBattle(accept(ready(amount), { type: "beginBattle" }));
        return food(game).some((card) => game.battle.hand.includes(card.id));
      }),
    ).toBe(true);
  });

  it("adds each deployed provider's tier and excludes fallen and backup providers", () => {
    expect(food(accept(ready(4, 2), { type: "beginBattle" }))).toHaveLength(8);
    const destination = produce(ready(), (draft) => {
      draft.team[0]!.health = 0;
      addReserve(draft, "backup", "aerostat", 30);
    });
    expect(food(accept(destination, { type: "beginBattle" }))).toHaveLength(0);
  });

  it("does not provision again on resume, later turns or swapping back in", () => {
    const game = produce(aerostatBattle(), (draft) => {
      draft.battle.enemies.forEach((unit) => {
        unit.combat.controlled = "freeze";
        unit.combat.controlTurns = 1;
      });
      addReserve(draft, "backup", "prismram", 30, freshCombat());
    });
    const next = produce(
      requireBattle(accept(decodeSave(encodeSave(game)), { type: "endTurn" })),
      (draft) => {
        swapBackup(draft, "ally-0", "backup", []);
        swapBackup(draft, "backup", "ally-0", []);
      },
    );
    expect(food(next)).toHaveLength(1);
    expect(next.battle.copySerial).toBe(game.battle.copySerial);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("grants self Block and draws before removing only deployed allies' Blind", () => {
    const game = produce(aerostatBattle(), (draft) => {
      draft.team[1]!.combat!.poison = 3;
      draft.team[2]!.combat!.burn = 2;
      addReserve(draft, "backup", "prismram", 30, { ...freshCombat(), blind: true });
    });
    const guarded = play(game, rest);
    expect(guarded.accepted).toBe(true);
    expect(guarded.state.team.map((unit) => unit.block)).toEqual([6, 0, 0]);
    const result = play(game, bearing);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.hand).toHaveLength(5);
    expect(result.state.team.every((unit) => !unit.combat!.blind)).toBe(true);
    expect(result.state.team[1]!.combat!.poison).toBe(3);
    expect(result.state.team[2]!.combat!.burn).toBe(2);
    expect(result.state.reserves[0]!.combat!.blind).toBe(true);
    expect(previewCard(game, game.cards.find((card) => card.definitionId === bearing)!.id)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    const clear = produce(game, (draft) => {
      draft.team.forEach((unit) => {
        unit.combat!.blind = false;
      });
    });
    expect(
      battleChoices(clear, false).some(
        (choice) =>
          choice.type === "play" &&
          choice.cardId === clear.cards.find((card) => card.definitionId === bearing)!.id,
      ),
    ).toBe(true);
  });

  it("adds Parcel Drop Food to hand, overflows normally and stops at capacity without RNG", () => {
    const game = aerostatBattle();
    const result = play(game, parcel);
    expect(result.accepted).toBe(true);
    expect(food(result.state)).toHaveLength(3);
    expect(result.state.battle!.hand).toHaveLength(5);
    expect(previewCard(game, game.cards.find((card) => card.definitionId === parcel)!.id)).toEqual(result);
    const full = produce(game, (draft) => {
      createFood(draft, draft.team[0]!, MAX_BATTLE_CARDS, []);
      const rng = draft.rng;
      createFood(draft, draft.team[0]!, 2, []);
      expect(draft.rng).toBe(rng);
    });
    expect(full.battle.hand).toHaveLength(6);
    expect(full.battle.buffer.length).toBeGreaterThan(0);
    expect(decodeSave(encodeSave(full))).toEqual(full);
  });

  it("Consumes one Food through repeats and resume, then restores the starting count next battle", () => {
    const game = produce(aerostatBattle(), (draft) => {
      const supply = food(draft)[0]!;
      supply.definitionId = "food-trail-bread";
      draft.battle.hand = [supply.id, ...draft.battle.hand];
      draft.battle.draw = draft.battle.draw.filter((id) => id !== supply.id);
      draft.battle.repeatNext.player = true;
    });
    const id = food(game)[0]!.id;
    const played = play(game, "food-trail-bread", game.team[0]!.id);
    expect(played.accepted).toBe(true);
    expect(played.state.team[0]!.block).toBe(12);
    expect(played.state.cards.some((card) => card.id === id)).toBe(false);
    const resumed = requireBattle(decodeSave(encodeSave(played.state)));
    const drawn = produce(resumed, (draft) => {
      draw(draft, 20);
    });
    expect(drawn.cards.some((card) => card.id === id)).toBe(false);
    const next = completeRecruitment(winBattle(resumed));
    expect(food(next)).toHaveLength(0);
    const restored = requireBattle(accept(next, { type: "beginBattle" }));
    expect(food(restored)).toHaveLength(1);
    expect(decodeSave(encodeSave(restored))).toEqual(restored);
  });

  it("discards and redraws unplayed Food; rejects invalid Food targets without consuming state or RNG", () => {
    const game = produce(aerostatBattle(), (draft) => {
      const supply = food(draft)[0]!;
      supply.definitionId = "food-apple";
      draft.battle.hand = [supply.id];
      draft.battle.draw = draft.cards.filter((card) => card.id !== supply.id).map((card) => card.id);
      draft.battle.enemies.forEach((unit) => {
        unit.combat.controlled = "freeze";
        unit.combat.controlTurns = 1;
      });
    });
    const rejected = play(game, "food-apple", "missing");
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(game);
    const next = requireBattle(accept(game, { type: "endTurn" }));
    expect(food(next)).toHaveLength(1);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("scales the selected primary values and lets ordinary enemies clear Blind without a hand", () => {
    expect(cardText(definition(rest), 3)).toBe("Gain 12 Block");
    expect(cardText(definition(bearing), 3)).toBe("Draw 8 cards / Cleanse Blind from allies");
    expect(cardText(definition(parcel), 3)).toBe("Add 8 Food to your hand");
    expect(enemyCanUse(definition(bearing))).toBe(true);
    expect(enemyCanUse(definition(parcel))).toBe(false);
    const game = produce(aerostatBattle(), (draft) => {
      draft.battle.enemies.forEach((unit) => {
        unit.combat.blind = true;
      });
      executeAbility(
        draft,
        { side: "enemy", actor: draft.battle.enemies[0]!, def: definition(bearing), value: 2 },
        [],
        { swap: swapFromCard },
      );
    });
    expect(game.battle.enemies.every((unit) => !unit.combat.blind)).toBe(true);
    expect(game.team.every((unit) => unit.combat!.blind)).toBe(true);
    expect(food(game)).toHaveLength(1);
    expect(game.battle.hand).toHaveLength(4);
  });
});

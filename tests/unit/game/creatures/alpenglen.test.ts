import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { alpenglenBattle } from "../../../support/alpenglen";
import { addBackups, requireBattle, teamRun } from "../../../support/game";
import { definition, species, speciesCards, FIRST_RUN_STARTERS } from "../../../../src/game/content";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import { validateCatalog } from "../../../../src/game/content-validation";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { freshCombat, tickStatuses } from "../../../../src/game/combat/index";
import { lastWarmth } from "../../../../src/game/combat/card-modifiers";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { enemyCardValue } from "../../../../src/game/combat/enemy-policy";
import { createFood } from "../../../../src/game/combat/food";
import { observeDecisions } from "../../../../src/game/random";
import { ordinaryAttackFacts } from "../../../../src/game/ability-facts";
import { swapBackup, swapFromCard } from "../../../../src/game/team";
import type { BattleState, GameEvent } from "../../../../src/game/types";

const reversal = "alpenglen-sunset-reversal";
const ember = "alpenglen-ember-of-evening";
const charge = "alpenglen-last-light-charge";

function hand(game: BattleState, definitions: string[]) {
  return produce(game, (draft) => {
    draft.battle.hand = definitions.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle.discard = [];
    draft.battle.buffer = [];
  });
}
function play(game: BattleState, id: string, targetId?: string) {
  const card = game.cards.find((card) => card.definitionId === id)!;
  return dispatch(game, { type: "play", cardId: card.id, targetId, autoEndTurn: false });
}
const damage = (events: GameEvent[]) => events.filter((event) => event.kind === "damage");
const healthEvents = (events: GameEvent[]) => events.filter((event) => event.kind === "heal");

describe("Alpenglen and Last Warmth", () => {
  it("authors the selected kit, independent upgrades and six healing tiers", () => {
    expect(speciesCards("alpenglen").map((card) => [cardText(card), card.cost])).toEqual([
      ["Reflect the next attack", 1],
      ["Your next card is played twice", 1],
      ["Deal 4 Light damage / If this is the last card in your hand, it Critically Hits", 1],
    ]);
    expect(cardText(definition(charge), 2)).toContain("Deal 8 Light damage");
    expect(cardText(definition(ember), 2)).toBe("Your next card is played twice");
    expect(species("alpenglen").passiveTiers.map((tier) => tier.effects)).toEqual(
      [2, 3, 4, 5, 6, 7].map((amount) => [{ kind: "lastWarmth", amount }]),
    );
    expect(speciesCards("alpenglen").every(enemyCanUse)).toBe(true);
    expect(FIRST_RUN_STARTERS).not.toContain("alpenglen");
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it.each([2, 3, 4, 5, 6, 7])("restores %i Health after any ally plays the last card", (amount) => {
    const game = hand(alpenglenBattle(amount - 2), ["mossguard-guard"]);
    const result = play(game, "mossguard-guard");
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((unit) => unit.health)).toEqual([20, 12 + amount, 32]);
    expect(result.state.team[2]!.block).toBe(6);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("snapshots the last-card condition before drawing and does not heal on end-turn discard", () => {
    const drawing = produce(
      hand(requireBattle(teamRun(42, ["alpenglen", "rookhaven", "mossguard"])), [
        "rookhaven-margin-of-possibility",
      ]),
      (draft) => {
        draft.team[0]!.health = 20;
      },
    );
    const drawn = play(drawing, "rookhaven-margin-of-possibility");
    expect(drawn.accepted).toBe(true);
    expect(drawn.state.battle!.hand.length).toBeGreaterThan(0);
    expect(drawn.state.team[0]!.health).toBe(22);
    const spare = alpenglenBattle();
    expect(play(spare, reversal).state.team[1]!.health).toBe(12);
    const ended = dispatch(spare, { type: "endTurn" });
    expect(ended.accepted).toBe(true);
    expect(ended.state.team[1]!.health).toBe(12);
  });

  it("plays Ember then two Critical Hits as the final Charge, healing only once", () => {
    const game = hand(alpenglenBattle(), [ember, charge]);
    const primed = requireBattle(play(game, ember).state);
    expect(primed.battle.repeatNext.player).toBe(true);
    const result = play(primed, charge, primed.battle.enemies[0]!.id);
    expect(result.accepted).toBe(true);
    expect(damage(result.events).map((event) => [event.amount, event.critical])).toEqual([
      [8, true],
      [8, true],
    ]);
    expect(result.state.team[1]!.health).toBe(14);
    expect(healthEvents(result.events)).toHaveLength(1);
    expect(result.state.battle!.repeatNext.player).toBe(false);
    expect(result.state.battle!.mana).toBe(2);
    const card = primed.cards.find((card) => card.definitionId === charge)!;
    expect(previewCard(primed, card.id, primed.battle.enemies[0]!.id)).toEqual(result);
    expect(play(requireBattle(decodeSave(encodeSave(primed))), charge, primed.battle.enemies[0]!.id)).toEqual(
      result,
    );
  });

  it("does not guarantee a Critical Hit with another visible card, but ignores buffered future cards", () => {
    const game = alpenglenBattle();
    const ordinary = play(game, charge, game.battle.enemies[0]!.id);
    expect(damage(ordinary.events).map((event) => [event.amount, event.critical])).toEqual([[4, false]]);
    const buffered = produce(hand(game, [charge]), (draft) => {
      draft.battle.buffer = draft.battle.draw.splice(0, 1);
    });
    const result = play(buffered, charge, buffered.battle.enemies[0]!.id);
    expect(damage(result.events).map((event) => [event.amount, event.critical])).toEqual([[8, true]]);
    expect(result.state.battle!.hand).toHaveLength(1);
    expect(result.state.team[1]!.health).toBe(14);
    const def = definition(charge);
    if (def.effect !== "attack") throw new Error("Expected Charge");
    expect(
      ordinaryAttackFacts(buffered, buffered.team[0]!, def, 4, buffered.battle.enemies[0]!)[0]!.lost,
    ).toBe(8);
  });

  it("does not trigger from rejected commands or a fallen or backup Alpenglen", () => {
    const base = hand(alpenglenBattle(), ["mossguard-guard"]);
    const rejected = produce(base, (draft) => {
      draft.battle.mana = 0;
    });
    const result = play(rejected, "mossguard-guard");
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(rejected);
    for (const mode of ["fallen", "backup"] as const) {
      const game = produce(base, (draft) => {
        if (mode === "fallen") draft.team[0]!.health = 0;
        else {
          addBackups(draft, { id: "backup", species: "prismram", health: 30, block: 0, attacked: false });
          swapBackup(draft, "ally-0", "backup", []);
        }
      });
      expect(play(game, "mossguard-guard").state.team[1]!.health).toBe(12);
    }
  });

  it("keeps automatic healing active during control, caps Health and never revives", () => {
    const game = produce(hand(alpenglenBattle(5), ["mossguard-guard"]), (draft) => {
      draft.team[0]!.combat!.controlled = "freeze";
      draft.team[0]!.combat!.controlTurns = 1;
      draft.team[0]!.health = 29;
      draft.team[1]!.health = 0;
    });
    const result = play(game, "mossguard-guard");
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((unit) => unit.health)).toEqual([30, 0, 32]);
  });

  it("uses each deployed owner's tier and reselects the most injured recipient", () => {
    const game = produce(
      hand(requireBattle(teamRun(42, ["alpenglen", "alpenglen", "mossguard"])), ["mossguard-guard"]),
      (draft) => {
        draft.team[0]!.health = 29;
        draft.team[1]!.health = 28;
      },
    );
    const result = play(game, "mossguard-guard");
    expect(result.state.team.map((unit) => unit.health)).toEqual([30, 30, 32]);
  });

  it("allows shared Food as the final card and respects backup healing ownership", () => {
    const game = produce(alpenglenBattle(), (draft) => {
      createFood(draft, draft.team[0]!, 1, []);
      const food = draft.cards.find((card) => card.ownerId === null)!;
      food.definitionId = "food-trail-bread";
      draft.battle.hand = [food.id];
      draft.battle.buffer = [];
      draft.battle.draw = draft.cards.filter((card) => card.id !== food.id).map((card) => card.id);
      addBackups(draft, { id: "backup", species: "prismram", health: 1, block: 0, attacked: false });
    });
    expect(play(game, "food-trail-bread", "ally-0").state.team[1]!.health).toBe(14);
    expect(play(game, "food-trail-bread", "ally-0").state.reserves[0]!.health).toBe(1);
    const hammock = produce(game, (draft) => {
      draft.boons = ["camp-hammock"];
    });
    expect(play(hammock, "food-trail-bread", "ally-0").state.reserves[0]!.health).toBe(3);
  });

  it("reflects one attack, preserves that charge through ticks and saves, and leaves allies untouched", () => {
    const protectedGame = requireBattle(play(alpenglenBattle(), reversal).state);
    expect(protectedGame.team[0]!.combat!.attackReflection).toBe(true);
    const resumed = requireBattle(decodeSave(encodeSave(protectedGame)));
    const events: GameEvent[] = [];
    const result = produce(resumed, (draft) => {
      const source = draft.battle.enemies[0]!;
      const actor = draft.team[0]!;
      actor.block = 3;
      actor.combat!.burn = 2;
      tickStatuses(draft, actor, events);
      expect(actor.block).toBe(1);
      expect(actor.combat!.attackReflection).toBe(true);
      source.combat.controlled = null;
      source.combat.skipped = false;
      actor.combat!.controlled = "freeze";
      observeDecisions(draft, () => 0.99);
      executeAbility(
        draft,
        { side: "enemy", actor: source, def: definition(charge), value: 4, targetId: actor.id },
        events,
        { swap: swapFromCard },
      );
      expect(actor.combat!.attackReflection).toBe(false);
      expect(actor.health).toBe(20);
    });
    expect(result.battle.enemies[0]!.health).toBe(resumed.battle.enemies[0]!.health - 4);
    expect(result.team[1]!.health).toBe(12);
  });

  it("uses enemy base-tier healing and never treats ordinary enemies' missing hands as empty", () => {
    const game = produce(alpenglenBattle(5), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      enemy.species = "alpenglen";
      enemy.health = enemy.maxHealth = 30;
      enemy.combat.controlled = null;
      draft.battle.enemies[1]!.health = 1;
      lastWarmth(draft, true, []);
      expect(draft.battle.enemies[1]!.health).toBe(3);
      observeDecisions(draft, () => 0.99);
      const events: GameEvent[] = [];
      executeAbility(
        draft,
        { side: "enemy", actor: enemy, def: definition(charge), value: 4, targetId: "ally-0" },
        events,
        { swap: swapFromCard },
      );
      expect(damage(events).map((event) => event.critical)).toEqual([false]);
    });
    const before = encodeSave(game);
    expect(enemyCardValue(game, game.battle.enemies[0]!, definition(charge), "ally-0")).toBeGreaterThan(0);
    expect(encodeSave(game)).toBe(before);
  });
});

describe("Block against periodic damage", () => {
  it.each(["burn", "poison", "bleed"] as const)(
    "spends Block before Health for %s on both sides",
    (status) => {
      for (const side of ["player", "enemy"] as const) {
        const events: GameEvent[] = [];
        const game = produce(alpenglenBattle(), (draft) => {
          const target = side === "player" ? draft.team[0]! : draft.battle.enemies[0]!;
          target.combat = freshCombat();
          target.block = 3;
          target.combat[status] = 5;
          const before = target.health;
          tickStatuses(draft, target, events);
          expect(target.block).toBe(0);
          expect(target.health).toBe(before - 2);
          expect(target.combat[status]).toBe(status === "burn" ? 3 : status === "poison" ? 4 : 0);
        });
        expect(damage(events).map((event) => [event.amount, event.periodic, event.critical])).toEqual([
          [2, true, false],
        ]);
        expect(decodeSave(encodeSave(game))).toEqual(game);
      }
    },
  );

  it("fully absorbs sequential ticks without Dodge, Critical Hits, buildup or consuming attack protection", () => {
    const game = produce(alpenglenBattle(), (draft) => {
      const target = draft.team[0]!;
      target.combat = {
        ...freshCombat(),
        burn: 3,
        poison: 2,
        bleed: 1,
        negate: true,
        attackReflection: true,
      };
      target.block = 10;
      const rng = draft.rng;
      tickStatuses(draft, target, []);
      expect(target.block).toBe(4);
      expect(target.health).toBe(20);
      expect(target.combat).toMatchObject({
        burn: 2,
        poison: 1,
        bleed: 0,
        negate: true,
        attackReflection: true,
      });
      expect(draft.rng).toBe(rng);
    });
    expect(game.team[1]!.health).toBe(12);
  });

  it("retains Moss Oven Mitt's doubled efficiency on Burn ticks", () => {
    produce(alpenglenBattle(), (draft) => {
      draft.boons = ["moss-oven-mitt"];
      const target = draft.team[0]!;
      target.block = 3;
      target.combat!.burn = 7;
      tickStatuses(draft, target, []);
      expect(target.block).toBe(0);
      expect(target.health).toBe(19);
      expect(target.combat!.burn).toBe(4);
    });
  });

  it("pays deferred Bleed Leech from absorbed damage without inflating Armor or overkill", () => {
    produce(alpenglenBattle(), (draft) => {
      const source = draft.team[0]!;
      const target = draft.battle.enemies[0]!;
      target.block = 6;
      target.combat.bleed = 6;
      target.combat.statusSources.bleed = source.id;
      target.combat.bleedLeech = [{ sourceId: source.id, amount: 6 }];
      const health = target.health;
      tickStatuses(draft, target, []);
      expect(target.health).toBe(health);
      expect(target.block).toBe(0);
      expect(source.health).toBe(23);
      expect(target.combat.bleedLeech).toEqual([]);
    });
  });
});

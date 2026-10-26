import { addReserve } from "../../../support/game";
import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { freshCombat, startAction } from "../../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { definitionKeywords } from "../../../../src/game/keywords";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { swapBackup, swapFromCard } from "../../../../src/game/team";
import { rankedBattleChoices } from "../../../../src/application/battle-policy";
import { skybexBattle } from "../../../support/skybex";

const cloudstep = (state: ReturnType<typeof skybexBattle>) => ({
  type: "play" as const,
  cardId: state.cards.find((card) => card.definitionId === "skybex-cloudstep")!.id,
  autoEndTurn: false,
});

describe("Skybex", () => {
  it("authors the selected kit, costs, keywords, enemy support and six replacement tiers", () => {
    expect(speciesCards("skybex").map((card) => [cardText(card), card.cost, enemyCanUse(card)])).toEqual([
      ["Draw 2 cards", 1, false],
      ["Swap out for a random ally / Incoming ally gains 20% Dodge until next turn", 1, true],
      ["Deal 2 Nature damage to all enemies", 1, true],
    ]);
    expect(species("skybex").passiveTiers.map((tier) => tier.description)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => `Allies gain ${amount} Block when they swap in`),
    );
    expect(definitionKeywords(definition("skybex-cloudstep"))).toEqual(["dodge"]);
    expect(cardText(definition("skybex-cloudstep"), 2, undefined, 2)).toContain("24% Dodge");
  });

  it.each([0, 1, 2, 3, 4, 5])(
    "protects the incoming backup at rank %s with matching preview and resume",
    (rank) => {
      const state = produce(skybexBattle(), (draft) => {
        draft.discovery.recruited.skybex = rank + 1;
      });
      const before = encodeSave(state);
      const command = cloudstep(state);
      const preview = previewCard(state, command.cardId);
      expect(encodeSave(state)).toBe(before);
      const result = dispatch(state, command);
      expect(result.accepted).toBe(true);
      expect(result.events).toEqual(preview!.events);
      const incoming = result.state.team.find((unit) => unit.id === "skybex-backup")!;
      expect(incoming.block).toBe(rank + 1);
      expect(incoming.combat!.temporaryDodge).toBe(20);
      expect(result.state.reserves.find((unit) => unit.id === "ally-0")!.combat!.temporaryDodge).toBe(0);
      expect(result.state.battle!.mana).toBe(state.battle.mana - 1);
      expect(result.state.battleXP.dodge).toBe(1);
      const restored = decodeSave(encodeSave(result.state));
      expect(restored).toEqual(result.state);
      expect(restored.team.find((unit) => unit.id === incoming.id)!.block).toBe(rank + 1);
    },
  );

  it("supports swaps between deployed allies when there is no living backup", () => {
    const state = produce(skybexBattle(), (draft) => {
      draft.reserves = [];
    });
    const result = dispatch(state, cloudstep(state));
    expect(result.accepted).toBe(true);
    const incoming = result.state.team[0]!;
    expect(incoming.id).not.toBe("ally-0");
    expect(incoming.block).toBe(1);
    expect(incoming.combat!.temporaryDodge).toBe(20);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(
      rankedBattleChoices(state).some(
        (choice) => choice.command.type === "play" && choice.command.cardId === cloudstep(state).cardId,
      ),
    ).toBe(true);
  });

  it("does not protect a solo creature when no swap can occur", () => {
    const state = produce(skybexBattle(), (draft) => {
      draft.team.splice(1).forEach((unit) => draft.reserves.push({ ...unit, health: 0 }));
      draft.reserves.forEach((unit) => {
        unit.health = 0;
      });
      draft.cards = draft.cards.filter((card) => card.ownerId === "ally-0");
      draft.battle.hand = draft.cards.map((card) => card.id);
      draft.battle.draw = [];
    });
    const result = dispatch(state, cloudstep(state));
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.block).toBe(0);
    expect(result.state.team[0]!.combat!.temporaryDodge).toBe(0);
    expect(result.state.rng).toBe(state.rng);
    expect(
      rankedBattleChoices(state).some(
        (choice) => choice.command.type === "play" && choice.command.cardId === cloudstep(state).cardId,
      ),
    ).toBe(false);
  });

  it("does not repeat a swap through a departed actor or grant a second protection", () => {
    const state = skybexBattle();
    const ordinary = dispatch(state, cloudstep(state));
    const repeated = dispatch(
      produce(state, (draft) => {
        draft.battle.repeatNext.player = true;
      }),
      cloudstep(state),
    );
    expect(repeated.accepted).toBe(true);
    expect(repeated.state.team).toEqual(ordinary.state.team);
    expect(repeated.state.reserves).toEqual(ordinary.state.reserves);
    expect(repeated.state.rng).toBe(ordinary.state.rng);
    expect(repeated.state.battleXP.dodge).toBe(1);
    expect(repeated.events.filter((event) => event.kind === "block")).toHaveLength(1);
    expect(decodeSave(encodeSave(repeated.state))).toEqual(repeated.state);
  });

  it("grants Mountain Guide on knockout replacement while preserving rejected commands", () => {
    const state = produce(skybexBattle(), (draft) => {
      draft.team[1]!.health = 0;
    });
    const rejected = dispatch(state, cloudstep(state));
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(state);
    expect(rejected.events).toEqual([]);
    const result = dispatch(state, {
      type: "swap",
      activeId: "ally-1",
      reserve: "skybex-backup",
      autoEndTurn: false,
    });
    expect(result.accepted).toBe(true);
    expect(result.state.team[1]!.block).toBe(1);
    expect(result.state.team[1]!.combat!.temporaryDodge).toBe(0);
    expect(result.state.battle!.mana).toBe(state.battle.mana);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("ignores dead and inactive guides and grants protection when Skybex itself arrives", () => {
    const state = produce(skybexBattle(), (draft) => {
      draft.team[0]!.health = 0;
      swapBackup(draft, "ally-1", "skybex-backup", []);
    });
    expect(state.team[1]!.block).toBe(0);
    const restoredGuide = produce(state, (draft) => {
      draft.team[0]!.health = 26;
      swapBackup(draft, "ally-0", "ally-1", []);
    });
    expect(restoredGuide.team[0]!.block).toBe(1);
    const inactive = produce(restoredGuide, (draft) => {
      addReserve(draft, "inactive-guide-backup", "pollenmoth", 23, freshCombat());
      swapBackup(draft, "ally-2", "inactive-guide-backup", []);
    });
    expect(inactive.team[2]!.block).toBe(0);
    const returned = produce(restoredGuide, (draft) => {
      swapBackup(draft, "ally-1", "ally-0", []);
    });
    expect(returned.team[0]!.block).toBe(1);
  });

  it("combines deployed guides and supports a Legendary arriving through the formation owner", () => {
    const state = produce(skybexBattle(), (draft) => {
      draft.team[1]!.species = "skybex";
      // This direct boundary case does not serialize the deliberately replaced kit.
      swapBackup(draft, "ally-2", "skybex-backup", []);
    });
    expect(state.team[2]!.block).toBe(2);
    const legendary = produce(skybexBattle(), (draft) => {
      addReserve(draft, "legendary-backup", "memento", 60, freshCombat());
      swapBackup(draft, "ally-0", "legendary-backup", []);
    });
    expect(legendary.team.map((unit) => unit.id)).toEqual(["legendary-backup"]);
    expect(legendary.team[0]!.block).toBe(1);
    expect(decodeSave(encodeSave(legendary))).toEqual(legendary);
  });

  it("uses the enemy's base passive and expires incoming Dodge through the ordinary turn owner", () => {
    const state = produce(skybexBattle(), (draft) => {
      draft.discovery.recruited.skybex = 6;
      draft.battle.enemies[0]!.species = "skybex";
      draft.battle.enemies[0]!.name = "Skybex";
      executeAbility(
        draft,
        { side: "enemy", actor: draft.battle.enemies[0]!, def: definition("skybex-cloudstep"), value: 20 },
        [],
        { swap: swapFromCard },
      );
    });
    const incoming = state.battle.enemies[0]!;
    expect(incoming.species).not.toBe("skybex");
    expect(incoming.block).toBe(1);
    expect(incoming.combat.temporaryDodge).toBe(20);
    expect(state.team.every((unit) => unit.block === 0)).toBe(true);
    const advanced = produce(state, (draft) => {
      startAction(draft.battle.enemies[0]!, [], draft);
    });
    expect(advanced.battle.enemies[0]!.combat.temporaryDodge).toBe(0);
  });

  it("draws two cards with Far Horizon and damages the opposing row with Sky Shepherd", () => {
    const initial = produce(skybexBattle(), (draft) => {
      draft.battle.hand = [draft.cards.find((card) => card.definitionId === "skybex-draw")!.id];
      draft.battle.draw = draft.cards
        .filter((card) => !draft.battle.hand.includes(card.id))
        .map((card) => card.id);
    });
    const drawn = dispatch(initial, { type: "play", cardId: initial.battle.hand[0]!, autoEndTurn: false });
    expect(drawn.accepted).toBe(true);
    expect(drawn.state.battle!.hand).toHaveLength(2);
    const state = skybexBattle();
    const card = state.cards.find((card) => card.definitionId === "skybex-sky-shepherd")!;
    const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    const damage = result.events.filter((event) => event.kind === "damage" && event.damageType === "nature");
    expect(damage).toHaveLength(3);
    expect(damage.every((event) => state.battle.enemies.some((enemy) => enemy.id === event.targetId))).toBe(
      true,
    );
    expect(result.state.battleXP.nature).toBe(1);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
});

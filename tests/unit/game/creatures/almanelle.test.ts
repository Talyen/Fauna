import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { definition, FIRST_RUN_STARTERS, species, speciesCards } from "../../../../src/game/content";
import { cardText, enemyCanUse, enemyCard } from "../../../../src/game/card-rules";
import { actionValue, enemyAbilityValue } from "../../../../src/game/ability-rules";
import { cardKeywords } from "../../../../src/game/progression";
import { freshCombat, hit } from "../../../../src/game/combat/index";
import { STACK_LIMIT } from "../../../../src/game/combat/state";
import { decayBlock } from "../../../../src/game/combat/turns";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { battleChoices } from "../../../../src/application/battle-policy";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { swapFromCard } from "../../../../src/game/team";
import { COMBAT_PACKS } from "../../../../src/game/encounters";
import { almanelleBattle } from "../../../support/almanelle";
import {
  accept,
  addBackups,
  authoredPack,
  prepareDestination,
  requireBattle,
  winBattle,
} from "../../../support/game";
import type { BattleState, GameEvent } from "../../../../src/game/types";

const current = "almanelle-spring-current";
const insight = "almanelle-autumn-insight";
const rooted = "almanelle-rooted-year";
function play(game: BattleState, id: string, targetId?: string) {
  return dispatch(game, {
    type: "play",
    cardId: game.cards.find((card) => card.definitionId === id)!.id,
    targetId,
    autoEndTurn: false,
  });
}
function execute(game: BattleState, id: string, events: GameEvent[] = [], repeat = false) {
  const def = definition(id);
  executeAbility(
    game,
    {
      side: "player",
      actor: game.team[0]!,
      def: repeat ? { ...def, repeatChance: 100 } : def,
      value: def.value,
      targetId: game.battle.enemies[0]!.id,
      allyTargetId: game.team[2]!.id,
    },
    events,
    { swap: swapFromCard },
  );
}

describe("Almanelle", () => {
  it.each([50, 60, 70, 80, 90, 100])(
    "converts %i percent of Block actually lost to decay using the complete tier",
    (percent) => {
      const events: GameEvent[] = [];
      const game = produce(almanelleBattle(), (draft) => {
        draft.discovery.recruited.almanelle = 1 + (percent - 50) / 10;
        const actor = draft.team[0]!;
        actor.block = 20;
        actor.combat!.thorns = 3;
        decayBlock(draft, actor, events);
      });
      expect(game.team[0]!.block).toBe(10);
      expect(game.team[0]!.combat!.thorns).toBe(3 + percent / 10);
      expect(events).toContainEqual(
        expect.objectContaining({ kind: "status", status: "thorns", amount: percent / 10 }),
      );
      expect(game.rng).toBe(almanelleBattle().rng);
      expect(decodeSave(encodeSave(game))).toEqual(game);
    },
  );

  it("uses normal rounding and grants nothing when no Block decays or its owner is knocked out", () => {
    const result = produce(almanelleBattle(), (draft) => {
      const actor = draft.team[0]!;
      actor.block = 3;
      decayBlock(draft, actor, []);
      expect(actor.block).toBe(2);
      expect(actor.combat!.thorns).toBe(1);
      actor.block = 1;
      decayBlock(draft, actor, []);
      expect(actor.block).toBe(1);
      expect(actor.combat!.thorns).toBe(1);
      actor.block = 0;
      decayBlock(draft, actor, []);
      expect(actor.combat!.thorns).toBe(1);
      actor.block = 10;
      actor.health = 0;
      decayBlock(draft, actor, []);
    });
    expect(result.team[0]!.combat!.thorns).toBe(1);
  });

  it("converts in the real turn lifecycle after periodic damage and before the next player action", () => {
    const ready = produce(almanelleBattle(), (draft) => {
      draft.team[0]!.block = 20;
      draft.battle.enemies.forEach((enemy) => {
        enemy.combat.controlled = "freeze";
        enemy.combat.controlTurns = 1;
      });
    });
    const ended = dispatch(ready, { type: "endTurn" });
    expect(ended.accepted).toBe(true);
    expect(ended.state.team[0]!).toMatchObject({ health: 19, block: 10, combat: { thorns: 5 } });
    const burnIndex = ended.events.findIndex(
      (event) => event.kind === "damage" && event.targetId === "ally-0",
    );
    const leafIndex = ended.events.findIndex((event) => event.kind === "status" && event.status === "thorns");
    expect(burnIndex).toBeLessThan(leafIndex);
    expect(decodeSave(encodeSave(ended.state))).toEqual(ended.state);
  });

  it("does not convert Block spent absorbing an attack and leaves other creatures' decay unchanged", () => {
    const game = produce(almanelleBattle(), (draft) => {
      draft.team[0]!.block = 20;
      hit(draft, draft.battle.enemies[0]!, draft.team[0]!, 4, "water", [], {
        origin: "ability",
        blindMiss: false,
      });
      expect(draft.team[0]!.block).toBe(16);
      expect(draft.team[0]!.combat!.thorns).toBe(0);
      draft.team[1]!.block = 20;
      decayBlock(draft, draft.team[1]!, []);
    });
    expect(game.team[1]!.block).toBe(10);
    expect(game.team[1]!.combat!.thorns).toBe(0);
  });

  it("caps Thorns and handles independent deployed and reserve individuals without sharing an aura", () => {
    const game = produce(almanelleBattle(), (draft) => {
      draft.team[0]!.block = 20;
      draft.team[0]!.combat!.thorns = STACK_LIMIT - 2;
      addBackups(draft, {
        id: "backup",
        species: "almanelle",
        health: 28,
        block: 20,
        attacked: false,
        combat: freshCombat(),
      });
      decayBlock(draft, draft.team[0]!, []);
      decayBlock(draft, draft.reserves[0]!, []);
    });
    expect(game.team[0]!.combat!.thorns).toBe(STACK_LIMIT);
    expect(game.reserves[0]!.combat!.thorns).toBe(5);
    expect(game.team[1]!.combat!.thorns).toBe(0);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });

  it("uses the enemy base tier before its action without reading the player's Collection rank", () => {
    const ready = produce(almanelleBattle(), (draft) => {
      prepareDestination(draft);
      draft.discovery.recruited.almanelle = 6;
      draft.expedition = {
        recruit: null,
        lastRoom: null,
        pack: authoredPack(
          draft.encounter,
          COMBAT_PACKS.findIndex((pack) => pack[0] === "almanelle"),
        ),
      };
    });
    const battle = requireBattle(accept(ready, { type: "beginBattle" }));
    const setup = produce(battle, (draft) => {
      draft.battle.enemies[0]!.block = 20;
    });
    const ended = dispatch(setup, { type: "endTurn" });
    const enemy = ended.state.battle!.enemies[0]!;
    const leafIndex = ended.events.findIndex(
      (event) => event.kind === "status" && event.status === "thorns" && event.targetId === enemy.id,
    );
    const actionIndex = ended.events.findIndex(
      (event) => event.kind === "action" && event.actorId === enemy.id,
    );
    expect(ended.events[leafIndex]).toMatchObject({ amount: 5 });
    expect(leafIndex).toBeLessThan(actionIndex);
    expect(decodeSave(encodeSave(ended.state))).toEqual(ended.state);
  });

  it("grants Rooted Year's self Block and Thorns with preview parity and one Mana cost", () => {
    const game = almanelleBattle();
    const before = encodeSave(game);
    const result = play(game, rooted);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!).toMatchObject({ block: 3, combat: { thorns: 3 } });
    expect(result.state.team[2]!.block).toBe(0);
    expect(result.state.battle!.mana).toBe(3);
    const card = game.cards.find((card) => card.definitionId === rooted)!;
    expect(previewCard(game, card.id)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(play(game, rooted, game.team[2]!.id).state).toBe(game);
    const repeated = produce(game, (draft) => {
      execute(draft, rooted, [], true);
    });
    expect(repeated.team[0]!).toMatchObject({ block: 6, combat: { thorns: 6 } });
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("keeps Spring Current's self-Cleanse and damage aligned with its preview", () => {
    const game = almanelleBattle();
    const result = play(game, current, game.battle.enemies[0]!.id);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.combat!.burn).toBe(0);
    expect(result.state.battle!.enemies[0]!.health).toBeLessThan(game.battle.enemies[0]!.health);
    const card = game.cards.find((card) => card.definitionId === current)!;
    expect(previewCard(game, card.id, game.battle.enemies[0]!.id)).toEqual(result);
    expect(cardKeywords({ definitionId: current })).toEqual(["water", "health"]);
  });

  it("recovers a random card then heals the chosen ally, with authoritative previews and save round trips", () => {
    const game = almanelleBattle();
    const before = encodeSave(game);
    const result = play(game, insight, "ally-2");
    expect(result.accepted).toBe(true);
    expect(result.state.team[2]!.health).toBe(15);
    expect(result.state.team[0]!.health).toBe(22);
    expect(result.state.cards).toEqual(game.cards);
    expect(result.state.battle!.hand).toHaveLength(game.battle.hand.length);
    const recoveryIndex = result.events.findIndex(
      (event) => event.kind === "action" && event.text.includes("returns to your hand"),
    );
    const healIndex = result.events.findIndex((event) => event.kind === "heal");
    expect(recoveryIndex).toBeGreaterThan(-1);
    expect(recoveryIndex).toBeLessThan(healIndex);
    const card = game.cards.find((card) => card.definitionId === insight)!;
    expect(previewCard(game, card.id, "ally-2")).toEqual(result);
    expect(play(game, insight, "ally-2")).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(cardText(definition(insight))).toBe(
      "Return a random discarded card to your hand; Restore 3 Health to an injured ally",
    );
    expect(battleChoices(game, false)).toContainEqual(
      expect.objectContaining({ type: "play", cardId: card.id, targetId: "ally-2" }),
    );
  });

  it("rejects unavailable recipients without changing RNG and preserves utility when healing caps", () => {
    const game = almanelleBattle();
    expect(play(game, insight).state).toBe(game);
    expect(play(game, insight, game.battle.enemies[0]!.id).state).toBe(game);
    const dead = produce(game, (draft) => {
      draft.team[2]!.health = 0;
    });
    expect(play(dead, insight, "ally-2").state).toBe(dead);
    const poor = produce(game, (draft) => {
      draft.battle.mana = 0;
    });
    expect(play(poor, insight, "ally-2").state).toBe(poor);
    const capped = produce(game, (draft) => {
      draft.team[2]!.health = 31;
    });
    expect(play(capped, insight, "ally-2").state.team[2]!.health).toBe(32);
    const full = produce(game, (draft) => {
      draft.team[2]!.health = 32;
    });
    const recovered = play(full, insight, "ally-2");
    expect(recovered.accepted).toBe(true);
    expect(recovered.state.battle!.hand).toHaveLength(full.battle.hand.length);
    expect(recovered.state.team[2]!.health).toBe(32);
    expect(
      recovered.events.filter((event) => event.kind === "heal").every((event) => event.amount === 0),
    ).toBe(true);
  });

  it("preserves recovery ownership, overflow and fixed healing through upgrades and repeats", () => {
    const game = produce(almanelleBattle(), (draft) => {
      const card = draft.cards.find((card) => card.definitionId === insight)!;
      card.level = 2;
      draft.battle.hand.push(...draft.battle.draw.splice(0, 2));
      execute(draft, insight, [], true);
    });
    expect(game.team[2]!.health).toBe(18);
    expect(game.battle.hand).toHaveLength(6);
    expect(game.battle.buffer).toHaveLength(1);
    const ids = (["hand", "buffer", "draw", "discard"] as const).flatMap((zone) => game.battle[zone]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(game.cards.length);
    expect(cardText(definition(insight), 2)).toContain("Restore 3 Health");
  });

  it("adapts enemy recovery into healing an injured ally without requiring a hand", () => {
    const game = produce(almanelleBattle(), (draft) => {
      const actor = draft.battle.enemies[0]!;
      actor.species = "almanelle";
      actor.power = 1;
      const recipient = draft.battle.enemies[1]!;
      recipient.health -= 10;
      const def = enemyCard(definition(insight));
      executeAbility(
        draft,
        { side: "enemy", actor, def, value: enemyAbilityValue(actor, def), allyTargetId: recipient.id },
        [],
        { swap: swapFromCard },
      );
    });
    expect(game.battle.enemies[1]!.health).toBe(almanelleBattle().battle.enemies[1]!.health - 7);
    expect(enemyCard(definition(insight))).toMatchObject({
      effect: "heal",
      target: undefined,
      value: 3,
      effects: [],
    });
    expect(speciesCards("almanelle").every(enemyCanUse)).toBe(true);
    expect(enemyAbilityValue({ species: "almanelle", power: 2 }, enemyCard(definition(insight)))).toBe(6);
  });

  it("keeps Rooted Year's supplemental Thorns fixed while upgrades scale primary Block", () => {
    const game = almanelleBattle();
    const actor = game.team[0]!;
    const value = actionValue(
      { id: "upgraded", definitionId: rooted, ownerId: actor.id, level: 2 },
      actor,
      game,
    );
    expect(value).toBe(7);
    expect(cardText(definition(rooted), 2)).toBe("Gain 7 Block; Gain 3 Thorns");
    expect(enemyAbilityValue({ species: "almanelle", power: 2 }, definition(rooted))).toBe(6);
    expect(speciesCards("almanelle").map((def) => def.cost)).toEqual([1, 1, 1]);
    expect(FIRST_RUN_STARTERS).not.toContain("almanelle");
    expect(species("almanelle").health).toBe(28);
  });

  it("can be encountered, recruited and resumed through the normal journey boundary", () => {
    const ready = produce(almanelleBattle(), (draft) => {
      prepareDestination(draft);
      draft.expedition = {
        recruit: null,
        lastRoom: null,
        pack: authoredPack(
          draft.encounter,
          COMBAT_PACKS.findIndex((pack) => pack[0] === "almanelle"),
        ),
      };
    });
    const battle = accept(ready, { type: "beginBattle" });
    expect(battle.discovery.encountered).toContain("almanelle");
    expect(decodeSave(encodeSave(battle))).toEqual(battle);
    const recruited = accept(winBattle(battle), { type: "recruit", species: "almanelle" });
    expect(recruited.discovery.recruited.almanelle).toBe(2);
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
  });
});

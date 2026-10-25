import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { definition, FIRST_RUN_STARTERS, species, speciesCards } from "../../../../src/game/content";
import { cardTargeting, cardText, enemyCard, enemyCanUse } from "../../../../src/game/card-rules";
import { actionValue, enemyAbilityValue } from "../../../../src/game/ability-rules";
import { cardKeywords } from "../../../../src/game/progression";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { freshCombat } from "../../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { swapBackup, swapFromCard } from "../../../../src/game/team";
import { battleChoices } from "../../../../src/application/battle-policy";
import { COMBAT_PACKS } from "../../../../src/game/encounters";
import { dulceraBattle } from "../../../support/dulcera";
import {
  accept,
  addBackups,
  authoredPack,
  prepareDestination,
  requireBattle,
  teamRun,
  winBattle,
} from "../../../support/game";
import type { BattleState, GameEvent } from "../../../../src/game/types";

const chapel = "dulcera-chapel-light";
const meadow = "dulcera-meadow-shelter";
const hush = "dulcera-hushed-waters";
function play(game: BattleState, id: string) {
  return dispatch(game, {
    type: "play",
    cardId: game.cards.find((card) => card.definitionId === id)!.id,
    autoEndTurn: false,
  });
}

describe("Dulcera", () => {
  it("combines passage with Mountain Guide and repeats Cleanse without exchanging the departed actor again", () => {
    const game = produce(requireBattle(teamRun(42, ["dulcera", "skybex", "mossguard"])), (draft) => {
      addBackups(draft, {
        id: "backup",
        species: "coralcurl",
        health: 12,
        block: 0,
        attacked: false,
        combat: { ...freshCombat(), poison: 4 },
      });
      draft.battle.repeatNext.player = true;
      const card = draft.cards.find((entry) => entry.definitionId === hush)!;
      draft.battle.hand = [card.id];
      draft.battle.buffer = [];
      draft.battle.discard = [];
      draft.battle.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    });
    const result = play(game, hush);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!).toMatchObject({
      id: "backup",
      health: 13,
      block: 1,
      combat: { poison: 0 },
    });
    expect(
      result.events.filter((event) => event.kind === "action" && event.actionType === "swap"),
    ).toHaveLength(1);
    expect(result.events.filter((event) => event.kind === "heal")).toHaveLength(1);
    expect(result.state.battle!.repeatNext.player).toBe(false);
    expect(previewCard(game, game.battle.hand[0]!)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it.each([1, 2, 3, 4, 5, 6])("heals an arriving ally by %i with preview and resume parity", (amount) => {
    const game = produce(dulceraBattle(), (draft) => {
      draft.discovery.recruited.dulcera = amount;
    });
    const before = encodeSave(game);
    const result = play(game, hush);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!).toMatchObject({ id: "backup-coralcurl", health: 12 + amount });
    const card = game.cards.find((card) => card.definitionId === hush)!;
    expect(previewCard(game, card.id)).toEqual(result);
    expect(play(requireBattle(decodeSave(before)), hush)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("swaps before cleansing the arriving and remaining allies, leaving the outgoing backup unchanged", () => {
    const game = produce(dulceraBattle(), (draft) => {
      Object.assign(draft.reserves[0]!.combat!, {
        burn: 3,
        poison: 4,
        bleed: 5,
        stun: 6,
        freeze: 7,
        blind: true,
        controlled: "freeze",
        controlTurns: 1,
      });
    });
    const result = play(game, hush);
    expect(result.accepted).toBe(true);
    expect(result.state.reserves[0]!).toMatchObject({ species: "dulcera", combat: { burn: 3 } });
    expect(result.state.team[0]!.combat).toMatchObject({
      burn: 0,
      poison: 0,
      bleed: 0,
      stun: 0,
      freeze: 0,
      blind: false,
      controlled: null,
    });
    expect(result.state.team[1]!.combat!.poison).toBe(0);
    expect(result.state.battle!.mana).toBe(3);
    const swap = result.events.findIndex((event) => event.kind === "action" && event.actionType === "swap");
    const heal = result.events.findIndex((event) => event.kind === "heal");
    const cleanse = result.events.findIndex((event) => event.kind === "status" && event.status === "cleanse");
    expect(swap).toBeLessThan(heal);
    expect(heal).toBeLessThan(cleanse);
    expect(result.events).toContainEqual(
      expect.objectContaining({ kind: "heal", targetId: "backup-coralcurl", amount: 1 }),
    );
  });

  it("still Cleanses without a living backup, without rearranging allies or spending RNG", () => {
    const game = dulceraBattle(false);
    const result = play(game, hush);
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((unit) => unit.id)).toEqual(game.team.map((unit) => unit.id));
    expect(result.state.team[0]!.combat!.burn).toBe(0);
    expect(result.state.team[1]!.combat!.poison).toBe(0);
    expect(result.state.rng).toBe(game.rng);
    expect(result.events.some((event) => event.kind === "heal")).toBe(false);
    expect(result.events.some((event) => event.kind === "action" && event.actionType === "swap")).toBe(false);
    const clean = produce(game, (draft) => {
      draft.team.forEach((unit) => (unit.combat = freshCombat()));
    });
    expect(
      battleChoices(clean).some((command) => command.type === "play" && command.cardId.endsWith(hush)),
    ).toBe(false);
    expect(
      battleChoices(game).some((command) => command.type === "play" && command.cardId.endsWith(hush)),
    ).toBe(true);
  });

  it("heals other creatures' swaps and stacks living deployed providers", () => {
    const events: GameEvent[] = [];
    const game = produce(requireBattle(teamRun(42, ["dulcera", "dulcera", "mossguard"])), (draft) => {
      draft.discovery.recruited.dulcera = 3;
      addBackups(draft, {
        id: "backup",
        species: "coralcurl",
        health: 10,
        block: 0,
        attacked: false,
        combat: freshCombat(),
      });
      swapFromCard(draft, draft.team[2]!, events);
    });
    expect(game.team[2]!.health).toBe(16);
    expect(events.filter((event) => event.kind === "heal").map((event) => event.amount)).toEqual([3, 3]);
  });

  it("heals a knockout replacement through the same owner", () => {
    const game = produce(dulceraBattle(), (draft) => {
      draft.team[1]!.health = 0;
    });
    const result = dispatch(game, {
      type: "swap",
      activeId: "ally-1",
      reserve: "backup-coralcurl",
      autoEndTurn: false,
    });
    expect(result.accepted).toBe(true);
    expect(result.state.team[1]!.health).toBe(13);
    expect(result.state.battle!.mana).toBe(game.battle.mana);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("allows Dulcera's own arrival and Legendary formation changes to receive passage", () => {
    const game = produce(dulceraBattle(), (draft) => {
      swapBackup(draft, "ally-0", "backup-coralcurl", []);
      draft.reserves[0]!.health = 10;
      swapBackup(draft, "backup-coralcurl", "ally-0", []);
      expect(draft.team[0]!.health).toBe(11);
      addBackups(draft, {
        id: "legendary",
        species: "memento",
        health: 10,
        block: 0,
        attacked: false,
        combat: freshCombat(),
      });
      swapBackup(draft, "ally-0", "legendary", []);
    });
    expect(game.team).toHaveLength(1);
    expect(game.team[0]!).toMatchObject({ species: "memento", health: 11 });
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });

  it("does not grant passage from fallen or unrelated backup Dulceras or mere position swaps", () => {
    const inactive = produce(dulceraBattle(), (draft) => {
      draft.team[0]!.health = 0;
      swapBackup(draft, "ally-1", "backup-coralcurl", []);
    });
    expect(inactive.team[1]!.health).toBe(12);
    const resting = produce(dulceraBattle(), (draft) => {
      swapBackup(draft, "ally-0", "backup-coralcurl", []);
      addBackups(draft, {
        id: "backup",
        species: "dunefox",
        health: 10,
        block: 0,
        attacked: false,
        combat: freshCombat(),
      });
      swapBackup(draft, "ally-1", "backup", []);
    });
    expect(resting.team[1]!.health).toBe(10);
    const events: GameEvent[] = [];
    produce(dulceraBattle(false), (draft) => {
      swapFromCard(draft, draft.team[1]!, events);
    });
    expect(events.some((event) => event.kind === "heal")).toBe(false);
    const opened = requireBattle(teamRun(42, ["dulcera", "mossguard"]));
    expect(opened.team[0]!.health).toBe(30);
    expect(decodeSave(encodeSave(opened))).toEqual(opened);
  });

  it("uses normal healing modifiers and rewards without card-only overhealing or revival", () => {
    const game = produce(dulceraBattle(), (draft) => {
      draft.discovery.recruited.dulcera = 5;
      draft.talents.push("health.mending", "health.overflow");
      draft.boons.push("groves-favor");
      draft.reserves[0]!.health = species("coralcurl").health - 1;
      swapBackup(draft, "ally-0", "backup-coralcurl", []);
    });
    expect(game.team[0]!).toMatchObject({ health: 28, block: 0, combat: { thorns: 1 } });
    const injured = produce(dulceraBattle(), (draft) => {
      draft.discovery.recruited.dulcera = 5;
      draft.talents.push("health.mending");
      swapBackup(draft, "ally-0", "backup-coralcurl", []);
    });
    expect(injured.team[0]!.health).toBe(18);
    const fallen = produce(dulceraBattle(), (draft) => {
      draft.reserves[0]!.health = 0;
    });
    expect(play(fallen, hush).state.reserves[0]!.health).toBe(0);
  });

  it("restores Dulcera's Health and refunds Chapel Light's Mana cost, including upgrades", () => {
    const game = dulceraBattle();
    const result = play(game, chapel);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.health).toBe(23);
    expect(result.state.team[1]!.health).toBe(14);
    expect(result.state.battle!.mana).toBe(game.battle.mana);
    expect(previewCard(game, game.cards.find((card) => card.definitionId === chapel)!.id)).toEqual(result);
    const upgraded = produce(game, (draft) => {
      draft.cards.find((card) => card.definitionId === chapel)!.level = 2;
    });
    expect(play(upgraded, chapel).state.team[0]!.health).toBe(27);
    expect(cardText(definition(chapel))).toBe("Restore 3 Health / Gain 1 Mana");
    expect(cardText(definition(chapel), 2)).toBe("Restore 7 Health / Gain 1 Mana");
  });

  it("gives Meadow Shelter's Block to all living allies and leaves backups unchanged", () => {
    const game = dulceraBattle();
    const result = play(game, meadow);
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((unit) => unit.block)).toEqual([2, 2, 2]);
    expect(result.state.reserves[0]!.block).toBe(0);
    expect(result.state.battle!.mana).toBe(3);
    expect(cardText(definition(meadow))).toBe("Allies gain 2 Block");
    expect(cardText(definition(hush))).toBe("Swap out for a random backup / Cleanse all allies");
    expect(cardTargeting(definition(meadow))).toBe("automatic");
    expect(speciesCards("dulcera").map((card) => card.cost)).toEqual([1, 1, 1]);
    expect(cardKeywords(game.cards.find((card) => card.definitionId === chapel)!)).toEqual([
      "health",
      "mana",
    ]);
    expect(cardKeywords(game.cards.find((card) => card.definitionId === hush)!)).toEqual(["health"]);
    expect(
      actionValue(
        game.cards.find((card) => card.definitionId === meadow)!,
        game.team[0]!,
        game,
      ),
    ).toBe(2);
    expect(FIRST_RUN_STARTERS).not.toContain("dulcera");
  });

  it("supports enemy healing, group Block and Cleanse without granting player Mana or swapping formations", () => {
    const game = produce(dulceraBattle(), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      Object.assign(enemy, { species: "dulcera", name: "Dulcera", health: 10, power: 1 });
      enemy.combat.poison = 4;
      draft.battle.enemies[1]!.combat.burn = 3;
      for (const id of [chapel, meadow, hush]) {
        expect(enemyCanUse(definition(id))).toBe(true);
        const def = enemyCard(definition(id));
        executeAbility(
          draft,
          { side: "enemy", actor: enemy, def, value: enemyAbilityValue(enemy, def) },
          [],
          { swap: swapFromCard },
        );
      }
    });
    expect(game.battle.enemies[0]!).toMatchObject({ health: 13, block: 2, combat: { poison: 0 } });
    expect(game.battle.enemies[1]!).toMatchObject({ block: 2, combat: { burn: 0 } });
    expect(game.battle.mana).toBe(4);
    expect(game.reserves[0]!.health).toBe(12);
    expect(game.rng).toBe(dulceraBattle().rng);
  });

  it("rejects controlled or unaffordable plays without changing state or RNG", () => {
    for (const blocked of [
      produce(dulceraBattle(), (draft) => {
        draft.battle.mana = 0;
      }),
      produce(dulceraBattle(), (draft) => {
        draft.team[0]!.combat!.controlled = "freeze";
        draft.team[0]!.combat!.controlTurns = 1;
      }),
    ]) {
      const result = play(blocked, hush);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(blocked);
      expect(result.events).toEqual([]);
    }
  });

  it("can be encountered, recruited and resumed through the normal journey", () => {
    const ready = produce(requireBattle(teamRun(42, ["almanelle", "emberback", "mossguard"])), (draft) => {
      draft.discovery.encountered.push("dulcera");
      draft.discovery.recruited.dulcera = 1;
      prepareDestination(draft);
      draft.expedition = {
        recruit: null,
        lastRoom: null,
        pack: authoredPack(
          draft.encounter,
          COMBAT_PACKS.findIndex((pack) => pack[0] === "dulcera"),
        ),
      };
    });
    const battle = accept(ready, { type: "beginBattle" });
    expect(battle.discovery.encountered).toContain("dulcera");
    const recruited = accept(winBattle(battle), { type: "recruit", species: "dulcera" });
    expect(recruited.discovery.recruited.dulcera).toBe(2);
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
  });
});

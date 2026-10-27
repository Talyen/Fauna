import { addReserve, requireBattle, teamRun, prepareDestination } from "../../../support/game";
import { setBattleCards, setHand } from "../../../support/cards";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { oatharaBattle } from "../../../support/oathara";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { definition, species, speciesCards, FIRST_RUN_STARTERS } from "../../../../src/game/content";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import {
  inspectCardPlay,
  availablePlays,
  chosenRecipients,
  playTargetError,
} from "../../../../src/game/play-queries";
import { cardActor } from "../../../../src/game/card-actors";
import {
  draw,
  drawKeyword,
  journeyReturn,
  journeyReturnHasDraw,
  MAX_HAND_SIZE,
} from "../../../../src/game/card-zones";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { freshCombat, hit, removeEffects } from "../../../../src/game/combat/index";
import { swapFromCard } from "../../../../src/game/team";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { battleChoices } from "../../../../src/application/battle-policy";
import type { BattleState, GameEvent } from "../../../../src/game/types";

const never = "oathara-never-lost";
const ward = "oathara-travelers-ward";
const vow = "oathara-vow-of-return";
function play(game: BattleState, id: string, targetId?: string) {
  const card = game.cards.find((entry) => entry.id === id || entry.definitionId === id)!;
  return dispatch(game, { type: "play", cardId: card.id, targetId, autoEndTurn: false });
}
function onlyHand(game: BattleState, definitions: string[]) {
  return produce(game, (draft) => {
    setHand(draft, definitions);
  });
}
function enemyAttack(game: BattleState, events: GameEvent[], area = false, repeated = false) {
  const actor = game.battle.enemies[0]!;
  executeAbility(
    game,
    {
      side: "enemy",
      actor,
      def: {
        ...definition("prismram-attack"),
        effect: "attack",
        damageType: "light",
        target: area ? "allEnemies" : undefined,
        repeatChance: repeated ? 100 : undefined,
        effects: [
          { kind: "damage", damageType: "burn", amount: 2 },
          ...(repeated ? [] : [{ kind: "blind" as const, amount: 1 }]),
        ],
      },
      value: 4,
      targetId: game.team[0]!.id,
    },
    events,
    { swap: swapFromCard },
  );
}

describe("Oathara", () => {
  it("authors the selected kit and all six borrowing allowances", () => {
    expect(speciesCards("oathara").map((card) => [card.id, card.cost, cardText(card)])).toEqual([
      [never, 1, "Shuffle your hand into your deck; Draw that many cards"],
      [ward, 1, "Reflect the next attack"],
      [vow, 1, "Resurrect an ally"],
    ]);
    expect(species("oathara").passiveTiers.map((tier) => tier.effects)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => [{ kind: "unfinishedJourney", amount }]),
    );
    expect(FIRST_RUN_STARTERS).not.toContain("oathara");
    expect(enemyCanUse(definition(never))).toBe(false);
    expect(enemyCanUse(definition(ward))).toBe(true);
    expect(enemyCanUse(definition(vow))).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    "admits exactly %i fallen plays, paying Mana and preserving ownership",
    (limit) => {
      let game = produce(oatharaBattle(), (draft) => {
        draft.discovery.recruited.oathara = limit;
        const original = draft.cards.find((card) => card.definitionId === "emberback-attack")!;
        draft.battle.hand = [];
        for (let i = 0; i < 7; i++) {
          const copy = { ...original, id: `copy-${i}`, temporary: true as const };
          draft.cards.push(copy);
          (i < MAX_HAND_SIZE ? draft.battle.hand : draft.battle.buffer).push(copy.id);
        }
        draft.battle.draw = draft.cards.filter((card) => !card.id.startsWith("copy-")).map((card) => card.id);
        draft.battle.copySerial = 7;
        draft.battle.mana = draft.battle.maxMana = 6;
        draft.battle.enemies[0]!.block = 1000;
      });
      const before = game.cards.map((card) => ({ ...card }));
      for (let index = 0; index < limit; index++) {
        const result = play(game, `copy-${index}`, game.battle.enemies[0]!.id);
        expect(result.accepted).toBe(true);
        game = requireBattle(result.state);
        expect(game.battle.discard).toContain(`copy-${index}`);
      }
      expect(game.battle.mana).toBe(6 - limit);
      expect(game.cards).toEqual(before);
      expect(game.team[1]!.health).toBe(0);
      expect(game.team[0]!.combat!.fallenCardsPlayedThisTurn).toBe(limit);
      const rejected = play(game, `copy-${limit}`, game.battle.enemies[0]!.id);
      expect(rejected.accepted).toBe(false);
      expect(rejected.state).toBe(game);
      expect(rejected.events).toEqual([]);
      expect(decodeSave(encodeSave(game))).toEqual(game);
    },
  );

  it("uses Oathara for self effects and ignores the fallen owner's free-card charge", () => {
    const game = produce(onlyHand(oatharaBattle(), ["mossguard-guard"]), (draft) => {
      draft.team[2]!.health = 0;
      draft.team[2]!.combat!.freeCard = true;
    });
    const result = play(game, "mossguard-guard");
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.block).toBe(6);
    expect(result.state.team[2]!.block).toBe(0);
    expect(result.state.battle!.mana).toBe(3);
    expect(result.events.find((event) => event.kind === "action")?.actorId).toBe(game.team[0]!.id);
  });

  it("keeps drawing fallen cards after the allowance is spent, but requires a living deployed guide", () => {
    const game = produce(oatharaBattle(), (draft) => {
      draft.team[0]!.combat!.fallenCardsPlayedThisTurn = 1;
      draft.battle.draw = draft.cards
        .filter((card) => card.ownerId === draft.team[1]!.id)
        .map((card) => card.id);
      draft.battle.discard = draft.cards
        .filter((card) => !draft.battle.draw.includes(card.id))
        .map((card) => card.id);
      draft.battle.hand = [];
      draw(draft, 3);
    });
    expect(game.battle.hand).toHaveLength(3);
    expect(
      game.battle.hand.every((id) => game.cards.find((card) => card.id === id)!.ownerId === game.team[1]!.id),
    ).toBe(true);
    expect(inspectCardPlay(game, game.battle.hand[0]!).allowed).toBe(false);
    const keywordGame = produce(
      requireBattle(teamRun(42, ["oathara", "pollenmoth", "mossguard"])),
      (draft) => {
        draft.team[0]!.combat!.fallenCardsPlayedThisTurn = 1;
        draft.team[1]!.health = 0;
        draft.battle.hand = [];
        draft.battle.draw = draft.cards.map((card) => card.id);
        draft.battle.discard = [];
        draft.battle.buffer = [];
      },
    );
    const drawn = produce(keywordGame, (draft) => {
      drawKeyword(draft, "light");
    });
    expect(drawn.battle.hand).toHaveLength(1);
    const absent = produce(keywordGame, (draft) => {
      draft.team[0]!.health = 0;
      drawKeyword(draft, "light");
    });
    expect(absent.battle.hand).toEqual([]);
  });

  it("keeps Journey Loom's availability aligned with the actual draw across both piles", () => {
    const base = oatharaBattle();
    const owner = base.team[0]!;
    const living = base.cards.find((card) => card.ownerId === base.team[2]!.id)!;
    const fallen = base.cards.find((card) => card.ownerId === base.team[1]!.id)!;
    const own = base.cards.find((card) => card.ownerId === owner.id)!;
    for (const pile of ["draw", "discard"] as const) {
      for (const ids of [[own.id], [fallen.id], [living.id], [own.id, fallen.id], [fallen.id, living.id]]) {
        const game = structuredClone(base);
        game.boons = ["journey-loom"];
        game.battle.hand = [];
        game.battle.buffer = [];
        game.battle.draw = [];
        game.battle.discard = [];
        game.battle[pile] = ids.slice();
        const expected = ids.includes(living.id);
        const before = structuredClone(game);
        expect(journeyReturnHasDraw(game, owner.id)).toBe(expected);
        expect(game).toEqual(before);
        journeyReturn(game, owner.id, []);
        expect(game.battle.hand.includes(living.id)).toBe(expected);
        if (!expected) expect(game).toEqual(before);
      }
    }
  });

  it("accepts exactly the displayed resurrection targets, including fallen backups", () => {
    const game = produce(oatharaBattle(), (draft) => {
      addReserve(draft, "fallen-backup", "coralcurl", 0, freshCombat());
      addReserve(draft, "living-backup", "prismram", 30, freshCombat());
    });
    const def = definition(vow);
    const recipients = chosenRecipients(game, def).map((unit) => unit.id);
    expect(recipients).toEqual([game.team[1]!.id, "fallen-backup"]);
    for (const unit of [...game.team, ...game.reserves, ...game.battle.enemies])
      expect(playTargetError(game, def, game.team[0]!.id, unit.id) === null).toBe(
        recipients.includes(unit.id),
      );
    expect(playTargetError(game, def, game.team[0]!.id)).toBe("Choose a knocked-out ally.");
  });

  it("resets allowance at turn start, not through resurrection, repeats or swapping", () => {
    const game = produce(oatharaBattle(), (draft) => {
      draft.team[0]!.combat!.fallenCardsPlayedThisTurn = 1;
      draft.battle.enemies.forEach((enemy) => {
        enemy.combat.controlled = "freeze";
        enemy.combat.controlTurns = 1;
      });
    });
    const revived = requireBattle(play(game, vow, game.team[1]!.id).state);
    expect(revived.team[0]!.combat!.fallenCardsPlayedThisTurn).toBe(1);
    const ended = requireBattle(dispatch(revived, { type: "endTurn" }).state);
    expect(ended.team[0]!.combat!.fallenCardsPlayedThisTurn).toBe(0);
    const repeated = produce(game, (draft) => {
      const def = definition(ward);
      executeAbility(
        draft,
        { side: "player", actor: draft.team[0]!, def: { ...def, repeatChance: 100 }, value: 1 },
        [],
        { swap: swapFromCard },
      );
    });
    expect(repeated.team[0]!.combat!.fallenCardsPlayedThisTurn).toBe(1);
    const swapped = produce(game, (draft) => {
      addReserve(draft, "backup", "prismram", 30, freshCombat());
      swapFromCard(draft, draft.team[0]!, [], true);
    });
    expect(swapped.reserves[0]!.combat!.fallenCardsPlayedThisTurn).toBe(1);
    expect(availablePlays(swapped).some((play) => play.card.ownerId === swapped.team[1]!.id)).toBe(false);
  });

  it("selects an available duplicate guide and rejects controlled or unpaid borrowing without RNG changes", () => {
    const game = produce(requireBattle(teamRun(42, ["oathara", "oathara", "emberback"])), (draft) => {
      draft.team[2]!.health = 0;
      draft.team[0]!.combat!.fallenCardsPlayedThisTurn = 1;
      const card = draft.cards.find((card) => card.definitionId === "emberback-attack")!;
      setBattleCards(draft, [card.id]);
    });
    expect(
      cardActor(
        game,
        game.cards.find((card) => card.id === game.battle.hand[0])!,
      )?.id,
    ).toBe(game.team[1]!.id);
    const blocked = produce(game, (draft) => {
      draft.team[1]!.combat!.controlled = "stun";
      draft.team[1]!.combat!.controlTurns = 1;
    });
    expect(play(blocked, "emberback-attack", blocked.battle.enemies[0]!.id).state).toBe(blocked);
    const unpaid = produce(game, (draft) => {
      draft.battle.mana = 0;
    });
    expect(play(unpaid, "emberback-attack", unpaid.battle.enemies[0]!.id).state).toBe(unpaid);
  });

  it("Never Lost reshuffles only the remaining hand, preserving buffered draws and every card identity", () => {
    const game = produce(oatharaBattle(), (draft) => {
      const buffered = draft.battle.draw.pop()!;
      draft.battle.buffer = [buffered];
    });
    const result = requireBattle(play(game, never).state);
    expect(result.battle.hand).toHaveLength(game.battle.hand.length);
    expect(result.battle.hand[0]).toBe(game.battle.buffer[0]);
    expect(result.cards).toEqual(game.cards);
    expect(
      [
        ...result.battle.hand,
        ...result.battle.draw,
        ...result.battle.discard,
        ...result.battle.buffer,
      ].sort(),
    ).toEqual(game.cards.map((card) => card.id).sort());
  });

  it.each([never, ward, vow, "emberback-attack"])(
    "keeps %s preview detached and equal to the command",
    (ability) => {
      const game = oatharaBattle();
      const card = game.cards.find((card) => card.definitionId === ability)!;
      const target =
        ability === vow
          ? game.team[1]!.id
          : ability === "emberback-attack"
            ? game.battle.enemies[0]!.id
            : undefined;
      const before = encodeSave(game);
      const result = play(game, ability, target);
      expect(result.accepted).toBe(true);
      expect(previewCard(game, card.id, target)).toEqual(result);
      expect(encodeSave(game)).toBe(before);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    },
  );

  it("resurrects at exactly 20% without healing bonuses, another Death's Door or pile changes", () => {
    const game = produce(oatharaBattle(), (draft) => {
      draft.talents = ["health.mending"];
      draft.team[1]!.combat!.burn = 2;
    });
    const result = requireBattle(play(game, vow, game.team[1]!.id).state);
    expect(result.team[1]!.health).toBe(6);
    expect(result.team[1]!.combat).toMatchObject({ deathDoorUsed: true, grace: 0, burn: 2 });
    expect(result.cards).toEqual(game.cards);
    expect(
      cardActor(
        result,
        result.cards.find((card) => card.definitionId === "emberback-attack")!,
      )?.id,
    ).toBe(game.team[1]!.id);
    const again = produce(result, (draft) => {
      hit(draft, draft.battle.enemies[0]!, draft.team[1]!, 100, "light", [], { origin: "derived" });
    });
    expect(again.team[1]!.health).toBe(0);
  });

  it("targets knocked-out backups, rejects living allies and exposes legal resurrection to Auto-play", () => {
    const game = produce(oatharaBattle(), (draft) => {
      draft.team[1]!.health = 10;
      addReserve(draft, "fallen-backup", "coralcurl", 0, freshCombat());
    });
    expect(play(game, vow, game.team[1]!.id).state).toBe(game);
    const choice = battleChoices(game).find(
      (command) => command.type === "play" && command.targetId === "fallen-backup",
    );
    expect(choice).toBeDefined();
    const result = play(game, vow, "fallen-backup");
    expect(result.state.reserves[0]!.health).toBe(6);
    expect(result.state.reserves[0]!.combat!.deathDoorUsed).toBe(false);
    expect(result.state.team.map((unit) => unit.id)).toEqual(game.team.map((unit) => unit.id));
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("reflects a whole multi-packet attack and its Blind, while preserving the ward bearer's defenses", () => {
    const game = requireBattle(play(oatharaBattle(), ward).state);
    const events: GameEvent[] = [];
    const result = produce(game, (draft) => {
      draft.team[0]!.block = 10;
      draft.team[0]!.combat!.armor = 3;
      draft.battle.enemies[0]!.combat.controlled = "freeze";
      draft.battle.enemies[0]!.combat.controlTurns = 1;
      enemyAttack(draft, events);
    });
    expect(result.team[0]!).toMatchObject({
      health: 30,
      block: 10,
      combat: { armor: 3, attackReflection: false, blind: false, burn: 0 },
    });
    expect(result.battle.enemies[0]!.health).toBeLessThan(game.battle.enemies[0]!.health);
    expect(result.battle.enemies[0]!.combat.blind).toBe(true);
    expect(
      events.filter((event) => event.kind === "status" && event.status === "attackReflection"),
    ).toHaveLength(1);
  });

  it("reflects only its area recipient and spends one charge before a repeat", () => {
    const game = requireBattle(play(oatharaBattle(), ward).state);
    const area = produce(game, (draft) => {
      enemyAttack(draft, [], true);
    });
    expect(area.team[0]!.health).toBe(30);
    expect(area.team[2]!.health).toBeLessThan(game.team[2]!.health);
    expect(area.team[2]!.combat!.blind).toBe(true);
    const twice = produce(game, (draft) => {
      enemyAttack(draft, [], false, true);
    });
    expect(twice.team[0]!.health).toBeLessThan(30);
  });

  it("does not reflect reflections, periodic damage or Blind misses, and permits Purge", () => {
    const game = requireBattle(play(oatharaBattle(), ward).state);
    const result = produce(game, (draft) => {
      const actor = draft.battle.enemies[0]!,
        target = draft.team[0]!;
      actor.combat.attackReflection = true;
      hit(draft, actor, target, 1, "burn", [], { origin: "periodic" });
      hit(draft, actor, target, 4, "light", [], { origin: "ability", blindMiss: true });
      expect(target.combat!.attackReflection).toBe(true);
      hit(draft, actor, target, 4, "light", [], { origin: "ability", blindMiss: false });
      expect(actor.combat.attackReflection).toBe(true);
      expect(target.combat!.attackReflection).toBe(false);
      removeEffects(actor, "purge", 99, [], draft);
      expect(actor.combat.attackReflection).toBe(false);
    });
    expect(decodeSave(encodeSave(result))).toEqual(result);
  });

  it("persists enemy borrowing and resurrection without granting enemies Death's Door", () => {
    const destination = produce(oatharaBattle(), (draft) => {
      prepareDestination(draft);
      draft.expedition.pack = ["oathara", "pollenmoth", "mossguard"];
    });
    const game = requireBattle(dispatch(destination, { type: "beginBattle" }).state);
    const result = produce(game, (draft) => {
      const actor = draft.battle.enemies[0]!;
      draft.battle.enemies[1]!.health = 0;
      actor.lastAbility = "mossguard-guard";
      actor.combat.fallenCardsPlayedThisTurn = 1;
      executeAbility(
        draft,
        { side: "enemy", actor, def: definition(vow), value: 20, allyTargetId: draft.battle.enemies[1]!.id },
        [],
        { swap: swapFromCard },
      );
    });
    expect(result.battle.enemies[1]!.combat.deathDoorUsed).toBe(false);
    expect(decodeSave(encodeSave(result))).toEqual(result);
    const invalid = JSON.parse(encodeSave(result));
    invalid.battle.enemies[0].combat.fallenCardsPlayedThisTurn = 2;
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow();
  });

  it("lets enemy Oathara resurrect and use fallen allies' abilities at the base tier", () => {
    const game = produce(oatharaBattle(), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      enemy.species = "oathara";
      enemy.name = "Oathara";
      enemy.health = enemy.maxHealth = 30;
      enemy.power = 10;
      enemy.lastAbility = ward;
      draft.battle.enemies[1]!.health = 0;
      draft.battle.enemies[2]!.health = 0;
      draft.discovery.recruited.oathara = 6;
      const def = definition(vow);
      executeAbility(
        draft,
        { side: "enemy", actor: enemy, def, value: 20, allyTargetId: draft.battle.enemies[1]!.id },
        [],
        { swap: swapFromCard },
      );
      expect(draft.battle.enemies[1]!.health).toBe(Math.round(draft.battle.enemies[1]!.maxHealth * 0.2));
    });
    const ended = dispatch(game, { type: "endTurn" });
    expect(ended.state.battle!.enemies[0]!.combat.fallenCardsPlayedThisTurn).toBe(1);
    const events = ended.events;
    expect(
      events.some((event) => event.kind === "action" && event.actorId === game.battle.enemies[0]!.id),
    ).toBe(true);
  });
});

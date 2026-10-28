import { addReserve, teamRun } from "../../../support/game";
import { setBattleCards } from "../../../support/cards";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { definition, species, speciesCards, FIRST_RUN_STARTERS } from "../../../../src/game/content";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import { actionValue, enemyAbilityValue } from "../../../../src/game/ability-rules";
import { cardKeywords } from "../../../../src/game/progression";
import { freshCombat, hit, removeEffects } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { unhurried } from "../../../../src/game/combat/turns";
import { swapFromCard } from "../../../../src/game/team";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import type { BattleState, GameEvent } from "../../../../src/game/types";

const waking = "reverie-waking-wonder";
const double = "reverie-dream-double";
const harvest = "reverie-nightmare-harvest";
function fixture(ability = double) {
  const game = teamRun(42, ["reverie", "emberback", "prismram"]);
  if (game.phase !== "battle") throw new Error("Expected battle");
  return produce(game, (draft) => {
    const card = draft.cards.find((c) => c.definitionId === ability)!;
    setBattleCards(draft, [card.id]);
    draft.battle.enemies.forEach((enemy) => {
      enemy.combat = freshCombat();
      enemy.block = 0;
    });
    draft.rng = 42;
  });
}
const play = (game: BattleState) =>
  dispatch(game, {
    type: "play",
    cardId: game.battle.hand[0]!,
    autoEndTurn: false,
  });
function enemyAbility(game: BattleState, id: string, events: GameEvent[], repeat = false) {
  const actor = game.battle.enemies[0]!;
  const def = definition(id);
  executeAbility(
    game,
    {
      side: "enemy",
      actor,
      def: repeat ? { ...def, repeatChance: 100 } : def,
      value: def.value,
      targetId: game.team[0]!.id,
    },
    events,
  );
}

describe("Reverie", () => {
  it("authors only the selected abilities, six healing tiers and one Mana costs", () => {
    expect(speciesCards("reverie").map((card) => [card.id, card.cost, cardText(card)])).toEqual([
      [waking, 1, "Draw 2 cards"],
      [double, 1, "Gain 3 Thorns / Negate the next attack against you"],
      [harvest, 1, "Cleanse all allies / Gain 1 Mana per effect removed"],
    ]);
    expect(species("reverie").passiveTiers.map((tier) => tier.effects)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => [{ kind: "unhurried", amount }]),
    );
    expect(cardKeywords({ definitionId: double })).toEqual(["nature"]);
    expect(cardKeywords({ definitionId: harvest })).toEqual(["health", "mana"]);
    expect(enemyCanUse(definition(waking))).toBe(false);
    expect(enemyCanUse(definition(double))).toBe(true);
    expect(enemyCanUse(definition(harvest))).toBe(true);
    expect(FIRST_RUN_STARTERS).not.toContain("reverie");
    expect(cardText(definition(double), 3)).toContain("9 Thorns");
    expect(cardText(definition(waking), 3)).toBe("Draw 8 cards");
    expect(cardText(definition(harvest), 3)).toBe(cardText(definition(harvest)));
  });
  it.each([waking, double, harvest])(
    "keeps %s previews detached and identical to committed resolution",
    (ability) => {
      const game = produce(fixture(ability), (d) => {
        d.team[1]!.combat!.burn = 5;
      });
      const encoded = encodeSave(game);
      const preview = previewCard(game, game.battle.hand[0]!);
      const result = play(game);
      expect(result.accepted).toBe(true);
      expect(preview.state).toEqual(result.state);
      expect(encodeSave(game)).toBe(encoded);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    },
  );
  it("draws exactly two cards through ordinary hand and overflow ownership", () => {
    const game = fixture(waking);
    const result = play(game);
    expect(result.state.battle!.hand).toHaveLength(2);
    expect(result.state.battle!.draw).toHaveLength(game.battle.draw.length - 2);
    expect(result.state.battle!.mana).toBe(3);
  });
  it.each([1, 2, 3, 4, 5, 6])(
    "heals idle deployed allies including self for tier %i before enemy actions",
    (amount) => {
      const game = produce(fixture(), (d) => {
        d.discovery.recruited.reverie = amount;
        d.team.forEach((unit) => {
          unit.health -= 8;
        });
        d.team[1]!.combat!.cardsPlayedThisTurn = 1;
        d.battle.enemies.forEach((enemy) => {
          enemy.combat.controlled = "freeze";
          enemy.combat.controlTurns = 1;
        });
      });
      const result = dispatch(game, { type: "endTurn" });
      expect(result.accepted).toBe(true);
      expect(result.state.team.map((c, index) => c.health - game.team[index]!.health)).toEqual([
        amount,
        0,
        amount,
      ]);
      const healIndex = result.events.findIndex((e) => e.kind === "heal");
      const enemyIndex = result.events.findIndex((e) => e.kind === "status" && e.outcome === "skip");
      expect(healIndex).toBeLessThan(enemyIndex);
      expect(result.state.team.every((unit) => unit.combat!.cardsPlayedThisTurn === 0)).toBe(true);
    },
  );
  it("counts support plays as activity and excludes reserves, knockouts and absent providers", () => {
    const game = produce(fixture(), (d) => {
      d.team.forEach((unit) => {
        unit.health -= 5;
      });
      addReserve(d, "backup", "mossguard", 10, freshCombat());
    });
    const action = play(game);
    expect(action.accepted).toBe(true);
    const played = action.state as BattleState;
    const result = produce(played, (d) => {
      d.team[2]!.health = 0;
      unhurried(d, false, []);
    });
    expect(result.team.map((unit) => unit.health)).toEqual([
      game.team[0]!.health,
      game.team[1]!.health + 1,
      0,
    ]);
    expect(result.reserves[0]!.health).toBe(10);
    const absent = produce(game, (d) => {
      d.team[0]!.health = 0;
      unhurried(d, false, []);
    });
    expect(absent.team[1]!.health).toBe(game.team[1]!.health);
  });
  it("stacks deployed Reveries independently and applies ordinary healing caps and modifiers", () => {
    const game = teamRun(42, ["reverie", "reverie", "mossguard"]);
    if (game.phase !== "battle") throw new Error("Expected battle");
    const result = produce(game, (d) => {
      d.discovery.recruited.reverie = 6;
      d.talents = ["health.mending"];
      d.team[0]!.health = 27;
      d.team[1]!.health = 1;
      d.team[2]!.health = 1;
      d.team[2]!.combat!.cardsPlayedThisTurn = 1;
      unhurried(d, false, []);
    });
    expect(result.team.map((unit) => unit.health)).toEqual([28, 15, 1]);
  });
  it("negates a whole multi-packet attack, preserves defenses, and retaliates exactly once", () => {
    const game = play(fixture()).state as BattleState;
    const events: GameEvent[] = [];
    const result = produce(game, (d) => {
      d.team[0]!.block = 7;
      d.team[0]!.combat!.armor = 4;
      d.team[2]!.species = "emberback";
      const actor = d.battle.enemies[0]!;
      executeAbility(
        d,
        {
          side: "enemy",
          actor,
          def: {
            ...definition("prismram-attack"),
            effects: [
              { kind: "damage", amount: 4, damageType: "burn" },
              { kind: "purge", amount: 1 },
            ],
          },
          value: 6,
          targetId: d.team[0]!.id,
        },
        events,
      );
    });
    expect(result.team[0]!.health).toBe(28);
    expect(result.team[0]!.block).toBe(7);
    expect(result.team[0]!.combat).toMatchObject({ armor: 4, negate: false, thorns: 2, burn: 0 });
    expect(result.battle.enemies[0]!.health).toBe(game.battle.enemies[0]!.health - 3);
    expect(events.filter((e) => e.kind === "damage")).toHaveLength(1);
    expect(events.some((e) => e.kind === "status" && e.status === "negate" && e.outcome === "immune")).toBe(
      true,
    );
  });
  it("protects only its recipient in an area attack, including Blind and armor-removal extras", () => {
    const game = play(fixture()).state as BattleState;
    const result = produce(game, (d) => {
      d.team[0]!.combat!.armor = 4;
      d.team[2]!.species = "emberback";
      const actor = d.battle.enemies[0]!;
      executeAbility(
        d,
        {
          side: "enemy",
          actor,
          def: {
            ...definition("cindernewt-ashen-veil"),
            effects: [
              { kind: "blind", amount: 1 },
              { kind: "meltArmor", amount: 50 },
            ],
          },
          value: 1,
        },
        [],
      );
    });
    expect(result.team[0]!.combat).toMatchObject({
      armor: 4,
      blind: false,
      burn: 0,
      negate: false,
      thorns: 2,
    });
    expect(result.team[1]!.combat!.blind).toBe(true);
    expect(result.team[2]!.combat!.blind).toBe(true);
  });
  it("consumes one protection for the first resolution and allows a repeated attack through", () => {
    const game = play(fixture()).state as BattleState;
    const events: GameEvent[] = [];
    const result = produce(game, (d) => {
      enemyAbility(d, "prismram-attack", events, true);
    });
    expect(
      events.filter((e) => e.kind === "status" && e.status === "negate" && e.outcome === "immune"),
    ).toHaveLength(1);
    expect(result.team[0]!.health).toBeLessThan(28);
    expect(result.team[0]!.combat!.thorns).toBe(1);
    expect(result.battle.enemies[0]!.health).toBe(game.battle.enemies[0]!.health - 5);
  });
  it("retains protection through periodic/proc damage and swaps, permits Purge, and persists a single charge", () => {
    const game = play(fixture()).state as BattleState;
    const result = produce(game, (d) => {
      const actor = d.battle.enemies[0]!,
        target = d.team[0]!;
      hit(d, actor, target, 2, "burn", [], { origin: "periodic" });
      hit(d, actor, target, 2, "light", [], { origin: "proc" });
      expect(target.combat!.negate).toBe(true);
      const card = d.cards.find((c) => c.definitionId === double)!;
      d.battle.hand = [card.id];
      d.battle.discard = [];
      d.battle.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
      addReserve(d, "backup", "mossguard", 32, freshCombat());
    });
    const twice = play(result).state;
    expect(twice.team[0]!.combat).toMatchObject({ negate: true, thorns: 6 });
    const swapped = produce(twice, (d) => {
      swapFromCard(d, d.team[0]!, [], true);
    });
    const resumed = decodeSave(encodeSave(swapped));
    expect(resumed.reserves.find((c) => c.species === "reverie")!.combat!.negate).toBe(true);
    const purged = produce(result, (d) => {
      removeEffects(d.team[0]!, "purge", 99, [], d);
    });
    expect(purged.team[0]!.combat!.negate).toBe(false);
    expect(() => decodeSave(JSON.stringify({ ...result, version: 53 }))).toThrow();
  });
  it("pays per removed category across living deployed allies, preserves reserve effects and caps Mana", () => {
    const game = produce(fixture(harvest), (d) => {
      d.battle.mana = 1;
      d.team[0]!.combat!.burn = 100;
      d.team[0]!.combat!.poison = 50;
      d.team[1]!.combat!.blind = true;
      d.team[2]!.combat!.controlled = "freeze";
      d.team[2]!.combat!.controlTurns = 1;
      d.team[2]!.combat!.freeze = 10;
      addReserve(d, "backup", "mossguard", 20, { ...freshCombat(), burn: 5 });
    });
    const result = play(game);
    expect(result.state.battle!.mana).toBe(4);
    expect(result.state.team[0]!.combat).toMatchObject({ burn: 0, poison: 0 });
    expect(result.state.team[1]!.combat!.blind).toBe(false);
    expect(result.state.team[2]!.combat).toMatchObject({
      controlled: null,
      controlTurns: 0,
      freeze: 0,
      cooldown: 3,
    });
    expect(result.state.reserves[0]!.combat!.burn).toBe(5);
    expect(
      result.events.filter((e) => e.kind === "status" && e.targetId === undefined && e.amount === 4),
    ).toHaveLength(1);
  });
  it("counts categories rather than stacks or duplicate control representations and gives no empty payout", () => {
    for (const afflicted of [false, true]) {
      const game = produce(fixture(harvest), (d) => {
        d.battle.mana = 1;
        d.cards.find((c) => c.id === d.battle.hand[0])!.level = 3;
        if (afflicted) {
          d.team[1]!.combat!.controlled = "freeze";
          d.team[1]!.combat!.controlTurns = 1;
          d.team[1]!.combat!.freeze = 999;
        }
      });
      expect(play(game).state.battle!.mana).toBe(afflicted ? 1 : 0);
    }
  });
  it("keeps ordinary Cleanse rewards and awards one Health and Mana XP per accepted play", () => {
    const game = produce(fixture(harvest), (d) => {
      d.battle.mana = 1;
      d.team[1]!.health -= 10;
      d.team[1]!.combat!.burn = 5;
      d.team[1]!.combat!.poison = 3;
      d.talents = ["health.renewal", "mana.arcane-mending"];
    });
    const result = play(game);
    expect(result.state.battle!.mana).toBe(2);
    expect(result.state.team[1]!.health).toBe(game.team[1]!.health + 6);
    expect(result.state.battleXP.health).toBe((game.battleXP.health ?? 0) + 1);
    expect(result.state.battleXP.mana).toBe((game.battleXP.mana ?? 0) + 1);
  });
  it("uses the base passive on enemies, cleanses only their side and never grants player Mana", () => {
    const game = produce(fixture(), (d) => {
      d.discovery.recruited.reverie = 6;
      const enemy = d.battle.enemies[0]!;
      enemy.species = "reverie";
      enemy.name = "Reverie";
      enemy.combat.cardsPlayedThisTurn = 1;
      const idle = d.battle.enemies[1]!;
      idle.health -= 8;
      idle.combat.burn = 4;
      d.team[0]!.combat!.burn = 9;
      unhurried(d, true, []);
      expect(idle.health).toBe(idle.maxHealth - 7);
      const def = definition(harvest);
      executeAbility(d, { side: "enemy", actor: enemy, def, value: enemyAbilityValue(enemy, def) }, []);
      expect(idle.combat.burn).toBe(0);
      expect(d.team[0]!.combat!.burn).toBe(9);
      const doubleDef = definition(double);
      executeAbility(
        d,
        { side: "enemy", actor: enemy, def: doubleDef, value: enemyAbilityValue(enemy, doubleDef) },
        [],
      );
      expect(enemy.combat).toMatchObject({ negate: true, thorns: 3 });
    });
    expect(game.battle.mana).toBe(4);
  });
  it("rejects unpayable plays without changing state, protection, effects or RNG", () => {
    const game = produce(fixture(harvest), (d) => {
      d.battle.mana = 0;
      d.team[0]!.combat!.burn = 50;
      d.team[0]!.combat!.negate = true;
    });
    const result = play(game);
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(game);
    expect(result.events).toEqual([]);
    expect(
      actionValue(
        game.cards.find((c) => c.id === game.battle.hand[0])!,
        game.team[0]!,
        game,
      ),
    ).toBe(1);
  });
  it("keeps protection on a Blind miss and does not treat negation as a Dodge", () => {
    const game = play(fixture()).state as BattleState;
    const events: GameEvent[] = [];
    const result = produce(game, (d) => {
      const target = d.team[0]!,
        actor = d.battle.enemies[0]!;
      hit(d, actor, target, 6, "physical", events, { origin: "ability", blindMiss: true });
      expect(target.combat!.negate).toBe(true);
      const dodgeXP = d.battleXP.dodge;
      hit(d, actor, target, 6, "physical", events);
      expect(d.battleXP.dodge).toBe(dodgeXP);
    });
    expect(result.team[0]!.combat!.negate).toBe(false);
    expect(events.filter((e) => e.kind === "status" && e.status === "dodge")).toHaveLength(1);
  });
  it("heals idle enemies at their turn end rather than using player ranks or healing active enemies", () => {
    const game = produce(fixture(), (d) => {
      d.discovery.recruited.reverie = 6;
      d.team[0]!.health = 0;
      const [dreamer, idle, active] = d.battle.enemies;
      dreamer!.species = "reverie";
      dreamer!.name = "Reverie";
      dreamer!.health = dreamer!.maxHealth = 28;
      dreamer!.lastAbility = harvest;
      idle!.health -= 5;
      idle!.combat.controlled = "freeze";
      idle!.combat.controlTurns = 1;
      active!.health -= 5;
      active!.species = "glintstride";
      active!.name = "Glintstride";
      active!.lastAbility = "glintstride-attack";
    });
    const result = dispatch(game, { type: "endTurn" });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.enemies[1]!.health).toBe(game.battle.enemies[1]!.health + 1);
    expect(
      result.events.filter((e) => e.kind === "heal" && e.targetId === game.battle.enemies[0]!.id),
    ).toHaveLength(0);
  });
  it("does not repay the same removed effects when Nightmare Harvest repeats", () => {
    const events: GameEvent[] = [];
    const result = produce(fixture(), (d) => {
      d.battle.mana = 0;
      d.team[1]!.combat!.burn = 50;
      d.team[1]!.combat!.poison = 50;
      executeAbility(
        d,
        { side: "player", actor: d.team[0]!, def: { ...definition(harvest), repeatChance: 100 }, value: 1 },
        events,
      );
    });
    expect(result.battle.mana).toBe(2);
    expect(
      events.filter((e) => e.kind === "status" && e.targetId === undefined && e.amount === 2),
    ).toHaveLength(1);
  });
});

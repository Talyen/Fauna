import { setBattleCards } from "../../support/cards";
import type { GameEvent } from "../../../src/game/types";
import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, species } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import { hit, removeEffects, tickStatuses } from "../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { combatStatuses } from "../../../src/ui/shared/combat/combat-status";
import { authoredPack, prepareDestination, accept, teamRun, winBattle } from "../../support/game";

function ready(id = "shadebrim-guard") {
  return produce(teamRun(1, ["shadebrim", "mossguard", "prismram"]), (game) => {
    const card = game.cards.find((entry) => entry.definitionId === id)!;
    setBattleCards(game, [card.id]);
    game.rng = 1;
  });
}

it("plays the one-Mana kit with preview parity, accurate XP and current-format resume", () => {
  expect(
    CARDS.filter((card) => card.species === "shadebrim").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Gain 4 Block; Reflect the next Burn"],
    [1, "Deal 1 Freeze damage to all enemies; Cleanse all allies"],
    [1, "Draw 2 cards; Gain 1 Mana"],
  ]);
  for (const id of ["shadebrim-guard", "shadebrim-attack", "shadebrim-draw"]) {
    const game = ready(id),
      cardId = game.battle!.hand[0]!;
    const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(previewCard(game, cardId)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(result.state.battle!.mana).toBe(id.endsWith("draw") ? 4 : 3);
    if (id.endsWith("guard")) {
      expect(result.state.team[0]!.block).toBe(4);
      expect(result.state.team[0]!.combat!.reflectBurn).toBe(true);
      expect(result.state.battleXP.block).toBe(1);
      expect(result.state.battleXP.burn).toBeUndefined();
      expect(combatStatuses(result.state.team[0]!.combat)).toContainEqual(
        expect.objectContaining({
          id: "reflectBurn",
          text: expect.stringContaining("Reflect the next Burn"),
        }),
      );
    } else if (id.endsWith("draw")) {
      expect(result.state.battle!.hand).toHaveLength(2);
      expect(result.state.battle!.draw).toHaveLength(6);
      expect(result.state.battleXP.mana).toBe(1);
    } else {
      expect(
        result.events
          .filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage")
          .map((event) => event.amount),
      ).toEqual([1, 1, 1]);
      expect(result.state.battle!.enemies.map((enemy) => enemy.combat.freeze)).toEqual([1, 1, 1]);
      expect(result.state.battleXP.freeze).toBe(1);
      expect(result.state.battleXP.health).toBe(1);
    }
  }
  expect(() => decodeSave(JSON.stringify({ ...ready(), version: 33 }))).toThrow();
});

it.each([10, 20, 30, 40, 50, 60])(
  "reduces allied Burn hits and ticks by %i%% without reducing other damage",
  (percent) => {
    produce(ready(), (game) => {
      game.discovery.recruited.shadebrim = percent / 10;
      const attacker = game.battle!.enemies[0]!;
      for (const target of game.team) {
        const health = target.health;
        hit(game, attacker, target, 10, "burn", [], { origin: "proc" as const });
        expect(target.health).toBe(health - (10 - percent / 10));
        expect(target.combat!.burn).toBe(10 - percent / 10);
        target.health = health;
        target.combat!.burn = 10;
        tickStatuses(game, target, []);
        expect(target.health).toBe(health - (10 - percent / 10));
        expect(target.combat!.burn).toBe(5);
        target.health = health;
        hit(game, attacker, target, 10, "water", [], { origin: "proc" as const });
        expect(target.health).toBe(health - 10);
      }
    });
  },
);

it("combines Burn resistance with talents before rounding and spending Block", () => {
  produce(ready(), (game) => {
    game.discovery.recruited.shadebrim = 6;
    game.talents = ["burn.fire-resistance"];
    const target = game.team[1]!;
    target.block = 3;
    hit(game, game.battle!.enemies[0]!, target, 20, "burn", [], { origin: "proc" as const });
    expect(target.block).toBe(0);
    expect(target.health).toBe(species(target.species).health - 1);
    expect(target.combat!.burn).toBe(4);
  });
});

it("uses only living deployed protectors and the strongest canopy, including enemy base tiers", () => {
  for (const mode of ["fallen", "backup", "duplicate", "enemy", "reserveTarget"] as const) {
    produce(ready(), (game) => {
      game.discovery.recruited.shadebrim = 6;
      const protector = game.team[0]!,
        target = game.team[1]!,
        attacker = game.battle!.enemies[0]!;
      if (mode === "fallen") protector.health = 0;
      if (mode === "backup") {
        game.team.shift();
        game.reserves.push(protector);
      }
      if (mode === "duplicate") game.team[2]!.species = "shadebrim";
      if (mode === "enemy") {
        attacker.species = "shadebrim";
        const recipient = game.battle!.enemies[1]!;
        hit(game, protector, recipient, 10, "burn", [], { origin: "proc" as const });
        expect(recipient.health).toBe(recipient.maxHealth - 9);
      } else {
        if (mode === "reserveTarget") {
          game.team.splice(1, 1);
          game.reserves.push(target);
        }
        hit(game, attacker, target, 10, "burn", [], { origin: "proc" as const });
        expect(target.health).toBe(species(target.species).health - (mode === "duplicate" ? 4 : 10));
      }
    });
  }
});

it("reflects only the next applicable Burn, retaining other reflection and preventing chains", () => {
  const initial = accept(ready(), { type: "play", cardId: ready().battle!.hand[0]!, autoEndTurn: false });
  const resumed = decodeSave(encodeSave(initial));
  produce(resumed, (game) => {
    const target = game.team[0]!,
      attacker = game.battle!.enemies[0]!;
    // Non-Burn statuses leave Noonward's charge intact even when blocked
    hit(game, attacker, target, 2, "poison", [], { origin: "proc" as const });
    expect(target.combat!.reflectBurn).toBe(true);
    expect(target.combat!.poison).toBe(2);
    hit(game, attacker, target, 4, "poison", [], { origin: "proc" as const });
    expect(target.combat!.poison).toBe(6);
    expect(target.combat!.reflectBurn).toBe(true);
    target.combat!.poison = 0;
    target.combat!.reflect = true;
    game.battle!.enemies.forEach((enemy) => {
      enemy.combat.reflectBurn = true;
    });
    const before = target.health;
    hit(game, attacker, target, 10, "burn", [], { origin: "proc" as const });
    expect(target.health).toBe(before - 9);
    expect(target.combat!.burn).toBe(0);
    expect(target.combat!.reflectBurn).toBe(false);
    expect(target.combat!.reflect).toBe(true);
    expect(game.battle!.enemies.reduce((sum, enemy) => sum + enemy.combat.burn, 0)).toBe(9);
    expect(game.battle!.enemies.every((enemy) => enemy.combat.reflectBurn)).toBe(true);
    target.combat!.reflect = false;
    hit(game, attacker, target, 2, "burn", [], { origin: "proc" as const });
    expect(target.combat!.burn).toBe(2);
  });
});

it("spends Burn reflection on blocked buildup but preserves it through Dodge, ticks, Nullify and capped buildup", () => {
  for (const mode of ["dodge", "block", "periodic", "nullify", "capped", "purge"] as const) {
    produce(ready(), (game) => {
      const target = game.team[0]!,
        attacker = game.battle!.enemies[0]!;
      target.combat!.reflectBurn = true;
      if (mode === "block") target.block = 10;
      if (mode === "nullify") target.combat!.nullify = true;
      if (mode === "capped") target.combat!.burn = 1_000_000;
      if (mode === "purge") removeEffects(target, "purge", 1, [], game);
      else
        hit(
          game,
          attacker,
          target,
          2,
          "burn",
          [],
          mode === "dodge"
            ? { origin: "ability" as const, blindMiss: true }
            : mode === "periodic"
              ? { origin: "periodic" as const }
              : { origin: "proc" as const },
        );
      expect(target.combat!.reflectBurn).toBe(mode !== "purge" && mode !== "block");
    });
  }
});

it("Coolfront fully Cleanses deployed allies after damage, even when its attack misses", () => {
  const game = produce(ready("shadebrim-attack"), (draft) => {
    draft.team[0]!.combat!.blind = true;
    for (const unit of draft.team.slice(1)) {
      Object.assign(unit.combat!, {
        burn: 4,
        poison: 3,
        bleed: 2,
        stun: 1,
        freeze: 1,
        blind: true,
        controlled: "stun",
        controlTurns: 1,
        skipped: true,
      });
    }
    draft.rng = 1;
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.events.filter((event) => event.kind === "status" && event.outcome === "dodge")).toHaveLength(
    3,
  );
  for (const unit of result.state.team) {
    expect(unit.combat).toMatchObject({
      burn: 0,
      poison: 0,
      bleed: 0,
      stun: 0,
      freeze: 0,
      blind: false,
      controlled: null,
      skipped: false,
    });
  }
  expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
});

it("Noon Bloom restores its cost before automatic end turn and rejects unaffordable plays unchanged", () => {
  const initial = ready("shadebrim-draw"),
    cardId = initial.battle!.hand[0]!;
  const game = produce(initial, (draft) => {
    draft.battle!.mana = 1;
  });
  const result = dispatch(game, { type: "play", cardId });
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.mana).toBe(1);
  expect(result.state.battle!.turn).toBe(game.battle!.turn);
  const empty = produce(game, (draft) => {
    draft.battle!.mana = 0;
  });
  const rejected = dispatch(empty, { type: "play", cardId });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(empty);
});

it("enemy Shadebrim alternates useful abilities, Cleanses its own side and never gains Block from Noon Bloom", () => {
  const game = produce(ready(), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "shadebrim";
    enemy.name = "Shadebrim";
    enemy.power = 1;
    enemy.lastAbility = "shadebrim-guard";
    draft.battle!.enemies[1]!.combat.blind = true;
    draft.team.forEach((unit) => {
      unit.block = 100;
    });
  });
  const result = dispatch(game, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.enemies[0]!.lastAbility).toBe("shadebrim-attack");
  const nextActor = result.events.findIndex(
    (event) => event.kind === "action" && event.actorId !== "enemy-0",
  );
  const firstAbility = nextActor < 0 ? result.events : result.events.slice(0, nextActor);
  expect(firstAbility.some((event) => event.kind === "block" && event.targetId === "enemy-0")).toBe(false);
  expect(result.events).toContainEqual(
    expect.objectContaining({ status: "cleanse", targetId: "enemy-1", affectedStatus: "blind" }),
  );
  expect(
    result.events.filter(
      (event) => event.kind === "damage" && event.actorId === "enemy-0" && event.damageType === "freeze",
    ),
  ).toHaveLength(3);
});

it("encounters and recruits Shadebrim through the ordinary journey pool", () => {
  let game = produce(teamRun(1, ["mossguard", "emberback", "prismram"]), (draft) => {
    prepareDestination(draft);
    draft.expedition = {
      recruit: null,
      lastRoom: null,
      pack: authoredPack(
        draft.encounter,
        COMBAT_PACKS.findIndex((pack) => pack[0] === "shadebrim"),
      ),
    };
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.discovery.encountered).toContain("shadebrim");
  game = accept(winBattle(game), { type: "recruit", species: "shadebrim" });
  expect(game.discovery.recruited.shadebrim).toBe(1);
  expect([...game.team, ...game.reserves].some((unit) => unit.species === "shadebrim")).toBe(true);
});

import { expect, it } from "vitest";
import { produce } from "immer";
import { renderToStaticMarkup } from "react-dom/server";
import { CARDS, species } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import {
  applyBlind,
  beginAttack,
  dodgeChance,
  freshCombat,
  grantTemporaryDodge,
  hit,
  removeEffects,
  sharedDodgeChance,
  startAction,
  tickStatuses,
} from "../../../src/game/combat/index";
import { battleChoices } from "../../../src/application/battle-policy";
import { dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { combatStatuses } from "../../../src/ui/shared/combat/combat-status";
import { appendFeedback, CombatFeedback } from "../../../src/ui/battle/combat-feedback";
import { accept, teamRun, winBattle } from "../../support/game";
import type { GameEvent } from "../../../src/game/types";

function ready(id = "dunefox-dodge") {
  return produce(teamRun(1, ["dunefox", "mossguard", "captoad"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.block = 0;
      enemy.combat = freshCombat();
    });
  });
}

it("plays and previews the authored one-Mana kit with matching rules and current-format resume", () => {
  expect(
    CARDS.filter((card) => card.species === "dunefox").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Deal 6 Physical damage"],
    [1, "Deal 1 Physical damage to all enemies; Blind all enemies"],
    [1, "Gain 30% Dodge until your next turn; Draw 1 card"],
  ]);
  for (const id of ["dunefox-attack", "dunefox-dune-whirl", "dunefox-dodge"]) {
    const game = ready(id);
    const cardId = game.battle!.hand[0]!;
    const targetId = id === "dunefox-attack" ? "enemy-0" : undefined;
    const result = dispatch(game, { type: "play", cardId, targetId, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, cardId, targetId)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(game.team[0]!.combat!.temporaryDodge).toBe(0);
    expect(game.battle!.enemies.every((enemy) => !enemy.combat.blind)).toBe(true);
    if (id === "dunefox-attack")
      expect(result.state.battle!.enemies[0]!.health).toBe(game.battle!.enemies[0]!.health - 6);
    if (id === "dunefox-dune-whirl") {
      expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
        game.battle!.enemies.map((enemy) => enemy.health - 1),
      );
      expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
      expect(combatStatuses(result.state.battle!.enemies[0]!.combat)).toContainEqual(
        expect.objectContaining({ id: "blind", count: 1 }),
      );
    }
    if (id === "dunefox-dodge") {
      expect(result.state.team[0]!.combat!.temporaryDodge).toBe(30);
      expect(result.state.team[0]!.block).toBe(0);
      expect(result.state.battle!.hand).toHaveLength(1);
      expect(dodgeChance(result.state, result.state.team[0]!)).toBe(35);
    }
  }
  const game = ready();
  const rejected = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId: "ally-1" });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 26 }))).toThrow();
});

it("Blind misses emit the ordinary Dodge icon, award Dodge XP and talents, and expire on a hit too", () => {
  const events: GameEvent[] = [];
  const missed = produce(ready(), (game) => {
    const source = game.battle!.enemies[0]!,
      target = game.team[0]!;
    target.health -= 2;
    target.block = 7;
    target.combat!.armor = 3;
    target.combat!.controlled = "stun";
    game.talents = ["dodge.catch-breath", "physical.riposte"];
    source.combat.blind = true;
    game.rng = 1; // First roll is below 50%
    hit(game, source, target, 6, "physical", events);
    expect(source.combat.blind).toBe(false);
    expect(target.block).toBe(7);
    expect(target.combat!.armor).toBe(3);
    expect(target.health).toBe(species("dunefox").health - 1);
    expect(target.combat!.riposte).toBe(true);
    expect(game.battleXP.dodge).toBe(1);
  });
  expect(events).toContainEqual(
    expect.objectContaining({ targetId: "ally-0", status: "dodge", outcome: "dodge" }),
  );
  expect(events.some((event) => event.kind === "damage")).toBe(false);
  const html = renderToStaticMarkup(<CombatFeedback bursts={appendFeedback([], events, 1, 0)} />);
  expect(html).toContain("lucide-wind");
  expect(html).toContain('data-combat-tone="dodge"');
  produce(missed, (game) => {
    const source = game.battle!.enemies[0]!,
      target = game.team[0]!;
    source.combat.blind = true;
    game.rng = 1800; // First roll is above 50%
    const landed: GameEvent[] = [];
    hit(game, source, target, 20, "physical", landed);
    expect(source.combat.blind).toBe(false);
    expect(landed.some((event) => event.kind === "damage")).toBe(true);
  });
});

it("one Blind roll covers every recipient and supplemental packet in an attack", () => {
  const game = produce(ready("dunefox-dune-whirl"), (draft) => {
    draft.team[0]!.combat!.blind = true;
    draft.rng = 1;
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.state.team[0]!.combat!.blind).toBe(false);
  expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
    game.battle!.enemies.map((enemy) => enemy.health),
  );
  expect(result.events.filter((event) => event.outcome === "dodge")).toHaveLength(3);
  expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
  produce(ready(), (draft) => {
    const actor = draft.team[0]!;
    actor.combat!.blind = true;
    draft.rng = 1;
    const blindMiss = beginAttack(draft, actor);
    const events: GameEvent[] = [];
    for (const type of ["physical", "burn"] as const)
      hit(draft, actor, draft.battle!.enemies[0]!, 5, type, events, { origin: "ability", blindMiss });
    expect(events.filter((event) => event.kind === "damage")).toHaveLength(0);
    expect(draft.battle!.enemies[0]!.combat.burn).toBe(0);
  });
});

it("Blind survives support actions, skipped turns and periodic damage, refreshes without stacking, and Cleanses", () => {
  const game = produce(ready(), (draft) => {
    const source = draft.battle!.enemies[0]!,
      target = draft.team[0]!;
    applyBlind(draft, source, target, []);
    applyBlind(draft, source, target, []);
    target.combat!.burn = 1;
    target.combat!.controlled = "stun";
    target.combat!.controlTurns = 1;
    tickStatuses(draft, target, []);
    startAction(target, [], draft);
    expect(target.combat!.blind).toBe(true);
    target.combat!.skipped = false;
  });
  const result = accept(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.team[0]!.combat!.blind).toBe(true);
  expect(decodeSave(encodeSave(result))).toEqual(result);
  produce(result, (draft) => {
    removeEffects(draft.team[0]!, "cleanse", 1, [], draft);
    expect(draft.team[0]!.combat!.blind).toBe(false);
  });
});

it("reflects Blind once without changing damage or creating reflection loops", () => {
  produce(ready(), (game) => {
    const ram = game.team[1]!;
    ram.species = "prismram";
    ram.combat!.reflect = true;
    for (const enemy of game.battle!.enemies) enemy.combat.reflect = true;
    const events: GameEvent[] = [];
    applyBlind(game, game.battle!.enemies[0]!, ram, events);
    expect(ram.combat!.reflect).toBe(false);
    expect(ram.combat!.blind).toBe(false);
    expect(game.battle!.enemies.filter((enemy) => enemy.combat.blind)).toHaveLength(1);
    expect(game.battle!.enemies.every((enemy) => enemy.combat.reflect)).toBe(true);
    expect(events.filter((event) => event.status === "reflect")).toHaveLength(1);
  });
});

it.each([15, 20, 25, 30, 35, 40])(
  "Shifting Sands shares %i%% of live Dodge without granting itself a bonus",
  (share) => {
    produce(ready(), (game) => {
      game.discovery.recruited.dunefox = (share - 15) / 5 + 1;
      const fox = game.team[0]!,
        ally = game.team[1]!;
      expect(sharedDodgeChance(game, fox)).toBe(0);
      expect(sharedDodgeChance(game, ally)).toBeCloseTo((5 * share) / 100);
      grantTemporaryDodge(fox, 30, []);
      expect(dodgeChance(game, fox)).toBe(35);
      expect(dodgeChance(game, ally)).toBeCloseTo(5 + (35 * share) / 100);
      expect(combatStatuses(ally.combat, sharedDodgeChance(game, ally))).toContainEqual(
        expect.objectContaining({ id: "dodge", text: expect.stringContaining("Shifting Sands") }),
      );
      startAction(fox, [], game);
      expect(dodgeChance(game, ally)).toBeCloseTo(5 + (5 * share) / 100);
      grantTemporaryDodge(fox, 30, []);
      removeEffects(fox, "purge", 1, [], game);
      expect(fox.combat!.temporaryDodge).toBe(0);
      expect(dodgeChance(game, ally)).toBeCloseTo(5 + (5 * share) / 100);
      fox.health = 0;
      expect(sharedDodgeChance(game, ally)).toBe(0);
    });
  },
);

it("aura providers in backup are inactive; multiple Dunefoxes share intrinsic Dodge without recursive amplification", () => {
  produce(ready(), (game) => {
    const fox = game.team[0]!,
      ally = game.team[1]!;
    grantTemporaryDodge(fox, 30, []);
    const backup = { ...fox, id: "backup", combat: { ...freshCombat(), dodge: 70 } };
    game.reserves.push(backup);
    expect(dodgeChance(game, ally)).toBeCloseTo(10.25);
    game.team[2]!.species = "dunefox";
    expect(dodgeChance(game, fox)).toBeCloseTo(35.75);
    expect(dodgeChance(game, ally)).toBeCloseTo(11);
    game.team.splice(0, 1);
    expect(dodgeChance(game, ally)).toBeCloseTo(5.75);
    game.reserves.push(fox);
    startAction(fox, [], game);
    expect(fox.combat!.temporaryDodge).toBe(0);
    ally.combat!.dodge = 70;
    expect(dodgeChance(game, ally)).toBe(75);
    ally.combat!.controlled = "freeze";
    expect(dodgeChance(game, ally)).toBe(0);
  });
});

it("Mirage Step expires at the owner's next turn after resume and does not erase permanent Dodge", () => {
  let game = accept(ready(), { type: "play", cardId: ready().battle!.hand[0]!, autoEndTurn: false });
  game = produce(game, (draft) => {
    draft.team[0]!.combat!.dodge = 10;
    draft.battle!.enemies.forEach((enemy) => {
      enemy.combat.controlled = "freeze";
      enemy.combat.controlTurns = 1;
    });
  });
  const next = accept(decodeSave(encodeSave(game)), { type: "endTurn" });
  expect(next.team[0]!.combat!.temporaryDodge).toBe(0);
  expect(next.team[0]!.combat!.dodge).toBe(10);
  expect(dodgeChance(next, next.team[0]!)).toBe(15);
});

it("encounters discover and recruit Dunefox; enemy Mirage Step and auras use the base tier", () => {
  let sawStep = false,
    sawWhirl = false;
  for (let seed = 1; seed <= 30 && (!sawStep || !sawWhirl); seed++) {
    const game = accept(
      produce(ready(), (draft) => {
        draft.phase = "teamSelection";
        draft.battle = null;
        draft.encounter = 1;
        draft.expedition = {
          recruit: null,
          lastRoom: null,
          pack: COMBAT_PACKS.findIndex((pack) => pack[0] === "dunefox"),
        };
        draft.discovery.recruited.dunefox = 6;
        draft.rng = seed;
      }),
      { type: "beginBattle" },
    );
    expect(game.discovery.encountered).toContain("dunefox");
    const result = dispatch(game, { type: "endTurn" });
    if (result.events.some((event) => event.text.includes("uses Mirage Step"))) {
      sawStep = true;
      expect(result.state.battle!.enemies[0]!.combat.temporaryDodge).toBe(30);
      expect(sharedDodgeChance(result.state, result.state.battle!.enemies[1]!)).toBeCloseTo(5.25);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    }
    if (result.events.some((event) => event.text.includes("uses Dune Whirl"))) {
      sawWhirl = true;
      expect(result.state.team.every((unit) => unit.combat!.blind)).toBe(true);
    }
    expect(winBattle(game).reward!.recruits).toContain("dunefox");
  }
  expect(sawStep).toBe(true);
  expect(sawWhirl).toBe(true);
});

it("Auto-play offers Mirage Step once with its acting creature as the only recipient", () => {
  const game = ready();
  const choices = battleChoices(game, false);
  expect(choices).toEqual([
    { type: "play", cardId: game.battle!.hand[0]!, targetId: undefined, autoEndTurn: false },
  ]);
  expect(dispatch(game, choices[0]!).accepted).toBe(true);
});

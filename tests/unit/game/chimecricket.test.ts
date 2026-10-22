import { expect, it } from "vitest";
import { produce } from "immer";
import * as content from "../../../src/game/content";
import {
  freshCombat,
  hit,
  applyBlind,
  removeEffects,
  startAction,
  tickStatuses,
} from "../../../src/game/combat";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { battleChoices } from "../../../src/application/battle-policy";
import { combatStatuses } from "../../../src/ui/battle/combat-status";
import { accept, teamRun, winBattle } from "../../support/game";

function ready(id = "chimecricket-attack", seed = 1) {
  return produce(teamRun(1, ["chimecricket", "mossguard", "emberback"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.block = 0;
      enemy.combat = freshCombat();
    });
    game.rng = seed;
  });
}
const play = (game: ReturnType<typeof ready>, targetId?: string) =>
  dispatch(game, {
    type: "play",
    cardId: game.battle!.hand[0]!,
    targetId,
    autoEndTurn: false,
  });

it("plays the approved one-Mana kit and resumes deterministic previews", () => {
  expect(
    content.CARDS.filter((card) => card.species === "chimecricket").map((card) => [
      card.cost,
      content.cardText(card),
    ]),
  ).toEqual([
    [1, "Deal 4 Stun damage; Draw 1 card"],
    [1, "Nullify the next harmful status effect on each ally"],
    [1, "Restore 4 Health to the most injured ally; Cleanse the healed ally"],
  ]);
  for (const id of ["chimecricket-attack", "chimecricket-nullify", "chimecricket-heal"]) {
    const game = ready(id);
    const target = id.endsWith("attack") ? "enemy-0" : undefined;
    const result = play(game, target);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, game.battle!.hand[0]!, target)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    if (id.endsWith("attack")) {
      expect(result.events).toContainEqual(
        expect.objectContaining({ kind: "damage", damageType: "stun", amount: 4 }),
      );
      expect(result.state.battle!.hand).toHaveLength(1);
    }
  }
});

it.each([1, 2, 3, 4, 5, 6])(
  "uses the exact Encore chance at %i copies and charges/awards XP once",
  (copies) => {
    const chance = copies / 10;
    function outcome(fraction: number) {
      let seed = 0;
      while (true) {
        const value = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
        if (value >= fraction && value < fraction + 0.001) break;
        seed++;
      }
      return play(
        produce(ready("chimecricket-attack", seed), (game) => {
          game.discovery.recruited.chimecricket = copies;
        }),
        "enemy-0",
      );
    }
    const repeated = outcome(chance - 0.005);
    expect(repeated.events.filter((e) => e.kind === "damage" && e.actorId === "ally-0")).toHaveLength(2);
    expect(repeated.state.battle!.hand).toHaveLength(2);
    expect(repeated.state.battle!.mana).toBe(3);
    expect(repeated.state.battle!.cardsPlayedThisTurn).toBe(1);
    expect(repeated.state.battleXP.stun).toBe(1);
    expect(outcome(chance).events.some((e) => e.text.includes("with Encore"))).toBe(false);
    expect(content.species("chimecricket").passiveTiers[copies - 1]!.effects).toEqual([
      { kind: "encore", amount: copies * 10 },
    ]);
  },
);

it("reselects the most injured ally for the repeated heal and fully Cleanses each recipient", () => {
  const game = produce(ready("chimecricket-heal", 1972), (draft) => {
    draft.team[0]!.health = 10;
    draft.team[1]!.health = 14;
    for (const unit of draft.team) Object.assign(unit.combat!, { poison: 2, burn: 1, bleed: 1, blind: true });
    draft.reserves.push({ ...draft.team[2]!, id: "backup", health: 1 });
    draft.roster.push("emberback");
  });
  const result = play(game);
  expect(result.state.team.map((unit) => unit.health)).toEqual([14, 18, 30]);
  expect(result.state.team.map((unit) => unit.combat!.poison)).toEqual([0, 0, 2]);
  expect(result.state.team.map((unit) => unit.combat!.blind)).toEqual([false, false, true]);
  expect(result.state.reserves[0]!.health).toBe(1);
  expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
});

it("spends Encore on the first accepted ability only, preserves rejection and resets next turn", () => {
  const game = ready("chimecricket-attack");
  expect(play(game).state).toBe(game);
  expect(game.team[0]!.combat!.encoreUsed).toBe(false);
  const first = play(game, "enemy-0").state;
  expect(first.team[0]!.combat!.encoreUsed).toBe(true);
  const second = produce(first, (draft) => {
    const card = draft.cards.find((c) => c.definitionId === "chimecricket-heal")!;
    for (const zone of ["draw", "hand", "buffer", "discard"] as const)
      draft.battle![zone] = draft.battle![zone].filter((id) => id !== card.id);
    draft.battle!.hand.unshift(card.id);
    draft.rng = 1972;
  });
  const played = play(second);
  expect(played.events.some((e) => e.text.includes("with Encore"))).toBe(false);
  expect(played.state.rng).toBe(second.rng);
  const next = accept(played.state, { type: "endTurn" });
  expect(next.team[0]!.combat!.encoreUsed).toBe(false);
});

it("refreshes one Nullify on living deployed allies and exposes visible status feedback", () => {
  const game = produce(ready("chimecricket-nullify", 1972), (draft) => {
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[1]!, id: "backup", combat: freshCombat() });
    draft.roster.push("mossguard");
  });
  const result = play(game);
  expect(result.state.team.map((unit) => unit.combat!.nullify)).toEqual([true, true, false]);
  expect(result.state.reserves[0]!.combat!.nullify).toBe(false);
  expect(result.state.team.map((unit) => unit.block)).toEqual([0, 0, 0]);
  expect(combatStatuses(result.state.team[0]!.combat)).toContainEqual(
    expect.objectContaining({ id: "nullify", count: 1 }),
  );
  produce(result.state, (draft) => {
    const target = draft.team[0]!;
    hit(draft, draft.battle!.enemies[0]!, target, 2, "poison", [], { proc: true });
    expect(target.health).toBe(22);
    expect(target.combat!.poison).toBe(0);
    expect(target.combat!.nullify).toBe(false);
    hit(draft, draft.battle!.enemies[0]!, target, 2, "poison", [], { proc: true });
    expect(target.combat!.poison).toBe(2);
  });
});

it.each(["burn", "poison", "bleed", "stun", "freeze", "blind"] as const)(
  "nullifies %s before reflection without cancelling direct damage",
  (type) => {
    produce(ready(), (game) => {
      const target = game.team[0]!,
        source = game.battle!.enemies[0]!;
      Object.assign(target.combat!, { nullify: true, reflect: true });
      if (type === "blind") applyBlind(game, source, target, []);
      else hit(game, source, target, 2, type, [], { proc: true, leech: true });
      expect(target.combat![type]).toBe(type === "blind" ? false : 0);
      expect(target.combat!.nullify).toBe(false);
      expect(target.combat!.reflect).toBe(true);
      expect(target.combat!.bleedLeech).toEqual([]);
      expect(target.health).toBe(type === "blind" ? 24 : 22);
    });
  },
);

it("retains Nullify through turns, blocked damage, immunity, periodic ticks and existing Blind; allows Purge", () => {
  produce(ready(), (game) => {
    const target = game.team[0]!,
      source = game.battle!.enemies[0]!;
    target.combat!.nullify = true;
    target.block = 5;
    hit(game, source, target, 2, "poison", [], { proc: true });
    target.block = 0;
    target.combat!.cooldown = 3;
    hit(game, source, target, 2, "stun", [], { proc: true });
    target.combat!.poison = 2;
    tickStatuses(game, target, []);
    target.combat!.blind = true;
    applyBlind(game, source, target, []);
    startAction(target, [], game);
    expect(target.combat!.nullify).toBe(true);
    removeEffects(target, "purge", 1, [], game);
    expect(target.combat!.nullify).toBe(false);
  });
});

it("stops a reflected harmful status with Nullify", () => {
  produce(ready(), (game) => {
    const target = game.team[0]!,
      source = game.battle!.enemies[0]!;
    source.combat.reflect = true;
    target.combat!.nullify = true;
    hit(game, target, source, 2, "poison", [], { proc: true });
    expect(source.combat.poison).toBe(0);
    expect(target.combat!.poison).toBe(0);
    expect(target.combat!.nullify).toBe(false);
  });
});

it("retains Nullify and spent Encore through swapping and resume, and resets them next battle", () => {
  let game = produce(ready("chimecricket-nullify"), (draft) => {
    const backup = { ...draft.team[1]!, id: "backup", combat: freshCombat() };
    draft.reserves.push(backup);
    draft.roster.push(backup.species);
  });
  game = play(game).state;
  game = accept(game, { type: "swap", activeId: "ally-0", reserve: "backup" });
  game = decodeSave(encodeSave(game));
  expect(game.reserves[0]!.combat!.nullify).toBe(true);
  expect(game.reserves[0]!.combat!.encoreUsed).toBe(true);
  game = accept(game, { type: "swap", activeId: "backup", reserve: "ally-0" });
  expect(game.team[0]!.combat!.encoreUsed).toBe(true);
  game = produce(game, (draft) => {
    draft.phase = "teamSelection";
    draft.battle = null;
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.team[0]!.combat!.nullify).toBe(false);
  expect(game.team[0]!.combat!.encoreUsed).toBe(false);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 30 }))).toThrow();
});

it("stops the repeated attack when its target falls and does not grant its extra draw", () => {
  const game = produce(ready("chimecricket-attack", 1972), (draft) => {
    draft.battle!.enemies[0]!.health = 1;
  });
  const result = play(game, "enemy-0");
  expect(result.events.filter((e) => e.kind === "damage")).toHaveLength(1);
  expect(result.state.battle!.hand).toHaveLength(1);
});

it("caps combined talent and Encore repeats at two complete resolutions", () => {
  let found = false;
  for (let seed = 0; seed < 10000 && !found; seed++) {
    const a = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const b = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    if (a / 4294967296 >= 0.1 || b / 4294967296 >= 0.1) continue;
    const game = produce(ready("chimecricket-attack", seed), (draft) => {
      draft.talents = ["stun.jarring-blow"];
    });
    const result = play(game, "enemy-0");
    expect(result.events.filter((e) => e.kind === "damage")).toHaveLength(2);
    expect(result.state.battle!.mana).toBe(3);
    found = true;
  }
  expect(found).toBe(true);
});

it("discovers and recruits Chimecricket into the normal roster", () => {
  const initial = createGame(7);
  let game = accept(
    accept(initial, {
      type: "draft",
      species: initial.starterOffers.find((kind) => kind !== "chimecricket")!,
    }),
    { type: "start" },
  );
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = COMBAT_PACKS.findIndex((pack) => pack[0] === "chimecricket");
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("chimecricket");
  game = accept(winBattle(game), { type: "recruit", species: "chimecricket" });
  expect(game.discovery.recruited.chimecricket).toBe(1);
  expect(
    game.cards.filter((card) => content.definition(card.definitionId).species === "chimecricket"),
  ).toHaveLength(3);
  expect(decodeSave(encodeSave(game))).toEqual(game);
});

it.each(["Resonant Leap", "Hush Dome", "Lullaby Drift"])(
  "enemy %s uses base Encore and the correct side",
  (name) => {
    let found = false;
    for (let seed = 0; seed < 2000 && !found; seed++) {
      const game = produce(ready("chimecricket-nullify", seed), (draft) => {
        draft.discovery.recruited.chimecricket = 6;
        const enemies = draft.battle!.enemies;
        enemies[0]!.species = "chimecricket";
        enemies[0]!.name = "Chimecricket";
        // Enemy selection uses the first roll, Encore the second
        for (const unit of draft.team) unit.block = 100;
        enemies[1]!.health = 8;
        enemies[1]!.combat.blind = true;
        enemies[1]!.combat.controlled = "freeze";
        enemies[1]!.combat.controlTurns = 1;
        enemies[2]!.health = 0;
      });
      const a = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const b = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      const result = dispatch(game, { type: "endTurn" });
      if (!result.events.some((e) => e.actorId === "enemy-0" && e.text.includes(`uses ${name}`))) continue;
      const repeats = result.events.some((e) => e.actorId === "enemy-0" && e.text.includes("with Encore"));
      expect(repeats).toBe(b / 4294967296 < 0.1);
      if (!repeats) continue;
      if (name === "Resonant Leap") {
        expect(result.events.filter((e) => e.kind === "damage" && e.actorId === "enemy-0")).toHaveLength(2);
      } else if (name === "Hush Dome") {
        expect(result.state.battle!.enemies.map((e) => e.combat.nullify)).toEqual([true, true, false]);
        expect(result.state.team.every((e) => !e.combat!.nullify)).toBe(true);
      } else {
        expect(
          result.events.filter((e) => e.kind === "heal" && e.targetId === "enemy-1" && e.amount === 4),
        ).toHaveLength(2);
        expect(result.state.battle!.enemies[1]!.combat.blind).toBe(false);
        expect(result.state.battle!.enemies[1]!.combat.controlled).toBeNull();
      }
      found = true;
    }
    expect(found).toBe(true);
  },
);

it("stops Encore when retaliation knocks out its actor", () => {
  const game = produce(ready("chimecricket-attack", 1972), (draft) => {
    draft.team[0]!.health = 1;
    draft.team[0]!.combat!.deathDoorUsed = true;
    draft.battle!.enemies[0]!.combat.thorns = 10;
  });
  const result = play(game, "enemy-0");
  expect(result.state.team[0]!.health).toBe(0);
  expect(result.events.filter((e) => e.kind === "damage" && e.actorId === "ally-0")).toHaveLength(1);
  expect(result.events.some((e) => e.text.includes("with Encore"))).toBe(false);
});

it("offers Hush Dome without a target only while allies need protection", () => {
  const game = ready("chimecricket-nullify");
  expect(battleChoices(game, false)).toEqual([
    { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false },
  ]);
  const protectedGame = produce(game, (draft) => {
    draft.team.forEach((unit) => {
      unit.combat!.nullify = true;
    });
  });
  expect(battleChoices(protectedGame, false)).toEqual([]);
  expect(game.team[0]!.combat!.encoreUsed).toBe(false);
  expect(game.rng).toBe(1);
});

it("does not spend Nullify on a Dodge or capped Poison", () => {
  produce(ready(), (game) => {
    const target = game.team[0]!,
      source = game.battle!.enemies[0]!;
    target.combat!.nullify = true;
    game.rng = 1972;
    hit(game, source, target, 2, "poison", []);
    expect(target.health).toBe(24);
    expect(target.combat!.nullify).toBe(true);
    target.combat!.poison = 1000000;
    hit(game, source, target, 2, "poison", [], { proc: true });
    expect(target.combat!.nullify).toBe(true);
  });
});

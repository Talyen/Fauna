import { expect, it, vi } from "vitest";
import { produce } from "immer";
import { executeAbility } from "../../../src/game/combat/abilities";
import { abilityExtras } from "../../../src/game/combat/ability-values";
import { CARDS, definition, species } from "../../../src/game/content";
import { enemyCanUse, enemyCard, cardText } from "../../../src/game/card-rules";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { actionValue, enemyAbilityValue } from "../../../src/game/ability-rules";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameEvent } from "../../../src/game/types";
import { requireBattle, teamRun } from "../../support/game";

it.each(CARDS.filter((card) => enemyCanUse(card) && card.effect !== "draw"))(
  "$id resolves the same combat effects on either side at base room power",
  (authored) => {
    const game = produce(teamRun(1, [authored.species, "prismram", "mossguard"]), (draft) => {
      draft.rng = 1;
      draft.team.forEach((unit) => {
        unit.health = species(unit.species).health - 5;
        unit.block = 0;
        unit.combat = freshCombat();
      });
      draft.battle!.enemies = draft.team.map((unit, index) => ({
        id: `enemy-${index}`,
        name: species(unit.species).name,
        species: unit.species,
        health: unit.health,
        maxHealth: species(unit.species).health,
        power: 1,
        targetId: "ally-0",
        block: 0,
        combat: freshCombat(),
        lastAbility: null,
      }));
    });
    // Remove only the approved hand/Mana extras for this mirrored combat comparison.
    const def = enemyCard(authored);
    const resolve = (side: "player" | "enemy") => {
      const events: GameEvent[] = [];
      const swap = vi.fn();
      const state = produce(game, (draft) => {
        if (side === "player")
          executeAbility(
            requireBattle(draft),
            {
              side,
              def,
              actor: draft.team[0]!,
              value: actionValue(
                { id: "test", ownerId: "ally-0", definitionId: authored.id, level: 0 },
                draft.team[0]!,
                draft,
              ),
              targetId: "enemy-0",
              allyTargetId: "ally-0",
            },
            events,
            { swap },
          );
        else
          executeAbility(
            requireBattle(draft),
            {
              side,
              def,
              actor: draft.battle!.enemies[0]!,
              value: enemyAbilityValue(draft.battle!.enemies[0]!, def),
              targetId: "ally-0",
              allyTargetId: "enemy-0",
            },
            events,
            { swap },
          );
      });
      const friendly = side === "player" ? state.team : state.battle!.enemies;
      const opposing = side === "player" ? state.battle!.enemies : state.team;
      const units = (row: typeof friendly) =>
        row.map(({ health, block, combat }) => ({ health, block, combat }));
      const result = {
        friendly: units(friendly),
        opposing: units(opposing),
        rng: state.rng,
        events: events.filter((event) => event.kind !== "action"),
        swaps: swap.mock.calls.length,
      };
      const friendPrefix = side === "player" ? "ally-" : "enemy-";
      const foePrefix = side === "player" ? "enemy-" : "ally-";
      return JSON.stringify(result).replaceAll(friendPrefix, "FRIEND-").replaceAll(foePrefix, "FOE-");
    };
    expect(resolve("enemy")).toBe(resolve("player"));
  },
);

it("scales authored magnitudes without scaling percentages, effect counts or resources", () => {
  const enemy = { species: "mossguard" as const, power: 1.5, combat: freshCombat() };
  expect(enemyAbilityValue(enemy, definition("mossguard-attack"))).toBe(3);
  expect(enemyAbilityValue(enemy, definition("mossguard-guard"))).toBe(9);
  expect(enemyAbilityValue(enemy, definition("mossguard-heal"))).toBe(3);
  expect(enemyAbilityValue({ ...enemy, species: "dunefox" }, definition("dunefox-dodge"))).toBe(30);
  const def = {
    ...definition("mossguard-attack"),
    effects: [
      { kind: "damage" as const, damageType: "burn" as const, amount: 3 },
      { kind: "heal" as const, amount: 3 },
      { kind: "cleanse" as const, amount: 1 },
      { kind: "mana" as const, amount: 1 },
      { kind: "draw" as const, amount: 2 },
      { kind: "meltArmor" as const, amount: 50 },
    ],
  };
  expect(abilityExtras(def, 1.5).map((effect) => effect.amount)).toEqual([5, 5, 1, 1, 2, 50]);
  expect(cardText(def, 0, 3, 1.5)).toContain("Deal 5 Burn damage; Restore 5 Health");
  expect(enemyCanUse(definition("neradora-tide-cup"))).toBe(false);
  const ram = { species: "sternshell" as const, power: 1.1, combat: { ...freshCombat(), armor: 1 } };
  expect(enemyAbilityValue(ram, definition("sternshell-attack"))).toBe(6);
  expect(cardText(definition("sternshell-attack"), 0, 6, ram.power)).toBe(
    "Deal 3 Physical damage; Doubled if you have Armor",
  );
  const converted = enemyCard(
    CARDS.find((card) => card.effect === "draw" && card.effects?.some((effect) => effect.kind === "heal"))!,
  );
  expect(converted.effect).toBe("heal");
  expect(converted.target).toBe("self");
});

it.each(["player", "enemy"] as const)(
  "%s attacks have the same base Critical chance and control threshold",
  (side) => {
    const events: GameEvent[] = [];
    produce(teamRun(1, ["mossguard", "prismram", "emberback"]), (game) => {
      const actor = side === "player" ? game.team[0]! : game.battle!.enemies[0]!;
      const target = side === "player" ? game.battle!.enemies[0]! : game.team[0]!;
      target.species = "mossguard";
      if ("maxHealth" in target) target.maxHealth = 32;
      target.health = 20;
      target.block = 0;
      target.combat = freshCombat();
      // The first roll misses Dodge; the second is below 5%.
      let seed = 1;
      while (true) {
        const first = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const second = (Math.imul(first, 1664525) + 1013904223) >>> 0;
        if (first / 2 ** 32 >= 0.05 && second / 2 ** 32 < 0.05) break;
        seed++;
      }
      game.rng = seed;
      hit(game, actor, target, 2, "physical", events);
      expect(events.find((event) => event.kind === "damage")).toMatchObject({ amount: 4, critical: true });
      target.health = 20;
      target.combat = freshCombat();
      game.rng = 1;
      hit(game, actor, target, 10, "freeze", events);
      expect(target.combat.controlled).toBeNull();
      hit(game, actor, target, 6, "freeze", events, { origin: "proc" as const });
      expect(target.combat.controlled).toBe("freeze");
    });
  },
);

it("replays identical full command results after save/resume and keeps previews detached", () => {
  const game = teamRun(17, ["reedstag", "ringpalm", "sternshell"]);
  const before = encodeSave(game);
  for (const id of game.battle!.hand) {
    const card = game.cards.find((entry) => entry.id === id)!;
    const def = definition(card.definitionId);
    const targetId = def.effect === "attack" ? "enemy-0" : "ally-0";
    const command = { type: "play" as const, cardId: id, targetId, autoEndTurn: false };
    expect(dispatch(decodeSave(before), command)).toEqual(dispatch(game, command));
    const preview = previewCard(game, id, targetId);
    expect(preview).toEqual(dispatch(game, command));
  }
  expect(dispatch(decodeSave(before), { type: "endTurn" })).toEqual(dispatch(game, { type: "endTurn" }));
  expect(encodeSave(game)).toBe(before);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 41 }))).toThrow();
});

it("never grants unearned enemy healing at the round boundary", () => {
  const game = produce(teamRun(1, ["mossguard", "prismram", "emberback"]), (draft) => {
    for (const enemy of draft.battle!.enemies) {
      enemy.health -= 5;
      enemy.combat.controlled = "stun";
      enemy.combat.controlTurns = 1;
    }
  });
  const result = dispatch(game, { type: "endTurn" });
  expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
    game.battle!.enemies.map((enemy) => enemy.health),
  );
  expect(result.events.some((event) => event.kind === "heal" && event.targetId?.startsWith("enemy-"))).toBe(
    false,
  );
});

it("applies room power once to primary Block and supplemental damage/healing before ordinary defenses", () => {
  const events: GameEvent[] = [];
  const def = {
    ...definition("mossguard-guard"),
    effects: [
      { kind: "damage" as const, damageType: "burn" as const, amount: 3 },
      { kind: "heal" as const, amount: 3 },
      { kind: "draw" as const, amount: 1 },
      { kind: "mana" as const, amount: 1 },
    ],
  };
  const initial = teamRun(1, ["mossguard", "prismram", "emberback"]);
  const next = produce(initial, (draft) => {
    draft.rng = 1;
    const actor = draft.battle!.enemies[0]!;
    actor.species = "mossguard";
    actor.power = 1.5;
    actor.health = actor.maxHealth - 10;
    actor.combat = freshCombat();
    draft.team[0]!.block = 2;
    executeAbility(
      requireBattle(draft),
      {
        side: "enemy",
        actor,
        def,
        value: enemyAbilityValue(actor, def),
        targetId: "ally-0",
        allyTargetId: actor.id,
      },
      events,
      { swap: vi.fn() },
    );
  });
  expect(next.battle!.enemies[0]!.block).toBe(9);
  expect(next.battle!.enemies[0]!.health).toBe(initial.battle!.enemies[0]!.maxHealth - 5);
  expect(events.filter((event) => event.kind === "damage")).toEqual([
    expect.objectContaining({ amount: 3, damageType: "burn" }),
  ]);
  expect(next.team[0]!.combat!.burn).toBe(3);
  expect(next.battle!.hand).toEqual(initial.battle!.hand);
  expect(next.battle!.mana).toBe(initial.battle!.mana);
});

it.each([
  [1, 3, 0],
  [1000, 0, 2],
])(
  "mixed protection at seed %i scales Block but retains the authored Thorns count",
  (seed, block, thorns) => {
    const events: GameEvent[] = [];
    const def = CARDS.find((card) => card.effect === "teamProtection")!;
    const next = produce(teamRun(1, ["mossguard", "prismram", "emberback"]), (draft) => {
      draft.rng = seed;
      draft.battle!.enemies.forEach((unit) => {
        unit.block = 0;
        unit.combat = freshCombat();
      });
      const actor = draft.battle!.enemies[0]!;
      actor.species = def.species;
      actor.power = 1.5;
      executeAbility(
        requireBattle(draft),
        {
          side: "enemy",
          actor,
          def,
          value: enemyAbilityValue(actor, def),
          targetId: "ally-0",
        },
        events,
        { swap: vi.fn() },
      );
    });
    expect(next.battle!.enemies.map((unit) => [unit.block, unit.combat.thorns])).toEqual([
      [block, thorns],
      [block, thorns],
      [block, thorns],
    ]);
    expect(cardText(def, 0, 2, 1.5)).toBe("Grant all allies 3 Block or 2 Thorns");
  },
);

it.each(["player", "enemy"] as const)(
  "%s knockout during retaliation stops area targets, extras and repeats, while Death's Door permits continuation",
  (side) => {
    const def = { ...definition("ringpalm-harmonic-set"), repeatChance: 100 };
    for (const survives of side === "player" ? [false, true] : [false]) {
      const state = structuredClone(teamRun(42, ["ringpalm", "mossguard", "prismram"]));
      const enemy = state.battle!.enemies[0]!;
      state.battle!.enemies = Array.from({ length: 3 }, (_, index) => ({
        ...structuredClone(enemy),
        id: `enemy-${index}`,
      }));
      const actor = side === "player" ? state.team[0]! : state.battle!.enemies[0]!;
      const targets = side === "player" ? state.battle!.enemies : state.team;
      actor.health = 1;
      actor.block = 0;
      actor.combat = freshCombat();
      actor.combat.deathDoorUsed = !survives;
      for (const target of targets) {
        target.health = 20;
        target.block = 0;
        target.combat = freshCombat();
        target.combat.controlled = "stun";
        target.combat.controlTurns = 1;
        target.combat.thorns = 1;
      }
      const events: GameEvent[] = [];
      executeAbility(
        requireBattle(state),
        side === "player"
          ? { side, actor: state.team[0]!, def, value: 1 }
          : { side, actor: state.battle!.enemies[0]!, def, value: 1 },
        events,
        { swap() {} },
      );
      expect(actor.health).toBe(survives ? 1 : 0);
      const hits = events.filter((event) => event.kind === "damage" && event.actorId === actor.id);
      if (survives) expect(hits.length).toBeGreaterThanOrEqual(targets.length * 2);
      else expect(hits).toHaveLength(1);
      expect(actor.combat!.armor).toBe(survives ? 2 : 0);
      for (const target of targets.slice(1)) {
        if (survives) expect(target.health).toBeLessThanOrEqual(18);
        else expect(target.health).toBe(20);
      }
    }
  },
);

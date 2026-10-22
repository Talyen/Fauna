import { expect, it } from "vitest";
import { freshCombat, hit, removeEffects, tickStatuses } from "../../../src/game/combat";
import { species } from "../../../src/game/content";
import type { GameEvent } from "../../../src/game/types";
import { run } from "../../support/game";

it("Open Flank breaking Armor before Erosion triggers Molten Shell only once", () => {
  const state = structuredClone(run());
  state.talents = ["water.erosion"];
  const ally = state.team[0]!;
  const enemy = state.battle!.enemies[0]!;
  ally.combat = freshCombat();
  ally.combat.nextPhysical = 2;
  enemy.species = "emberback";
  enemy.health = enemy.maxHealth = 100;
  enemy.block = 0;
  enemy.combat = freshCombat();
  enemy.combat.controlled = "stun";
  enemy.combat.controlTurns = 1;
  enemy.combat.armor = 2;
  const events: GameEvent[] = [];
  state.rng = 42;

  hit(state, ally, enemy, 3, "water", events);

  expect(enemy.combat.armor).toBe(0);
  expect(
    events
      .filter((event) => event.kind === "damage" && event.actorId === enemy.id && event.damageType === "burn")
      .map((event) => event.targetId),
  ).toEqual(state.team.map((unit) => unit.id));
});

it.each(["burn", "poison", "bleed"] as const)(
  "Last Resort keeps %s cleansed when its own tick crosses the Health threshold",
  (status) => {
    const state = structuredClone(run());
    state.talents = ["health.last-resort"];
    const ally = state.team[0]!;
    ally.combat = freshCombat();
    ally.health = Math.ceil(species(ally.species).health / 4);
    ally.combat[status] = 2;
    ally.combat.statusSources[status] = state.battle!.enemies[0]!.id;
    const events: GameEvent[] = [];

    tickStatuses(state, ally, events);

    expect(events.some((event) => event.status === "cleanse" && event.affectedStatus === status)).toBe(true);
    expect(ally.combat[status]).toBe(0);
    expect(ally.combat.statusSources[status]).toBeUndefined();
    const afterCleanse = ally.health;
    tickStatuses(state, ally, events);
    expect(ally.health).toBe(afterCleanse);
  },
);

it.each(["purge", "damage"] as const)(
  "Reactive Guard grants Block exactly once when %s breaks Armor",
  (effect) => {
    const state = structuredClone(run());
    state.talents = ["armor.reactive-guard"];
    const ally = state.team[0]!;
    ally.combat = freshCombat();
    ally.combat.armor = 1;
    ally.block = 0;
    const events: GameEvent[] = [];
    state.rng = 42;

    if (effect === "purge") removeEffects(ally, "purge", 1, events, state);
    else hit(state, state.battle!.enemies[0]!, ally, 3, "physical", events);

    expect(ally.combat.armor).toBe(0);
    expect(ally.block).toBe(3);
    expect(events.filter((event) => event.kind === "block" && event.amount === 3)).toHaveLength(1);
  },
);

it("Sun-Struck Shield reflects Block spent rather than Reinforce's amplified absorption", () => {
  const state = structuredClone(run());
  state.talents = ["block.reinforce", "block.sun-struck-shield"];
  const ally = state.team[0]!;
  const enemy = state.battle!.enemies[0]!;
  ally.combat = freshCombat();
  ally.block = 50;
  enemy.combat = freshCombat();
  enemy.block = 0;
  enemy.health = enemy.maxHealth = 100;
  const events: GameEvent[] = [];

  hit(state, enemy, ally, 55, "physical", events);

  expect(ally.block).toBe(0);
  expect(enemy.health).toBe(85);
  expect(events.find((event) => event.damageType === "light")?.amount).toBe(15);
});

it("pays Bleed Leech for damage already dealt even when Last Resort Cleanses the wound", () => {
  const state = structuredClone(run());
  state.talents = ["health.last-resort"];
  const target = state.team[0]!;
  const source = state.battle!.enemies[0]!;
  source.health = source.maxHealth - 10;
  target.health = Math.ceil(species(target.species).health / 4);
  target.combat = freshCombat();
  target.combat.bleed = 4;
  target.combat.statusSources.bleed = source.id;
  target.combat.bleedLeech = [{ sourceId: source.id, amount: 4 }];
  const before = source.health;
  const events: GameEvent[] = [];

  tickStatuses(state, target, events);

  expect(target.combat.bleed).toBe(0);
  expect(target.combat.bleedLeech).toEqual([]);
  expect(source.health).toBe(before + 2);
  tickStatuses(state, target, events);
  expect(source.health).toBe(before + 2);
});

it("cancels Thunderstone after Thorns knocks out the acting creature, retaining the landed Stun", () => {
  const state = structuredClone(run());
  state.boons = ["thunderstone"];
  const source = state.team[0]!;
  const target = state.battle!.enemies[0]!;
  source.health = 1;
  source.block = 0;
  source.combat = freshCombat();
  source.combat.deathDoorUsed = true;
  target.health = target.maxHealth = 100;
  target.block = 0;
  target.combat = freshCombat();
  target.combat.thorns = 5;
  const events: GameEvent[] = [];
  state.rng = 42;

  hit(state, source, target, 50, "stun", events);

  expect(source.health).toBe(0);
  expect(target.combat.controlled).toBe("stun");
  expect(target.health).toBe(50);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.damageType)).toEqual([
    "stun",
    "nature",
  ]);
});

it("Last Resort removes active control and all six harmful buildups together", () => {
  const state = structuredClone(run());
  state.talents = ["health.last-resort"];
  const ally = state.team[0]!;
  ally.health = Math.ceil(species(ally.species).health / 4);
  ally.combat = {
    ...freshCombat(),
    controlled: "stun",
    controlTurns: 1,
    burn: 1,
    poison: 1,
    bleed: 1,
    stun: 1,
    freeze: 1,
    blind: true,
  };
  const events: GameEvent[] = [];

  hit(state, state.battle!.enemies[0]!, ally, 2, "physical", events, { origin: "periodic" });

  expect(ally.combat).toMatchObject({
    controlled: null,
    controlTurns: 0,
    burn: 0,
    poison: 0,
    bleed: 0,
    stun: 0,
    freeze: 0,
    blind: false,
  });
});

it.each([999_999, 1_000_000])(
  "Bleed Leech only claims newly added stacks with %i existing Bleed",
  (bleed) => {
    const state = structuredClone(run());
    const ally = state.team[0]!;
    const enemy = state.battle!.enemies[0]!;
    enemy.health = enemy.maxHealth = 1_000_000;
    enemy.block = 0;
    enemy.combat = { ...freshCombat(), bleed, controlled: "stun", controlTurns: 1 };
    state.rng = 42;
    const events: GameEvent[] = [];

    hit(state, ally, enemy, 10, "bleed", events, { origin: "ability", leech: true });

    expect(enemy.combat.bleed).toBe(1_000_000);
    expect(enemy.combat.bleedLeech).toEqual(bleed === 999_999 ? [{ sourceId: ally.id, amount: 1 }] : []);
    ally.health -= 10;
    const before = ally.health;
    tickStatuses(state, enemy, events);
    expect(ally.health - before).toBe(bleed === 999_999 ? 1 : 0);
  },
);

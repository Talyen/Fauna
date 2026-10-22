import { expect, it } from "vitest";
import { freshCombat, hit, removeEffects, tickStatuses } from "../../src/game/combat";
import { species } from "../../src/game/content";
import type { GameEvent } from "../../src/game/types";
import { run } from "./helpers";

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

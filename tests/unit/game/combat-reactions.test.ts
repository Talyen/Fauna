import { expect, it } from "vitest";
import { freshCombat, hit, removeEffects, tickStatuses, startAction } from "../../../src/game/combat/index";
import { finishTurn } from "../../../src/game/combat/turns";
import { requireBattle } from "../../support/game";
import { species } from "../../../src/game/content";
import type { GameEvent } from "../../../src/game/types";
import { run } from "../../support/game";

function blockedHitFixture(block = 20) {
  const state = structuredClone(run());
  state.rng = 1;
  state.talents = [];
  state.boons = [];
  const source = state.team[0]!;
  source.health = 10;
  source.block = 0;
  source.combat = freshCombat();
  const target = state.battle!.enemies[0]!;
  target.species = "mossguard";
  target.health = target.maxHealth = 100;
  target.block = block;
  target.combat = freshCombat();
  const events: GameEvent[] = [];
  return { state, source, target, events };
}

it.each(["player", "enemy"] as const)(
  "Block independence: Thorns retaliate against a blocked %s attack and spend stacks",
  (side) => {
    const { state, source: ally, target: enemy, events } = blockedHitFixture();
    const [source, target] = side === "player" ? [ally, enemy] : [enemy, ally];
    source.block = 0;
    target.block = 20;
    target.combat = { ...freshCombat(), thorns: 5 };
    const before = source.health;
    const health = target.health;
    hit(state, source, target, 4, "nature", events);
    expect(target.health).toBe(health);
    expect(target.block).toBe(16);
    expect(source.health).toBe(before - 5);
    expect(target.combat).toMatchObject({ thorns: 4 });
    expect(events.filter((event) => event.kind === "damage").map((event) => event.damageType)).toEqual([
      "nature",
      "nature",
    ]);
  },
);

it("Block independence: Thorns also retaliate when Armor absorbs an attack", () => {
  const { state, source, target, events } = blockedHitFixture(0);
  target.combat = { ...freshCombat(), armor: 20, thorns: 2 };
  hit(state, source, target, 4, "physical", events);
  expect(target.health).toBe(100);
  expect(source.health).toBe(8);
  expect(target.combat.thorns).toBe(1);
});

it.each(["periodic", "derived", "retaliation"] as const)(
  "Block independence: %s damage cannot start a Thorns chain",
  (origin) => {
    const { state, source, target, events } = blockedHitFixture();
    target.combat.thorns = 3;
    hit(state, source, target, 4, "water", events, { origin });
    expect(source.health).toBe(10);
    expect(target.combat.thorns).toBe(3);
  },
);

it.each([0, 4, 20])("Block independence: Leech and Armor mitigation agree with %i Block", (block) => {
  const { state, source, target, events } = blockedHitFixture(block);
  target.combat.armor = 2;
  hit(state, source, target, 10, "physical", events, { origin: "ability", leech: true });
  expect(source.health).toBe(14);
  expect(target.health).toBe(100 - Math.max(0, 10 - block - 2));
  expect(target.combat.armor).toBe(block >= 10 ? 2 : 1);
});

it("Block independence: Leech counts absorbed damage without claiming overkill", () => {
  const { state, source, target, events } = blockedHitFixture(2);
  target.health = 1;
  hit(state, source, target, 100, "water", events, { origin: "ability", leech: true });
  expect(source.health).toBe(12);
  expect(target.health).toBe(0);
});

it.each(["burn", "poison", "bleed", "stun", "freeze"] as const)(
  "Block independence: fully absorbed %s hits still apply buildup",
  (type) => {
    const { state, source, target, events } = blockedHitFixture();
    hit(state, source, target, 6, type, events);
    expect(target.health).toBe(100);
    expect(target.block).toBe(14);
    expect(target.combat[type]).toBe(6);
  },
);

it.each(["nullify", "reflect"] as const)(
  "Block independence: %s still handles statuses from absorbed hits",
  (protection) => {
    const { state, source, target, events } = blockedHitFixture();
    target.combat[protection] = true;
    hit(state, source, target, 6, "poison", events);
    expect(target.health).toBe(100);
    expect(target.combat.poison).toBe(0);
    expect(target.combat[protection]).toBe(false);
    expect(state.team.reduce((sum, ally) => sum + (ally.combat?.poison ?? 0), 0)).toBe(
      protection === "reflect" ? 6 : 0,
    );
  },
);

it.each([4, 20])("Block independence: Grounding explicitly prevents Stun with %i Block", (block) => {
  const { state, source: ally, target: enemy, events } = blockedHitFixture();
  state.talents = ["block.grounding"];
  ally.block = block;
  hit(state, enemy, ally, 4, "stun", events);
  expect(ally.health).toBe(10);
  expect(ally.combat!.stun).toBe(0);
});

it("Block independence: Dodge still prevents Block spending, buildup, Leech and Thorns", () => {
  const { state, source, target, events } = blockedHitFixture();
  target.combat.thorns = 3;
  hit(state, source, target, 6, "burn", events, { origin: "ability", leech: true, blindMiss: true });
  expect(source.health).toBe(10);
  expect(target.health).toBe(100);
  expect(target.block).toBe(20);
  expect(target.combat).toMatchObject({ burn: 0, thorns: 3 });
});

it("keeps the last controlled turn skipped through recovery and resumes on the following turn", () => {
  const state = structuredClone(run());
  const ally = state.team[0]!;
  ally.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 1 };
  const events: GameEvent[] = [];
  expect(startAction(ally, events, state)).toBe(false);
  expect(ally.combat).toMatchObject({ controlled: null, controlTurns: 0, skipped: true, cooldown: 3 });
  expect(startAction(ally, events, state)).toBe(true);
  expect(ally.combat).toMatchObject({ controlled: null, controlTurns: 0, skipped: false, cooldown: 2 });
  expect(events.filter((event) => event.kind === "status" && event.outcome === "skip")).toHaveLength(1);
});

it("Clean Getaway trims the oldest Bleed obligation without granting a Cleanse reward", () => {
  const state = structuredClone(run());
  state.talents = ["dodge.clean-getaway", "health.renewal"];
  const ally = state.team[0]!;
  const enemy = state.battle!.enemies[0]!;
  ally.health = 5;
  ally.combat = {
    ...freshCombat(),
    bleed: 3,
    statusSources: { bleed: enemy.id },
    bleedLeech: [
      { sourceId: enemy.id, amount: 1 },
      { sourceId: ally.id, amount: 2 },
    ],
  };
  const events: GameEvent[] = [];
  hit(state, enemy, ally, 1, "physical", events, { origin: "ability", blindMiss: true });
  expect(ally.health).toBe(5);
  expect(ally.combat.bleed).toBe(2);
  expect(ally.combat.bleedLeech).toEqual([{ sourceId: ally.id, amount: 2 }]);
  expect(ally.combat.statusSources.bleed).toBe(enemy.id);
  removeEffects(ally, "cleanse", 1, events, state);
  expect(ally.health).toBe(7);
  expect(ally.combat.bleedLeech).toEqual([]);
  expect(ally.combat.statusSources.bleed).toBeUndefined();
});

it("stops after Thorns knock out the attacker", () => {
  const state = structuredClone(run());
  const source = state.team[0]!;
  const target = state.battle!.enemies[0]!;
  source.health = 1;
  source.block = 0;
  source.combat = { ...freshCombat(), deathDoorUsed: true };
  target.block = 0;
  target.combat = { ...freshCombat(), thorns: 2, controlled: "stun", controlTurns: 1 };
  state.rng = 42;
  const events: GameEvent[] = [];
  hit(state, source, target, 1, "water", events);
  expect(source.health).toBe(0);
  expect(target.combat.thorns).toBe(1);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.damageType)).toEqual([
    "water",
    "nature",
  ]);
});

it.each([
  ["mana.dark-recovery", 0, 4],
  ["mana.wellspring", 0, 5],
] as const)("recalculates %s after an automatically skipped turn", (talent, mana, expected) => {
  const state = requireBattle(structuredClone(run()));
  state.talents = [talent];
  state.battle.mana = mana;
  for (const unit of state.team) unit.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 1 };
  for (const enemy of state.battle.enemies)
    enemy.combat = { ...freshCombat(), controlled: "stun", controlTurns: 2 };
  finishTurn(state, []);
  expect(state.battle.turn).toBe(3);
  expect(state.battle.maxMana).toBe(expected);
  expect(state.battle.mana).toBe(expected);
});

it("lets Virulent Leech heal from attributed Poison ticks without adding Poison", () => {
  const state = structuredClone(run());
  state.talents = ["leech.virulent-leech"];
  const source = state.team[0]!;
  const target = state.battle!.enemies[0]!;
  source.health = 10;
  target.health = target.maxHealth;
  target.combat = { ...freshCombat(), poison: 6, statusSources: { poison: source.id } };
  state.rng = 1972; // First production roll succeeds at 10%.
  const events: GameEvent[] = [];
  tickStatuses(state, target, events);
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(1);
  expect(target.combat.poison).toBe(5);
  expect(source.health).toBe(13);
});

it.each(["proc", "statusRetaliation"] as const)(
  "lets Virulent Leech heal once from %s Poison damage",
  (origin) => {
    const state = structuredClone(run());
    state.talents = ["leech.virulent-leech"];
    const source = state.team[0]!;
    const target = state.battle!.enemies[0]!;
    source.health = 10;
    target.block = 0;
    target.combat = freshCombat();
    state.rng = 1972;
    const events: GameEvent[] = [];
    hit(state, source, target, 6, "poison", events, { origin });
    expect(source.health).toBe(13);
    expect(events.filter((event) => event.kind === "heal")).toHaveLength(1);
    expect(target.combat.poison).toBe(6);
  },
);

it("does not grant Virulent Leech to enemy Poison sources", () => {
  const state = structuredClone(run());
  state.talents = ["leech.virulent-leech"];
  const source = state.battle!.enemies[0]!;
  source.health = 10;
  state.rng = 1972;
  const events: GameEvent[] = [];
  hit(state, source, state.team[0]!, 6, "poison", events, { origin: "periodic" });
  expect(source.health).toBe(10);
  expect(events.filter((event) => event.kind === "heal")).toEqual([]);
});

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
      .filter(
        (event): event is Extract<GameEvent, { kind: "damage" }> =>
          event.kind === "damage" && event.actorId === enemy.id && event.damageType === "burn",
      )
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

    expect(
      events.some(
        (event) => event.kind === "status" && event.status === "cleanse" && event.affectedStatus === status,
      ),
    ).toBe(true);
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
    expect(
      events.filter(
        (event): event is Extract<GameEvent, { kind: "block" }> =>
          event.kind === "block" && event.amount === 3,
      ),
    ).toHaveLength(1);
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
  expect(events.find((event) => event.kind === "damage" && event.damageType === "light")?.amount).toBe(15);
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
  expect(
    events
      .filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage")
      .map((event) => event.kind === "damage" && event.damageType),
  ).toEqual(["stun", "nature"]);
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

it("keeps capped Burn attributed to its contributor for periodic kill rewards", () => {
  const state = structuredClone(run());
  state.boons = ["bone-charm"];
  const contributor = state.team[0]!;
  const attacker = state.team[1]!;
  const target = state.battle!.enemies[0]!;
  contributor.health = attacker.health = 5;
  target.block = 0;
  target.combat = {
    ...freshCombat(),
    burn: 1_000_000,
    statusSources: { burn: contributor.id },
  };
  const events: GameEvent[] = [];

  hit(state, attacker, target, 1, "burn", events, { origin: "proc" });
  expect(target.combat.statusSources.burn).toBe(contributor.id);
  tickStatuses(state, target, events);

  expect(target.health).toBe(0);
  expect(contributor.health).toBe(8);
  expect(attacker.health).toBe(5);
});

it("combines Leech and received-healing modifiers before rounding odd Health loss", () => {
  const state = structuredClone(run());
  state.talents = ["leech.desperate-siphon", "health.mending"];
  const source = state.team[0]!;
  const target = state.battle!.enemies[0]!;
  source.health = 5;
  target.block = 0;
  target.combat = freshCombat();
  const events: GameEvent[] = [];

  hit(state, source, target, 3, "water", events, { origin: "proc", leech: true });

  // Half of 3, doubled by Desperate Siphon, then increased by Mending: 3.3 rounds to 3
  expect(source.health).toBe(8);
  expect(events.find((event) => event.kind === "heal" && event.targetId === source.id)?.amount).toBe(3);
});

it.each([
  ["reflect", "reflectBurn"],
  ["nullify", "nullifyFreeze"],
] as const)("counts %s and %s as separate Purge categories", (ordinary, typed) => {
  const state = structuredClone(run());
  const target = state.battle!.enemies[0]!;
  target.block = 0;
  target.combat = { ...freshCombat(), [ordinary]: true, [typed]: true };

  expect(removeEffects(target, "purge", 2, [], state)).toBe(2);
  expect(target.combat[ordinary]).toBe(false);
  expect(target.combat[typed]).toBe(false);
});

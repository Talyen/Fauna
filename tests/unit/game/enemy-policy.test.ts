import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { definition, speciesCards } from "../../../src/game/content";
import type { CardDefinition } from "../../../src/game/content/types";
import { freshCombat, highestHealth, STACK_LIMIT } from "../../../src/game/combat/state";
import { chooseEnemyCard, enemyCardValue } from "../../../src/game/combat/enemy-policy";
import { executeAbility } from "../../../src/game/combat/abilities";
import { finishTurn } from "../../../src/game/combat/turns";
import { intents } from "../../../src/game/journey";
import { observeDecisions } from "../../../src/game/random";
import type { GameEvent } from "../../../src/game/types";
import { requireBattle, run } from "../../support/game";

function fixture() {
  const state = requireBattle(structuredClone(run()));
  state.boons = [];
  state.talents = [];
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.block = 0;
    unit.combat = freshCombat();
    unit.combat.deathDoorUsed = true;
  }
  const enemy = state.battle.enemies[0]!;
  enemy.species = "mossguard";
  enemy.health = enemy.maxHealth = 100;
  enemy.power = 1;
  state.battle.enemies = [enemy];
  state.team.forEach((unit) => {
    unit.health = 20;
  });
  return { state, enemy, target: state.team[0]! };
}
const base = { species: "mossguard", cost: 1, artwork: "action.mossguard.root-wall" } as const;
const attack: CardDefinition = {
  ...base,
  id: "test-attack",
  name: "Attack",
  effect: "attack",
  damageType: "water",
  value: 6,
};
const heal: CardDefinition = {
  ...base,
  id: "test-heal",
  name: "Heal",
  effect: "heal",
  value: 10,
};
const guard: CardDefinition = {
  ...base,
  id: "test-guard",
  name: "Guard",
  effect: "guard",
  target: "self",
  value: 4,
};

describe("enemy targeting and card values", () => {
  it("announces highest current Health, excluding knockouts and reserves, with stable ties", () => {
    const { state, enemy } = fixture();
    state.team[0]!.health = 5;
    state.team[1]!.health = 18;
    state.team[2]!.health = 18;
    state.reserves.push({ ...state.team[0]!, id: "backup", health: 100 });
    const rng = state.rng;
    intents(state);
    expect(enemy.targetId).toBe(state.team[1]!.id);
    expect(state.rng).toBe(rng);
    state.team[1]!.health = 0;
    expect(highestHealth(state.team)?.id).toBe(state.team[2]!.id);
  });

  it("values only Health actually restored and chooses the ally with the largest restoration", () => {
    const { state, enemy } = fixture();
    expect(enemyCardValue(state, enemy, heal, undefined, enemy.id)).toBe(0);
    enemy.health -= 3;
    expect(enemyCardValue(state, enemy, heal, undefined, enemy.id)).toBe(3);
    const ally = { ...structuredClone(enemy), id: "injured-ally", health: 80 };
    state.battle.enemies.push(ally);
    expect(chooseEnemyCard(state, enemy, [attack, heal])).toMatchObject({
      def: heal,
      allyTargetId: ally.id,
      value: 10,
    });
    ally.health = 100;
    expect(chooseEnemyCard(state, enemy, [heal, attack])?.def.id).toBe(attack.id);
  });

  it("sums team healing without counting overhealing or knocked-out allies", () => {
    const { state, enemy } = fixture();
    enemy.health = 98;
    state.battle.enemies.push({ ...structuredClone(enemy), id: "ally", health: 96 });
    state.battle.enemies.push({ ...structuredClone(enemy), id: "fallen", health: 0 });
    expect(enemyCardValue(state, enemy, { ...heal, target: "allAllies" })).toBe(6);
  });

  it("counts actual damage, Block removed, Armor erosion and secondary effects", () => {
    const { state, enemy, target } = fixture();
    target.health = 2;
    expect(enemyCardValue(state, enemy, attack, target.id)).toBe(2);
    target.health = 20;
    target.block = 3;
    expect(enemyCardValue(state, enemy, attack, target.id)).toBe(6);
    target.block = 0;
    target.combat!.armor = 3;
    expect(enemyCardValue(state, enemy, { ...attack, damageType: "physical" }, target.id)).toBe(4);
    target.combat!.armor = 0;
    expect(
      enemyCardValue(
        state,
        enemy,
        {
          ...attack,
          effects: [{ kind: "status", status: "armor", amount: 5 }],
        },
        target.id,
      ),
    ).toBe(11);
    expect(enemyCardValue(state, enemy, { ...attack, target: "allEnemies" })).toBe(18);
  });

  it("subtracts retaliation and counts inflicted status stacks", () => {
    const { state, enemy, target } = fixture();
    target.combat!.thorns = 10;
    // Ten retaliatory damage consumes one opposing Thorns stack.
    expect(enemyCardValue(state, enemy, attack, target.id)).toBe(-3);
    target.combat!.thorns = 0;
    expect(enemyCardValue(state, enemy, { ...attack, damageType: "poison" }, target.id)).toBe(12);
  });

  it("values capped defenses, new flags and useful cleansing instead of nominal values", () => {
    const { state, enemy } = fixture();
    enemy.block = STACK_LIMIT - 2;
    expect(enemyCardValue(state, enemy, guard)).toBe(2);
    const nullify: CardDefinition = { ...base, id: "nullify", name: "Nullify", effect: "nullify", value: 1 };
    expect(enemyCardValue(state, enemy, nullify)).toBe(1);
    enemy.combat.nullify = true;
    expect(enemyCardValue(state, enemy, nullify)).toBe(0);
    const cleanse: CardDefinition = {
      ...base,
      id: "cleanse",
      name: "Cleanse",
      effect: "teamCleanse",
      value: 1,
    };
    expect(enemyCardValue(state, enemy, cleanse)).toBe(0);
    enemy.combat.poison = 7;
    expect(enemyCardValue(state, enemy, cleanse)).toBe(7);
  });

  it("re-evaluates after healing and does not let last-ability avoidance override value", () => {
    const { state, enemy } = fixture();
    enemy.health = 90;
    enemy.lastAbility = heal.id;
    expect(chooseEnemyCard(state, enemy, [guard, heal])?.def.id).toBe(heal.id);
    executeAbility(state, { side: "enemy", actor: enemy, def: heal, value: 10, allyTargetId: enemy.id }, []);
    expect(chooseEnemyCard(state, enemy, [heal, guard])?.def.id).toBe(guard.id);
    expect(chooseEnemyCard(state, enemy, [heal])).toBeUndefined();
  });

  it("ranks duplicate cards and distinct definitions independently on every decision", () => {
    const { state, enemy } = fixture();
    enemy.health = 90;
    const strongerGuard = { ...guard, value: 12 };
    const before = structuredClone(state);
    const choice = chooseEnemyCard(state, enemy, [heal, heal, guard, strongerGuard, strongerGuard]);
    expect(choice).toMatchObject({ def: strongerGuard, allyTargetId: enemy.id, value: 12 });
    expect(state).toEqual(before);
    enemy.block = 10;
    enemy.health = 80;
    expect(chooseEnemyCard(state, enemy, [heal, heal, guard])?.def).toBe(heal);
  });

  it("estimates random attacks across recipients and leaves explicit random targeting intact", () => {
    const { state, enemy } = fixture();
    state.team[0]!.health = 2;
    state.team[1]!.health = 10;
    state.team[2]!.health = 20;
    const random: CardDefinition = { ...attack, target: "randomEnemy" };
    const choice = chooseEnemyCard(state, enemy, [random])!;
    expect(choice.value).toBeGreaterThan(2);
    expect(choice.value).toBeLessThan(6);
    observeDecisions(state, (decision) => (decision?.kind === "index" ? 0 : 0.5));
    const events: GameEvent[] = [];
    executeAbility(
      state,
      { side: "enemy", actor: enemy, def: random, value: 6, targetId: choice.targetId },
      events,
    );
    expect(events.find((event) => event.kind === "damage")?.targetId).toBe(state.team[0]!.id);
  });

  it("does not mutate input, consume live RNG or change decisions when the seed changes", () => {
    const { state, enemy } = fixture();
    const before = structuredClone(state);
    const choice = chooseEnemyCard(state, enemy, [attack, heal, guard]);
    expect(state).toEqual(before);
    state.rng++;
    expect(chooseEnemyCard(state, enemy, [attack, heal, guard])).toEqual(choice);
    // The turn owner passes an Immer draft, rather than a published snapshot.
    expect(
      produce(state, (draft) => {
        chooseEnemyCard(draft, draft.battle.enemies[0]!, [attack, heal, guard]);
      }),
    ).toBe(state);
  });

  it("values actual deck resources after paying Mana and moving the played card", () => {
    const { state, enemy } = fixture();
    enemy.deck = { hand: ["memento-pearl"], draw: [], discard: [], buffer: [], mana: 4, pearls: 1 };
    // Half the probes grant two Block; half restore only the one missing Mana.
    expect(enemyCardValue(state, enemy, definition("memento-pearl"))).toBe(1.5);
    enemy.deck.hand = ["memento-drowned-revelation"];
    enemy.deck.pearls = 0;
    // Mid-turn draws cannot recycle the just-discarded card.
    expect(enemyCardValue(state, enemy, definition("memento-drowned-revelation"))).toBe(0);
    enemy.deck.mana = 0;
    expect(chooseEnemyCard(state, enemy, [definition("memento-drowned-revelation")])).toBeUndefined();
  });

  it("keeps duplicate Legendary card probes equivalent and refreshes them after state changes", () => {
    const { state, enemy } = fixture();
    const pearl = definition("memento-pearl");
    enemy.deck = { hand: [pearl.id, pearl.id], draw: [], discard: [], buffer: [], mana: 4, pearls: 2 };
    const before = structuredClone(state);
    expect(chooseEnemyCard(state, enemy, [pearl, pearl])).toEqual(
      chooseEnemyCard(state, enemy, [pearl, { ...pearl }]),
    );
    expect(state).toEqual(before);
    enemy.deck.mana = 1;
    expect(chooseEnemyCard(state, enemy, [pearl, pearl])).toEqual(
      chooseEnemyCard(state, enemy, [pearl, { ...pearl }]),
    );
    expect(chooseEnemyCard(state, enemy, [pearl, pearl])?.value).toBe(
      enemyCardValue(state, enemy, pearl, state.team[0]!.id, enemy.id),
    );
    const strongerGuard = { ...guard, value: 12 };
    enemy.deck.hand = [guard.id, guard.id];
    expect(chooseEnemyCard(state, enemy, [guard, strongerGuard])?.def).toBe(strongerGuard);
  });

  it("values and executes a Legendary summon and its immediate Echo attack", () => {
    const { state, enemy, target } = fixture();
    enemy.species = "memento";
    enemy.deck = {
      hand: ["memento-lost-procession"],
      draw: [],
      discard: [],
      buffer: [],
      mana: 4,
      pearls: 0,
    };
    const before = structuredClone(state);
    expect(enemyCardValue(state, enemy, definition("memento-lost-procession"), target.id)).toBe(9);
    expect(state).toEqual(before);

    // The turn discards and redraws the hand before choosing its first card.
    const events: GameEvent[] = [];
    finishTurn(state, events);
    expect(events.filter((event) => event.text === "Memento summons an Echo")).toHaveLength(1);
    expect(events.filter((event) => event.text === "The Court Remembers")).toHaveLength(1);
    expect(state.battle.minions?.[0]?.health).toBe(6);
    expect(state.team.reduce((sum, unit) => sum + unit.health, 0)).toBe(57);
    expect(enemy.deck.mana).toBe(3);
  });

  it("retargets after each play and includes living player Minions", () => {
    const { state, enemy } = fixture();
    state.team[0]!.health = 22;
    let choice = chooseEnemyCard(state, enemy, [attack])!;
    expect(choice.targetId).toBe(state.team[0]!.id);
    observeDecisions(state, () => 0.5);
    executeAbility(
      state,
      { side: "enemy", actor: enemy, def: attack, value: 6, targetId: choice.targetId },
      [],
    );
    choice = chooseEnemyCard(state, enemy, [attack])!;
    expect(choice.targetId).toBe(state.team[1]!.id);
    state.battle.minions = [
      {
        ...structuredClone(enemy),
        id: "player-echo",
        name: "Echo",
        species: "memento",
        lastAbility: null,
        health: 25,
        maxHealth: 25,
        minion: { ownerId: state.team[0]!.id, side: "player" },
      },
    ];
    expect(chooseEnemyCard(state, enemy, [attack])?.targetId).toBe("player-echo");
  });

  it("ordinary turns select the best kit card and refresh stale attack targets", () => {
    const { state, enemy } = fixture();
    enemy.species = "prismram";
    state.team[0]!.health = 2;
    state.team[2]!.health = 0;
    enemy.targetId = state.team[0]!.id;
    const expected = chooseEnemyCard(state, enemy, speciesCards(enemy.species))!;
    const events: GameEvent[] = [];
    finishTurn(state, events);
    const action = events.find((event) => event.kind === "action" && event.actorId === enemy.id);
    expect(action?.text).toContain(expected.def.name);
    expect(action?.targetId).toBe(state.team[1]!.id);
  });

  it("Legendary turns rank their current hand and re-evaluate after every play", () => {
    const { state, enemy } = fixture();
    enemy.species = "memento";
    enemy.deck = {
      draw: [
        "memento-treasury-echo",
        "memento-drowned-revelation",
        "memento-lost-procession",
        "memento-lost-procession",
      ],
      hand: [],
      buffer: [],
      discard: [],
      mana: 4,
      pearls: 0,
    };
    const events: GameEvent[] = [];
    finishTurn(state, events);
    const actions = events.filter(
      (event) => event.kind === "action" && event.actorId === enemy.id && event.text.includes(" uses "),
    );
    expect(actions.slice(0, 2).map((event) => event.text)).toEqual([
      `${enemy.name} uses ${definition("memento-lost-procession").name}.`,
      `${enemy.name} uses ${definition("memento-lost-procession").name}.`,
    ]);
    expect(actions[2]?.text).not.toContain("Lost Procession");
    expect(enemy.deck.mana).toBeGreaterThanOrEqual(0);
  });
});

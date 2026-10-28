import { attack as attackDefinition } from "../../../src/game/content/card-builders";
import { describe, expect, it } from "vitest";
import { run, requireBattle, accept, merchantDestination } from "../../support/game";
import { setBattleCards } from "../../support/cards";
import { definition, species, speciesCards } from "../../../src/game/content";
import {
  freshCombat,
  hit,
  applyHarmfulStatus,
  removeEffects,
  startAction,
  sharedControlImmunity,
  controlled,
} from "../../../src/game/combat/index";
import { executeAbility } from "../../../src/game/combat/abilities";
import { useFood } from "../../../src/game/combat/food";
import { finishTurn } from "../../../src/game/combat/turns";
import { observeDecisions } from "../../../src/game/random";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { offerBoons } from "../../../src/game/boon-offers";
import { merchantOfferCount } from "../../../src/game/destinations";
import { returnSlipperCard, rememberSlipperCard } from "../../../src/game/card-zones";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { combatStatuses } from "../../../src/ui/shared/combat/combat-status-model";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = structuredClone(requireBattle(run()));
  const ally = state.team[0]!;
  const enemy = state.battle.enemies[0]!;
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.combat = freshCombat();
    unit.block = 0;
  }
  enemy.health = enemy.maxHealth = 100;
  observeDecisions(state, () => 0.99);
  return { state, ally, enemy, events: [] as GameEvent[] };
}
function attack(f: ReturnType<typeof fixture>, side: "player" | "enemy", all = false) {
  const actor = side === "player" ? f.ally : f.enemy;
  const def = attackDefinition("mossguard-attack", "Rooted Stomp", 4, "physical", {
    target: all ? "allEnemies" : undefined,
  });
  executeAbility(
    f.state,
    side === "player"
      ? { side, actor: f.ally, def, value: 4, targetId: f.enemy.id }
      : { side, actor: f.enemy, def, value: 4, targetId: f.ally.id },
    f.events,
    { swap: () => actor },
  );
}

describe("Sandfold Parasol", () => {
  it.each([0, 2])("shelters the whole attack when the dodging ally is at position %i", (index) => {
    const f = fixture();
    f.state.boons = ["sandfold-parasol"];
    f.state.team[index]!.combat!.dodge = 70;
    // Only the ally with a Dodge bonus succeeds.
    observeDecisions(f.state, () => 0.5);
    const health = f.state.team.map((a) => a.health);
    attack(f, "enemy", true);
    expect(f.state.team.map((a) => a.health)).toEqual(health);
    expect(f.events.filter((e) => e.kind === "status" && e.outcome === "dodge")).toHaveLength(3);
  });
  it("does not shelter an attack when nobody Dodges", () => {
    const f = fixture();
    f.state.boons = ["sandfold-parasol"];
    attack(f, "enemy", true);
    expect(f.state.team.every((a) => a.health < species(a.species).health)).toBe(true);
  });
  it("preserves another ally's Negate when the shared Dodge shelters them", () => {
    const f = fixture();
    f.state.boons = ["sandfold-parasol"];
    f.ally.combat!.negate = true;
    f.state.team[2]!.combat!.dodge = 70;
    observeDecisions(f.state, () => 0.5);
    attack(f, "enemy", true);
    expect(f.ally.combat!.negate).toBe(true);
  });
});

it("Ribbon Spool shares live immunity without copying or extending it", () => {
  const f = fixture();
  f.state.boons = ["ribbon-spool"];
  const bearer = f.state.team[1]!;
  bearer.combat!.cooldown = 2;
  applyHarmfulStatus(f.state, f.enemy, f.ally, 100, "stun", f.events);
  expect(f.ally.combat!.controlled).toBeNull();
  expect(f.ally.combat!.stun).toBe(0);
  expect(f.ally.combat!.cooldown).toBe(0);
  expect(sharedControlImmunity(f.state, f.ally)).toBe(2);
  expect(combatStatuses(f.ally.combat, 0, 2).find((s) => s.id === "ribbonSpool")?.text).toContain(
    "Ribbon Spool",
  );
  bearer.health = 0;
  applyHarmfulStatus(f.state, f.enemy, f.ally, 100, "freeze", f.events);
  expect(f.ally.combat!.controlled).toBe("freeze");
});

it("Dawn Key spends Negate for a Light hit while other attacks are still stopped", () => {
  const f = fixture();
  f.state.boons = ["dawn-key"];
  f.enemy.combat.negate = true;
  hit(f.state, f.ally, f.enemy, 4, "light", f.events);
  expect(f.enemy.health).toBeLessThan(100);
  expect(f.enemy.combat.negate).toBe(false);
  f.enemy.combat.negate = true;
  const health = f.enemy.health;
  hit(f.state, f.ally, f.enemy, 4, "physical", f.events);
  expect(f.enemy.health).toBe(health);
  const def = attackDefinition("mossguard-attack", "Rooted Stomp", 4, "light");
  f.enemy.combat.negate = true;
  expect(ordinaryAttackFacts(f.state, f.ally, def, 4, f.enemy)[0]!.negated).toBe(false);
});

it("Crystal Slipper returns the last played card once and remembers it through save/resume", () => {
  const state = structuredClone(requireBattle(run()));
  const f = { state, ally: state.team[0]!, enemy: state.battle.enemies[0]! };
  f.state.boons = ["crystal-slipper"];
  const card = f.state.cards.find(
    (c) => c.ownerId === f.ally.id && definition(c.definitionId).effect === "attack",
  )!;
  setBattleCards(f.state, [card.id]);
  const played = accept(f.state, { type: "play", cardId: card.id, targetId: f.enemy.id, autoEndTurn: false });
  const resumed = structuredClone(decodeSave(encodeSave(played))!);
  expect(resumed.team[0]!.combat!.slipperCard).toBe(card.id);
  const count = resumed.cards.length;
  hit(resumed, resumed.battle!.enemies[0]!, resumed.team[0]!, 4, "physical", [], {
    origin: "ability",
    blindMiss: true,
  });
  expect(resumed.battle!.hand.filter((id) => id === card.id)).toHaveLength(1);
  returnSlipperCard(resumed, f.ally.id, []);
  expect(resumed.battle!.hand.filter((id) => id === card.id)).toHaveLength(1);
  expect(resumed.cards).toHaveLength(count);
});
it("Crystal Slipper never retrieves a replacement creature's card from the old slot", () => {
  const f = fixture();
  f.state.boons = ["crystal-slipper"];
  const card = f.state.cards.find((c) => c.ownerId === f.ally.id)!;
  rememberSlipperCard(f.state, f.ally.id, card);
  setBattleCards(f.state, [], [card.id]);
  card.ownerId = f.state.team[1]!.id;
  returnSlipperCard(f.state, f.ally.id, f.events);
  expect(f.state.battle.hand).not.toContain(card.id);
});

it("Moonseed refreshes one doubled Thorns retaliation, including a blocked Light hit", () => {
  const f = fixture();
  f.state.boons = ["moonseed"];
  f.enemy.block = 100;
  f.ally.combat!.thorns = 5;
  hit(f.state, f.ally, f.enemy, 4, "light", f.events);
  hit(f.state, f.ally, f.enemy, 4, "light", f.events);
  expect(f.ally.combat!.moonseedReady).toBe(true);
  f.enemy.block = 0;
  hit(f.state, f.enemy, f.ally, 1, "physical", f.events);
  expect(f.enemy.health).toBe(90);
  expect(f.ally.combat!.thorns).toBe(4);
  expect(f.ally.combat!.moonseedReady).toBe(false);
  hit(f.state, f.enemy, f.ally, 1, "physical", f.events);
  expect(f.enemy.health).toBe(86);
});
it("Moonseed does not charge from a missed Light attack or other damage", () => {
  const f = fixture();
  f.state.boons = ["moonseed"];
  hit(f.state, f.ally, f.enemy, 4, "light", f.events, { origin: "ability", blindMiss: true });
  hit(f.state, f.ally, f.enemy, 4, "physical", f.events);
  expect(f.ally.combat!.moonseedReady).toBe(false);
});

it("Bargain Scales adds a unique merchant offer without expanding boss choices", () => {
  const state = structuredClone(merchantDestination(["bargain-scales"]));
  expect(state.support!.stock).toHaveLength(4);
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(merchantOfferCount(state)).toBe(4);
  const offers = offerBoons(state, merchantOfferCount(state));
  expect(offers).toHaveLength(4);
  expect(new Set(offers).size).toBe(4);
  expect(offers).not.toContain("bargain-scales");
  expect(offerBoons(state)).toHaveLength(3);
  state.boons = [];
  expect(merchantOfferCount(state)).toBe(3);
});

it("Dragon's Toothpick prepares one Purge before damage and does not stack", () => {
  const f = fixture();
  f.state.boons = ["dragons-toothpick"];
  useFood(f.state, definition("food-apple"), f.ally.id, f.events);
  useFood(f.state, definition("food-apple"), f.ally.id, f.events);
  f.enemy.block = 20;
  f.enemy.combat.thorns = 5;
  attack(f, "player");
  expect(f.enemy.block).toBe(0);
  expect(f.enemy.health).toBeLessThan(100);
  expect(f.enemy.combat.thorns).toBeGreaterThan(0);
  expect(f.ally.combat!.toothpickReady).toBe(false);
  f.enemy.block = 20;
  attack(f, "player");
  expect(f.enemy.block).toBeGreaterThan(0);
});
it("Food with no ally recipient does not prepare Dragon's Toothpick", () => {
  const f = fixture();
  f.state.boons = ["dragons-toothpick", "cornucopia"];
  useFood(f.state, definition("food-mana-berries"), undefined, f.events);
  expect(f.state.team.every((a) => !a.combat!.toothpickReady)).toBe(true);
});
it("prepared Moonseed and Toothpick survive a valid save", () => {
  const state = structuredClone(run());
  state.boons = ["moonseed", "dragons-toothpick"];
  state.team[0]!.combat!.moonseedReady = true;
  state.team[0]!.combat!.toothpickReady = true;
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

it.each(["stun", "freeze"] as const)(
  "Sleepy Acorn permits Healing through %s, leaving attacks controlled",
  (kind) => {
    const f = fixture();
    f.state.boons = ["sleepy-acorn"];
    f.ally.combat!.controlled = kind;
    f.ally.combat!.controlTurns = 1;
    const heal = speciesCards("mossguard").find((c) => c.effect === "heal")!;
    expect(heal).toBeDefined();
    expect(controlled(f.ally, f.state, heal)).toBe(false);
    expect(controlled(f.ally, f.state, definition("mossguard-attack"))).toBe(true);
    f.state.boons = [];
    expect(controlled(f.ally, f.state, heal)).toBe(true);
  },
);

it.each(["natural", "cleanse"])(
  "Cuckoo Whistle draws the recovering ally's card after %s recovery",
  (how) => {
    const f = fixture();
    f.state.boons = ["cuckoo-whistle"];
    setBattleCards(f.state, []);
    f.ally.combat!.controlled = "stun";
    f.ally.combat!.controlTurns = 1;
    if (how === "natural") startAction(f.ally, f.events, f.state);
    else removeEffects(f.ally, "cleanse", 1, f.events, f.state);
    expect(f.state.battle.hand).toHaveLength(1);
    expect(f.state.cards.find((c) => c.id === f.state.battle.hand[0])!.ownerId).toBe(f.ally.id);
    expect(f.ally.combat!.controlled).toBeNull();
  },
);
it("Cuckoo Whistle does not draw for removing unfinished buildup", () => {
  const f = fixture();
  f.state.boons = ["cuckoo-whistle"];
  setBattleCards(f.state, []);
  f.ally.combat!.stun = 2;
  removeEffects(f.ally, "cleanse", 1, f.events, f.state);
  expect(f.state.battle.hand).toHaveLength(0);
});
it("Nightbloom Bell cleanses ally Blind at turn end through ordinary Cleanse reactions", () => {
  const f = fixture();
  f.state.boons = ["nightbloom-bell"];
  f.ally.combat!.blind = true;
  for (const enemy of f.state.battle.enemies) {
    enemy.combat.controlled = "freeze";
    enemy.combat.controlTurns = 1;
  }
  finishTurn(f.state, f.events);
  expect(f.ally.combat!.blind).toBe(false);
  expect(
    f.events.some(
      (e) =>
        e.kind === "status" &&
        e.targetId === f.ally.id &&
        e.status === "cleanse" &&
        e.affectedStatus === "blind" &&
        e.outcome === "remove",
    ),
  ).toBe(true);
});

it("Sleepy Acorn resolves the complete Healing card without ending control", () => {
  const state = structuredClone(requireBattle(run()));
  state.boons = ["sleepy-acorn"];
  const ally = state.team[0]!;
  ally.health -= 5;
  ally.combat!.controlled = "freeze";
  ally.combat!.controlTurns = 1;
  const card = state.cards.find((c) => c.definitionId === "mossguard-heal")!;
  setBattleCards(state, [card.id]);
  const next = accept(state, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(next.team[0]!.health).toBeGreaterThan(ally.health);
  expect(next.team[0]!.combat!.controlled).toBe("freeze");
  expect(next.battle!.mana).toBe(state.battle.mana - 1);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});
it("Moonseed doubles a Briar Racquet Dodge retaliation only once", () => {
  const f = fixture();
  f.state.boons = ["moonseed", "briar-racquet"];
  f.ally.combat!.thorns = 6;
  f.ally.combat!.moonseedReady = true;
  hit(f.state, f.enemy, f.ally, 1, "physical", f.events, { origin: "ability", blindMiss: true });
  expect(f.enemy.health).toBe(94);
  expect(f.ally.combat!.thorns).toBe(5);
  expect(f.ally.combat!.moonseedReady).toBe(false);
});
it("Nightbloom Bell preserves other effects and does nothing before turn end", () => {
  const f = fixture();
  f.state.boons = ["nightbloom-bell"];
  f.ally.combat!.blind = true;
  f.ally.combat!.poison = 3;
  useFood(f.state, definition("food-apple"), f.ally.id, f.events);
  expect(f.ally.combat!.blind).toBe(true);
  expect(f.ally.combat!.poison).toBe(3);
});

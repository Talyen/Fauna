import { attack as attackDefinition } from "../../../src/game/content/card-builders";
import { describe, expect, it } from "vitest";
import { run, requireBattle } from "../../support/game";
import { definition, species } from "../../../src/game/content";
import { freshCombat, hit, restoreHealth, removeEffects, tickStatuses } from "../../../src/game/combat/index";
import { executeAbility } from "../../../src/game/combat/abilities";
import { useFood } from "../../../src/game/combat/food";
import { decayBlock } from "../../../src/game/combat/turns";
import { observeDecisions } from "../../../src/game/random";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { TOADSTOOL_BREADBOX_CARD_ID, replenishJourneyCards } from "../../../src/game/journey-cards";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = structuredClone(requireBattle(run()));
  const ally = state.team[0]!;
  const enemy = state.battle.enemies[0]!;
  if (state.battle.enemies.length < 2) {
    state.battle.enemies.push({
      ...structuredClone(enemy),
      id: "enemy-1",
      name: "Second Enemy",
    });
  }
  const secondEnemy = state.battle.enemies[1]!;
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.combat = freshCombat();
    unit.block = 0;
  }
  enemy.health = enemy.maxHealth = 100;
  secondEnemy.health = secondEnemy.maxHealth = 100;
  observeDecisions(state, () => 0.99);
  return { state, ally, enemy, secondEnemy, events: [] as GameEvent[] };
}

describe("Artisan Boons", () => {
  it("Amber Spatula restores Health equal to half the Block lost through decay", () => {
    const f = fixture();
    f.state.boons = ["amber-spatula"];
    f.ally.health = 5;
    f.ally.block = 8;
    decayBlock(f.state, f.ally, f.events);
    expect(f.ally.block).toBe(4);
    expect(f.ally.health).toBe(7);

    // Enemy Block decay does not heal enemies.
    f.enemy.health = 50;
    f.enemy.block = 8;
    decayBlock(f.state, f.enemy, f.events);
    expect(f.enemy.block).toBe(4);
    expect(f.enemy.health).toBe(50);
  });

  it("Second Sundial repeats Light attacks against Blinded enemies only", () => {
    const f = fixture();
    f.state.boons = ["second-sundial"];
    const lightAttack = attackDefinition("dawncall-sun-ray", "Sun Ray", 4, "light");
    const physicalAttack = attackDefinition("mossguard-root-strike", "Root Strike", 4, "physical");

    f.enemy.combat!.blind = true;
    executeAbility(
      f.state,
      { side: "player", actor: f.ally, def: lightAttack, value: 4, targetId: f.enemy.id },
      f.events,
    );
    expect(f.enemy.health).toBe(92);

    // Physical attacks against Blinded enemies do not repeat.
    executeAbility(
      f.state,
      { side: "player", actor: f.ally, def: physicalAttack, value: 4, targetId: f.enemy.id },
      f.events,
    );
    expect(f.enemy.health).toBe(88);

    // Unblinded enemies do not repeat Light attacks.
    f.enemy.combat!.blind = false;
    executeAbility(
      f.state,
      { side: "player", actor: f.ally, def: lightAttack, value: 4, targetId: f.enemy.id },
      f.events,
    );
    expect(f.enemy.health).toBe(84);
  });

  it("Vein Survey Chain deals damage reduced by enemy Armor to another enemy without chaining twice", () => {
    const f = fixture();
    f.state.boons = ["vein-survey-chain"];
    f.enemy.combat!.armor = 3;
    f.secondEnemy.combat!.armor = 2;
    hit(f.state, f.ally, f.enemy, 5, "physical", f.events);
    expect(f.enemy.health).toBe(98);
    expect(f.enemy.combat!.armor).toBe(2);
    // 3 damage was reduced by enemy-0's Armor; against enemy-1's 2 Armor it deals 1 damage and does not chain back.
    expect(f.secondEnemy.health).toBe(99);
    expect(f.secondEnemy.combat!.armor).toBe(1);
  });

  it("Sunwell Ewer stores restored Health for the next Light attack and persists through save/resume", () => {
    const f = fixture();
    f.state.boons = ["sunwell-ewer"];
    f.ally.health = species(f.ally.species).health - 5;
    restoreHealth(f.ally, 3, f.events, false, f.state, true, f.ally);
    expect(f.state.battle.sunwellBonus).toBe(3);

    const lightAttack = attackDefinition("dawncall-sun-ray", "Sun Ray", 4, "light");
    const facts = ordinaryAttackFacts(f.state, f.ally, lightAttack, 4, f.enemy);
    expect(facts[0]?.lost).toBe(7);

    // Restore on full-battle state and verify save/resume preserves sunwellBonus.
    const saved = structuredClone(requireBattle(run()));
    saved.boons = ["sunwell-ewer"];
    saved.battle.sunwellBonus = 3;
    const resumed = requireBattle(decodeSave(encodeSave(saved)));
    expect(resumed.battle.sunwellBonus).toBe(3);

    // Physical attack does not consume sunwellBonus.
    const physicalAttack = attackDefinition("mossguard-root-strike", "Root Strike", 4, "physical");
    executeAbility(
      f.state,
      { side: "player", actor: f.ally, def: physicalAttack, value: 4, targetId: f.enemy.id },
      f.events,
    );
    expect(f.state.battle.sunwellBonus).toBe(3);
    expect(f.enemy.health).toBe(96);

    // Next Light attack consumes sunwellBonus (+3 damage) and resets it to 0.
    executeAbility(
      f.state,
      { side: "player", actor: f.ally, def: lightAttack, value: 4, targetId: f.enemy.id },
      f.events,
    );
    expect(f.state.battle.sunwellBonus).toBe(0);
    expect(f.enemy.health).toBe(89);
  });

  it("Rime Spindle adds half of Bleed damage as Freeze buildup on both hits and periodic ticks", () => {
    const f = fixture();
    f.state.boons = ["rime-spindle"];
    hit(f.state, f.ally, f.enemy, 4, "bleed", f.events);
    expect(f.enemy.combat!.bleed).toBe(4);
    expect(f.enemy.combat!.freeze).toBe(2);

    tickStatuses(f.state, f.enemy, f.events);
    expect(f.enemy.combat!.bleed).toBe(0);
    expect(f.enemy.combat!.freeze).toBe(4);
  });

  it("Toadstool Breadbox adds Trail Bread to the deck and preserves Food recipients' Block next turn", () => {
    const state = structuredClone(requireBattle(run()));
    state.boons = ["toadstool-breadbox"];
    replenishJourneyCards(state);
    state.battle.draw.push(TOADSTOOL_BREADBOX_CARD_ID);
    expect(state.cards.some((card) => card.id === TOADSTOOL_BREADBOX_CARD_ID)).toBe(true);

    const ally = state.team[0]!;
    const otherAlly = state.team[1]!;
    ally.combat = freshCombat();
    otherAlly.combat = freshCombat();
    ally.block = 2;
    otherAlly.block = 6;
    const events: GameEvent[] = [];
    useFood(state, definition("food-trail-bread"), ally.id, events);
    expect(ally.block).toBe(8);
    expect(ally.combat.breadboxReady).toBe(true);

    // Save/resume preserves breadboxReady.
    const resumed = requireBattle(decodeSave(encodeSave(state)));
    expect(resumed.team[0]!.combat!.breadboxReady).toBe(true);

    // Next turn decay skips the Food recipient once, while un-fed allies decay normally.
    decayBlock(state, ally, events);
    decayBlock(state, otherAlly, events);
    expect(ally.block).toBe(8);
    expect(ally.combat.breadboxReady).toBe(false);
    expect(otherAlly.block).toBe(3);

    // Following turn decays normally.
    decayBlock(state, ally, events);
    expect(ally.block).toBe(4);
  });

  it("Loom Beater absorbs remaining damage with other allies' Block when an ally's Block breaks", () => {
    const f = fixture();
    f.state.boons = ["loom-beater"];
    const secondAlly = f.state.team[1]!;
    const thirdAlly = f.state.team[2]!;
    const startHealth = f.ally.health;
    f.ally.block = 3;
    secondAlly.block = 4;
    thirdAlly.block = 5;

    hit(f.state, f.enemy, f.ally, 9, "physical", f.events);
    expect(f.ally.block).toBe(0);
    expect(secondAlly.block).toBe(0);
    expect(thirdAlly.block).toBe(3);
    expect(f.ally.health).toBe(startHealth);
  });

  it("Courtly Handwarmer adds the attacker's Armor to Burn hits", () => {
    const f = fixture();
    f.state.boons = ["courtly-handwarmer"];
    f.ally.combat!.armor = 3;
    hit(f.state, f.ally, f.enemy, 4, "burn", f.events);
    expect(f.enemy.health).toBe(96);
    expect(f.enemy.combat!.burn).toBe(7);
  });

  it("Lightning Fork adds Stun hit buildup to other enemies that already have Stun buildup", () => {
    const f = fixture();
    f.state.boons = ["lightning-fork"];
    f.secondEnemy.combat!.stun = 3;
    hit(f.state, f.ally, f.enemy, 5, "stun", f.events);
    expect(f.enemy.combat!.stun).toBe(5);
    expect(f.secondEnemy.combat!.stun).toBe(8);

    // An enemy without existing Stun buildup does not receive the fork.
    f.secondEnemy.combat!.stun = 0;
    hit(f.state, f.ally, f.enemy, 4, "stun", f.events);
    expect(f.enemy.combat!.stun).toBe(9);
    expect(f.secondEnemy.combat!.stun).toBe(0);
  });

  it("Starhook makes the next allied attack a Critical Hit after Purging an enemy effect", () => {
    const f = fixture();
    f.state.boons = ["starhook"];
    // Empty Purge does not arm Starhook.
    removeEffects(f.enemy, "purge", 1, f.events, f.state, undefined, f.ally);
    expect(f.state.battle.starhookReady).toBe(false);

    f.enemy.block = 4;
    removeEffects(f.enemy, "purge", 1, f.events, f.state, undefined, f.ally);
    expect(f.enemy.block).toBe(0);
    expect(f.state.battle.starhookReady).toBe(true);

    const physicalAttack = attackDefinition("mossguard-root-strike", "Root Strike", 5, "physical");
    expect(ordinaryAttackFacts(f.state, f.ally, physicalAttack, 5, f.enemy)[0]?.lost).toBe(10);

    executeAbility(
      f.state,
      { side: "player", actor: f.ally, def: physicalAttack, value: 5, targetId: f.enemy.id },
      f.events,
    );
    expect(f.enemy.health).toBe(90);
    expect(f.state.battle.starhookReady).toBe(false);
  });
});

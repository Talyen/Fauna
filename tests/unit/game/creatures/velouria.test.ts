import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { requireBattle, teamRun } from "../../../support/game";
import { cardId, playCard, setHand } from "../../../support/cards";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { cardText, cardTargeting } from "../../../../src/game/card-rules";
import { grantTemporaryDodge, hit, removeEffects, startAction } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { observeDecisions } from "../../../../src/game/random";
import { previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";

const waltz = "velouria-moonlit-waltz";
const aegis = "velouria-velvet-aegis";
const finale = "velouria-hushed-finale";
function battle() {
  return produce(requireBattle(teamRun(42, ["velouria", "glintstride", "mossguard"])), (draft) => {
    setHand(draft, [waltz, aegis, finale]);
  });
}

describe("Velouria", () => {
  it("authors the selected abilities and six passive tiers", () => {
    expect(speciesCards("velouria").map((card) => [cardText(card), card.cost])).toEqual([
      ["Gain 30% Dodge until your next turn / Retaliate with 3 Freeze damage when you Dodge", 1],
      ["Reflect the next attack against an ally", 1],
      ["Deal 6 Freeze damage to a random enemy", 1],
    ]);
    expect(cardTargeting(definition(aegis))).toBe("ally");
    expect(species("velouria").passiveTiers.map((tier) => tier.effects[0]!.amount)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
  it.each([1, 2, 3, 4, 5, 6])("spreads %i Freeze on an actual Dodge grant", (amount) => {
    produce(battle(), (draft) => {
      draft.discovery.recruited.velouria = amount;
      const enemies = draft.battle.enemies;
      const before = enemies.map((enemy) => enemy.health);
      grantTemporaryDodge(draft, draft.team[0]!, 30, []);
      expect(enemies.map((enemy, i) => before[i]! - enemy.health)).toEqual(enemies.map(() => amount));
      expect(enemies.map((enemy) => enemy.combat.freeze)).toEqual(enemies.map(() => amount));
      draft.team[0]!.combat!.temporaryDodge = 70;
      const unchanged = enemies.map((enemy) => enemy.health);
      grantTemporaryDodge(draft, draft.team[0]!, 30, []);
      expect(enemies.map((enemy) => enemy.health)).toEqual(unchanged);
    });
  });
  it("preserves Waltz retaliation in preview and save, then expires it with Dodge", () => {
    const ready = battle();
    const result = playCard(ready, waltz);
    expect(result.accepted).toBe(true);
    expect(previewCard(ready, cardId(ready, waltz))).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    produce(requireBattle(result.state), (draft) => {
      const actor = draft.team[0]!;
      const enemy = draft.battle.enemies[0]!;
      const before = enemy.health;
      observeDecisions(draft, () => 0);
      hit(draft, enemy, actor, 5, "physical", [], { origin: "ability" });
      expect(enemy.health).toBe(before - 3);
      expect(enemy.combat.freeze).toBeGreaterThanOrEqual(3);
      startAction(actor, [], draft);
      expect(actor.combat!.dodgeFreezeRetaliation).toBe(0);
    });
  });
  it("clears retaliation when temporary Dodge is Purged", () => {
    const result = playCard(battle(), waltz);
    produce(requireBattle(result.state), (draft) => {
      const actor = draft.team[0]!;
      removeEffects(actor, "purge", 1, [], draft, "dodge");
      expect(actor.combat!.temporaryDodge).toBe(0);
      expect(actor.combat!.dodgeFreezeRetaliation).toBe(0);
    });
  });
  it("gives the chosen ally attack reflection, with preview parity", () => {
    const ready = battle();
    const target = ready.team[1]!.id;
    const result = playCard(ready, aegis, target);
    expect(result.accepted).toBe(true);
    expect(result.state.team[1]!.combat!.attackReflection).toBe(true);
    expect(result.state.team[0]!.combat!.attackReflection).toBe(false);
    expect(previewCard(ready, cardId(ready, aegis), target)).toEqual(result);
    produce(requireBattle(result.state), (draft) => {
      const ally = draft.team[1]!;
      const enemy = draft.battle.enemies[0]!;
      const health = ally.health;
      const enemyHealth = enemy.health;
      observeDecisions(draft, () => 0.99);
      hit(draft, enemy, ally, 5, "physical", [], { origin: "ability", cannotDodge: true });
      expect(ally.health).toBe(health);
      expect(enemy.health).toBe(enemyHealth - 5);
      expect(ally.combat!.attackReflection).toBe(false);
    });
  });
  it("Hushed Finale selects one living enemy from the seeded battle RNG", () => {
    const ready = battle();
    const result = playCard(ready, finale);
    expect(result.accepted).toBe(true);
    expect(previewCard(ready, cardId(ready, finale))).toEqual(result);
    expect(
      result.state.battle!.enemies.filter(
        (enemy, index) => enemy.health < ready.battle.enemies[index]!.health,
      ),
    ).toHaveLength(1);
  });
  it("uses the base passive for an enemy and grants reflection to its chosen ally", () => {
    produce(battle(), (draft) => {
      const actor = draft.battle.enemies[0]!;
      actor.species = "velouria";
      const target = draft.battle.enemies[1]!;
      const before = draft.team.map((ally) => ally.health);
      grantTemporaryDodge(draft, actor, 30, []);
      expect(draft.team.map((ally, i) => before[i]! - ally.health)).toEqual(draft.team.map(() => 1));
      executeAbility(
        draft,
        { side: "enemy", actor, def: definition(aegis), value: 1, allyTargetId: target.id },
        [],
      );
      expect(target.combat.attackReflection).toBe(true);
    });
  });
});

import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { requireBattle, teamRun } from "../../../support/game";
import { cardId, playCard, setHand } from "../../../support/cards";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { hit } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { observeDecisions } from "../../../../src/game/random";
import { previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { validateCatalog } from "../../../../src/game/content-validation";
import { availablePlays } from "../../../../src/game/play-queries";
import { battleBenefitFacts, battleBenefits } from "../../../../src/application/battle-benefits";
import { ordinaryAttackFacts } from "../../../../src/game/ability-facts";

const sunflare = "vitrilo-sunflare-cast";
const key = "vitrilo-prism-key";
const kiln = "vitrilo-kilnheart";
function battle() {
  return produce(requireBattle(teamRun(42, ["vitrilo", "glintstride", "mossguard"])), (draft) => {
    setHand(draft, [sunflare, key, kiln]);
  });
}

describe("Vitrilo", () => {
  it("authors the selected abilities and six passive tiers", () => {
    expect(speciesCards("vitrilo").map((card) => [cardText(card), card.cost])).toEqual([
      ["Deal 6 Light damage", 1],
      ["Purge an enemy / Steal the effect purged", 1],
      ["Restore 3 Health; Gain 3 Block", 1],
    ]);
    expect(species("vitrilo").passiveTiers.map((tier) => tier.effects[0]!.amount)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });
  it.each([1, 2, 3, 4, 5, 6])("steals %i Block before allied Light damage", (amount) => {
    produce(battle(), (draft) => {
      draft.discovery.recruited.vitrilo = amount;
      const attacker = draft.team[1]!;
      const enemy = draft.battle.enemies[0]!;
      enemy.block = 10;
      observeDecisions(draft, () => 0.99);
      hit(draft, attacker, enemy, 3, "light", [], {
        origin: "ability",
        attackAbility: true,
        cannotDodge: true,
      });
      expect(attacker.block).toBe(amount);
      expect(enemy.block).toBe(Math.max(0, 10 - amount - 3));
    });
  });
  it("does not steal on a miss, non-Light damage, or while Vitrilo is in backup", () => {
    produce(battle(), (draft) => {
      const actor = draft.team[1]!;
      const enemy = draft.battle.enemies[0]!;
      observeDecisions(draft, () => 0.99);
      enemy.block = 20;
      hit(draft, actor, enemy, 3, "light", [], { origin: "ability", attackAbility: true, blindMiss: true });
      hit(draft, actor, enemy, 3, "physical", [], {
        origin: "ability",
        attackAbility: true,
        cannotDodge: true,
      });
      draft.reserves.push(draft.team.shift()!);
      hit(draft, actor, enemy, 3, "light", [], { origin: "ability", attackAbility: true, cannotDodge: true });
      expect(actor.block).toBe(0);
      expect(enemy.block).toBe(14);
    });
  });
  it("does not steal for Light damage from a support effect", () => {
    produce(battle(), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      enemy.block = 10;
      observeDecisions(draft, () => 0.99);
      hit(draft, draft.team[0]!, enemy, 3, "light", [], { origin: "ability", cannotDodge: true });
      expect(draft.team[0]!.block).toBe(0);
      expect(enemy.block).toBe(7);
    });
  });
  it("steals the full purged Block with preview and save parity", () => {
    const ready = produce(battle(), (draft) => {
      draft.battle.enemies[0]!.block = 7;
    });
    const target = ready.battle.enemies[0]!.id;
    const result = playCard(ready, key, target);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.block).toBe(7);
    expect(result.state.battle!.enemies[0]!.block).toBe(0);
    expect(previewCard(ready, cardId(ready, key), target)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
  it("gains nothing from an unprotected target", () => {
    const ready = battle();
    const result = playCard(ready, key, ready.battle.enemies[0]!.id);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.block).toBe(0);
    expect(result.state.team[0]!.combat.armor).toBe(0);
  });
  it.each([
    "armor",
    "thorns",
    "dodge",
    "reflect",
    "reflectBurn",
    "nullify",
    "nullifyFreeze",
    "negate",
    "attackReflection",
  ] as const)("steals the purged %s effect", (effect) => {
    const ready = produce(battle(), (draft) => {
      const stats = draft.battle.enemies[0]!.combat;
      if (effect === "armor" || effect === "thorns" || effect === "dodge") stats[effect] = 3;
      else stats[effect] = true;
      if (effect === "dodge") stats.temporaryDodge = 12;
    });
    const result = playCard(ready, key, ready.battle.enemies[0]!.id);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.combat[effect]).toBe(
      effect === "armor" || effect === "thorns" || effect === "dodge" ? 3 : true,
    );
    if (effect === "dodge") expect(result.state.team[0]!.combat.temporaryDodge).toBe(12);
  });
  it("restores Health and gains Block from Kilnheart", () => {
    const ready = produce(battle(), (draft) => {
      draft.team[0]!.health -= 5;
    });
    const result = playCard(ready, kiln);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.health).toBe(ready.team[0]!.health + 3);
    expect(result.state.team[0]!.block).toBe(3);
  });
  it("scores Prism Key against protected targets and values Kilnheart at full Health", () => {
    const ready = produce(battle(), (draft) => {
      draft.battle.enemies[0]!.block = 7;
      draft.battle.enemies[1]!.block = 0;
    });
    const plays = availablePlays(ready);
    const facts = battleBenefitFacts(ready);
    const prism = plays.find((play) => play.def.id === key)!;
    const scores = battleBenefits(ready, prism, facts);
    expect(scores.find((score) => score.targetId === ready.battle.enemies[0]!.id)!.score).toBeGreaterThan(0);
    expect(scores.find((score) => score.targetId === ready.battle.enemies[1]!.id)!.score).toBe(0);
    const hearth = plays.find((play) => play.def.id === kiln)!;
    expect(battleBenefits(ready, hearth, facts)[0]!.score).toBeGreaterThan(0);
  });
  it("counts stolen Block when estimating ordinary Light attacks", () => {
    const ready = produce(battle(), (draft) => {
      draft.battle.enemies[0]!.block = 6;
    });
    const [fact] = ordinaryAttackFacts(
      ready,
      ready.team[0]!,
      definition(sunflare) as Extract<ReturnType<typeof definition>, { effect: "attack" }>,
      6,
      ready.battle.enemies[0]!,
    );
    expect(fact!.lost).toBe(1);
  });
  it("gives enemy Vitrilo the base-tier passive and its own stolen effect", () => {
    produce(battle(), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      enemy.species = "vitrilo";
      const ally = draft.team[0]!;
      ally.block = 8;
      observeDecisions(draft, () => 0.99);
      hit(draft, enemy, ally, 3, "light", [], { origin: "ability", attackAbility: true, cannotDodge: true });
      expect(enemy.block).toBe(1);
      expect(ally.block).toBe(4);
      executeAbility(
        draft,
        { side: "enemy", actor: enemy, def: definition(key), value: 1, targetId: ally.id },
        [],
      );
      expect(ally.block).toBe(0);
      expect(enemy.block).toBe(5);
    });
  });
  it("gives a reflected Prism Key's stolen effect to its reflector", () => {
    produce(battle(), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      const ally = draft.team[0]!;
      enemy.block = 7;
      ally.block = 4;
      ally.combat.reflect = true;
      draft.boons.push("star-hoop");
      executeAbility(
        draft,
        { side: "enemy", actor: enemy, def: definition(key), value: 1, targetId: ally.id },
        [],
      );
      expect(enemy.block).toBe(0);
      expect(ally.block).toBe(11);
    });
  });
});

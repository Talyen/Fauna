import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { brumalynBattle } from "../../../support/brumalyn";
import { playCard as play } from "../../../support/cards";
import { addReserve, accept, authoredPack, starterJourney, winBattle } from "../../../support/game";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { cardText, enemyCard } from "../../../../src/game/card-rules";
import { hit, freshCombat } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { observeDecisions } from "../../../../src/game/random";
import { previewCard } from "../../../../src/game/engine";
import { battleChoices } from "../../../../src/application/battle-policy";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { validateCatalog } from "../../../../src/game/content-validation";
import { COMBAT_PACKS } from "../../../../src/game/encounters";

const ward = "brumalyn-warmth-ward";
const pounce = "brumalyn-rime-pounce";
const howl = "brumalyn-frost-howl";

describe("Brumalyn", () => {
  it("authors the selected one-Mana kit and six tiers", () => {
    expect(speciesCards("brumalyn").map((card) => [cardText(card), card.cost])).toEqual([
      ["Restore 1 Health to all allies; Cleanse Freeze build-up from all allies", 1],
      ["Deal 6 Freeze damage", 1],
      ["Deal 2 Freeze or Stun damage at random to all enemies", 1],
    ]);
    expect(species("brumalyn").passiveTiers.map((tier) => tier.effects)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => [{ kind: "wintersReprieve", amount }]),
    );
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("discovers, recruits and resumes Brumalyn through an authored encounter", () => {
    const ready = produce(starterJourney(7, "captoad"), (draft) => {
      const index = COMBAT_PACKS.findIndex((pack) => pack[0] === "brumalyn");
      expect(index).toBeGreaterThanOrEqual(0);
      draft.expedition!.pack = authoredPack(draft.encounter, index);
      draft.expedition!.recruit = null;
    });
    const battle = accept(ready, { type: "beginBattle" });
    expect(battle.discovery.encountered).toContain("brumalyn");
    const recruited = accept(winBattle(battle), { type: "recruit", species: "brumalyn" });
    expect(recruited.team.some((ally) => ally.species === "brumalyn")).toBe(true);
    expect(recruited.discovery.recruited.brumalyn).toBe(1);
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
  });

  it("heals the living team before removing Freeze buildup, without releasing active Freeze or removing other statuses", () => {
    const before = produce(brumalynBattle(), (draft) => {
      draft.team[2]!.combat!.controlled = "freeze";
      draft.team[2]!.combat!.controlTurns = 1;
      addReserve(draft, "backup", "stillara", 12, { ...freshCombat(), freeze: 5 });
    });
    const result = play(before, ward);
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((ally) => ally.health)).toEqual([19, 21, 24]);
    expect(result.state.team.map((ally) => ally.combat!.freeze)).toEqual([0, 0, 0]);
    expect(result.state.team[1]!.combat!.burn).toBe(2);
    expect(result.state.team[2]!.combat!.controlled).toBe("freeze");
    expect(result.state.reserves[0]).toMatchObject({ health: 12, combat: { freeze: 5 } });
    const card = before.cards.find((item) => item.definitionId === ward)!;
    expect(previewCard(before, card.id)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it.each([1, 2, 3, 4, 5, 6])("restores %i Health to its team when an ally Freezes an enemy", (amount) => {
    const game = produce(brumalynBattle(), (draft) => {
      draft.discovery.recruited.brumalyn = amount;
      const enemy = draft.battle.enemies[0]!;
      enemy.combat.freeze = Math.ceil(enemy.maxHealth / 2) - 1;
      observeDecisions(draft, () => 0.99);
      hit(draft, draft.team[1]!, enemy, 1, "freeze", [], { origin: "ability", cannotDodge: true });
      expect(enemy.combat.controlled).toBe("freeze");
    });
    expect(game.team.map((ally) => ally.health)).toEqual([18 + amount, 20 + amount, 23 + amount]);
  });

  it("does not trigger on buildup, Stun, a defeated target, or without a living deployed guide", () => {
    produce(brumalynBattle(), (draft) => {
      const enemy = draft.battle.enemies[0]!;
      const actor = draft.team[1]!;
      observeDecisions(draft, () => 0.99);
      hit(draft, actor, enemy, 1, "freeze", [], { origin: "ability", cannotDodge: true });
      expect(draft.team[0]!.health).toBe(18);
      enemy.combat.stun = Math.ceil(enemy.maxHealth / 2) - 1;
      hit(draft, actor, enemy, 1, "stun", [], { origin: "ability", cannotDodge: true });
      expect(draft.team[0]!.health).toBe(18);
      enemy.combat = freshCombat();
      enemy.health = 1;
      enemy.combat.freeze = Math.ceil(enemy.maxHealth / 2) - 1;
      hit(draft, actor, enemy, 1, "freeze", [], { origin: "ability", cannotDodge: true });
      expect(draft.team[0]!.health).toBe(18);
      const other = draft.battle.enemies[1]!;
      draft.team[0]!.health = 0;
      other.combat.freeze = Math.ceil(other.maxHealth / 2) - 1;
      hit(draft, actor, other, 1, "freeze", [], { origin: "ability", cannotDodge: true });
      expect(draft.team[1]!.health).toBe(20);
    });
  });

  it("offers Warmth Ward to Auto-play when Freeze buildup is the only benefit", () => {
    const ready = produce(brumalynBattle(), (draft) => {
      for (const ally of draft.team) ally.health = species(ally.species).health;
      draft.battle.hand = [draft.cards.find((item) => item.definitionId === ward)!.id];
    });
    expect(battleChoices(ready, false).some((choice) => choice.type === "play")).toBe(true);
  });

  it("uses shared backup healing without extending the thaw to backup", () => {
    const ready = produce(brumalynBattle(), (draft) => {
      draft.boons = ["camp-hammock"];
      addReserve(draft, "backup", "stillara", 12, { ...freshCombat(), freeze: 5 });
    });
    const result = play(ready, ward);
    expect(result.state.reserves[0]).toMatchObject({ health: 13, combat: { freeze: 5 } });
  });

  it("plays Rime Pounce with the ordinary targeted preview and rejects a missing target", () => {
    const ready = brumalynBattle();
    const target = ready.battle.enemies[0]!;
    const card = ready.cards.find((item) => item.definitionId === pounce)!;
    const result = play(ready, pounce, target.id);
    expect(result.accepted).toBe(true);
    expect(previewCard(ready, card.id, target.id)).toEqual(result);
    const rejected = play(ready, pounce);
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(ready);
  });

  it("chooses one seeded damage type for the whole howl, with both outcomes available", () => {
    for (const [roll, type] of [
      [0.2, "stun"],
      [0.8, "freeze"],
    ] as const) {
      const game = produce(brumalynBattle(), (draft) => {
        observeDecisions(draft, () => roll);
        const def = definition(howl);
        executeAbility(draft, { side: "player", actor: draft.team[0]!, def, value: 2 }, []);
      });
      for (const enemy of game.battle.enemies) {
        expect(enemy.combat[type]).toBe(2);
        expect(enemy.combat[type === "stun" ? "freeze" : "stun"]).toBe(0);
      }
    }
  });

  it("keeps the same thaw on enemy cards and uses base-tier enemy passive", () => {
    produce(brumalynBattle(), (draft) => {
      draft.discovery.recruited.brumalyn = 6;
      const guide = draft.battle.enemies[0]!;
      guide.species = "brumalyn";
      guide.health = 10;
      guide.combat.freeze = 4;
      const friend = draft.battle.enemies[1]!;
      friend.health = 10;
      friend.combat.freeze = 3;
      executeAbility(draft, { side: "enemy", actor: guide, def: enemyCard(definition(ward)), value: 1 }, []);
      expect([guide.health, friend.health]).toEqual([11, 11]);
      expect([guide.combat.freeze, friend.combat.freeze]).toEqual([0, 0]);
      draft.team[1]!.combat!.freeze = Math.ceil(species(draft.team[1]!.species).health / 2) - 1;
      observeDecisions(draft, () => 0.99);
      hit(draft, guide, draft.team[1]!, 1, "freeze", [], { origin: "ability", cannotDodge: true });
      expect([guide.health, friend.health]).toEqual([12, 12]);
    });
  });
});

import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { hit, tickStatuses } from "../../../../src/game/combat/index";
import { STACK_LIMIT } from "../../../../src/game/combat/state";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { definitionKeywords } from "../../../../src/game/keywords";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { swapBackup } from "../../../../src/game/team";
import { pyrellaBattle } from "../../../support/pyrella";

const play = (state: ReturnType<typeof pyrellaBattle>, id: string) => ({
  type: "play" as const,
  cardId: state.cards.find((card) => card.definitionId === `pyrella-${id}`)!.id,
  autoEndTurn: false,
});

describe("Pyrella", () => {
  it("authors the selected rules, six replacement tiers and progression categories", () => {
    expect(speciesCards("pyrella").map((card) => [cardText(card), card.cost, enemyCanUse(card)])).toEqual([
      ["Deal 2 Burn damage to all enemies", 1, true],
      ["Restore 1 Mana / Draw a Burn card", 1, false],
      ["Apply 2 Burn to all enemies / Gain Negate", 1, true],
    ]);
    expect(species("pyrella").passiveTiers.map((tier) => tier.effects)).toEqual(
      [20, 35, 50, 65, 80, 100].map((amount) => [{ kind: "passingFlame", amount }]),
    );
    expect(species("pyrella").passiveTiers[5].description).toBe(
      "After defeating a Burning enemy, spread its remaining Burn to other enemies",
    );
    expect(definitionKeywords(definition("pyrella-spark-decoy"))).toEqual(["burn"]);
    expect(definitionKeywords(definition("pyrella-ember-harvest"))).toEqual(["mana"]);
    expect(cardText(definition("pyrella-spark-decoy"), 1)).toBe("Apply 4 Burn to all enemies / Gain Negate");
  });

  it.each([0, 1, 2, 3, 4, 5])("conserves and evenly splits the rounded Burn pool at rank %s", (rank) => {
    const state = pyrellaBattle();
    const next = produce(state, (draft) => {
      draft.discovery.recruited.pyrella = rank + 1;
      const target = draft.battle.enemies[0]!;
      target.health = 1;
      target.combat.burn = 20;
      hit(draft, draft.team[0]!, target, 1, "physical", [], { origin: "derived" });
    });
    const total = [4, 7, 10, 13, 16, 20][rank]!;
    expect(next.battle.enemies.slice(1).map((unit) => unit.combat.burn)).toEqual([
      Math.ceil(total / 2),
      Math.floor(total / 2),
    ]);
    expect(next.battle.enemies.slice(1).every((unit) => unit.combat.statusSources.burn === "ally-0")).toBe(
      true,
    );
    expect(next.rng).toBe(state.rng);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("does not spread on another creature's kill, an unburned defeat, or from an inactive Pyrella", () => {
    for (const cause of ["other", "unburned", "backup", "fallen"] as const) {
      const next = produce(pyrellaBattle(), (draft) => {
        const source = draft.team[0]!;
        const target = draft.battle.enemies[0]!;
        target.health = 1;
        target.combat.burn = cause === "unburned" ? 0 : 20;
        if (cause === "backup") swapBackup(draft, source.id, "pyrella-backup", []);
        if (cause === "fallen") source.health = 0;
        hit(draft, cause === "other" ? draft.team[1]! : source, target, 1, "physical", [], {
          origin: "derived",
        });
      });
      expect(next.battle.enemies.slice(1).map((enemy) => enemy.combat.burn)).toEqual([0, 0]);
    }
  });

  it("spreads attributed periodic defeats, respects protection and stack caps, and has no last-enemy target", () => {
    const next = produce(pyrellaBattle(), (draft) => {
      draft.discovery.recruited.pyrella = 6;
      const [target, protectedEnemy, cappedEnemy] = draft.battle.enemies;
      target!.health = 1;
      target!.combat.burn = 20;
      target!.combat.statusSources.burn = draft.team[0]!.id;
      protectedEnemy!.combat.nullify = true;
      cappedEnemy!.combat.burn = STACK_LIMIT - 1;
      tickStatuses(draft, target!, []);
    });
    expect(next.battle.enemies[1]!.combat).toMatchObject({ nullify: false, burn: 0 });
    expect(next.battle.enemies[2]!.combat.burn).toBe(STACK_LIMIT);
    const last = produce(pyrellaBattle(), (draft) => {
      draft.battle.enemies.slice(1).forEach((enemy) => {
        enemy.health = 0;
      });
      draft.battle.enemies[0]!.health = 1;
      draft.battle.enemies[0]!.combat.burn = 20;
      hit(draft, draft.team[0]!, draft.battle.enemies[0]!, 1, "physical", [], { origin: "derived" });
    });
    expect(last.battle.enemies.every((enemy) => enemy.health === 0)).toBe(true);
  });

  it("uses the enemy's base tier and waits for actual knockout through Death's Door", () => {
    const next = produce(pyrellaBattle(), (draft) => {
      draft.discovery.recruited.pyrella = 6;
      const enemy = draft.battle.enemies[0]!;
      enemy.species = "pyrella";
      const target = draft.team[0]!;
      target.health = 1;
      target.combat!.burn = 20;
      hit(draft, enemy, target, 1, "physical", [], { origin: "derived" });
      expect(draft.team.slice(1).map((unit) => unit.combat!.burn)).toEqual([0, 0]);
      target.combat!.grace = 0;
      hit(draft, enemy, target, 1, "physical", [], { origin: "derived" });
    });
    expect(next.team[0]!.health).toBe(0);
    expect(next.team.slice(1).map((unit) => unit.combat!.burn)).toEqual([2, 2]);
  });

  it("keeps Festival Burst's committed spread and detached preview in agreement", () => {
    const state = produce(pyrellaBattle(), (draft) => {
      draft.battle.enemies[0]!.health = 1;
      draft.battle.enemies[0]!.combat.burn = 20;
      draft.battle.enemies.forEach((enemy) => {
        enemy.combat.controlled = "stun";
        enemy.combat.controlTurns = 1;
      });
    });
    const original = encodeSave(state);
    const command = play(state, "festival-burst");
    const preview = previewCard(state, command.cardId);
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    expect(result.events).toEqual(preview!.events);
    expect(encodeSave(state)).toBe(original);
    expect(result.state.battle!.enemies[0]!.health).toBe(0);
    expect(result.state.battle!.enemies.slice(1).every((enemy) => enemy.combat.burn >= 4)).toBe(true);
    expect(result.state.battleXP.burn).toBe(1);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("refunds Mana before automatic turn end and draws exactly one eligible Burn card", () => {
    const state = produce(pyrellaBattle(), (draft) => {
      draft.battle.mana = 1;
    });
    const result = dispatch(state, { ...play(state, "ember-harvest"), autoEndTurn: true });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.turn).toBe(state.battle.turn);
    expect(result.state.battle!.mana).toBe(1);
    const drawn = result.state.battle!.hand.filter((id) => !state.battle.hand.includes(id));
    expect(drawn).toHaveLength(1);
    expect(
      definitionKeywords(definition(result.state.cards.find((card) => card.id === drawn[0])!.definitionId)),
    ).toContain("burn");
    expect(result.state.battleXP.mana).toBe(1);
    expect(result.state.battleXP.burn ?? 0).toBe(0);
  });

  it("preserves a refund when no Burn can be drawn, and keeps rejected commands unchanged", () => {
    const state = produce(pyrellaBattle(), (draft) => {
      draft.battle.draw = [];
      draft.battle.discard = [];
    });
    const result = dispatch(state, play(state, "ember-harvest"));
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(state.battle.mana);
    expect(result.state.battle!.hand).toHaveLength(state.battle.hand.length - 1);
    const blocked = produce(state, (draft) => {
      draft.team[0]!.combat!.controlled = "stun";
      draft.team[0]!.combat!.controlTurns = 1;
    });
    const rejected = dispatch(blocked, play(blocked, "ember-harvest"));
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(blocked);
  });

  it("Spark Decoy applies Burn without damage and grants Negate through preview and resume", () => {
    const state = pyrellaBattle();
    const command = play(state, "spark-decoy");
    const preview = previewCard(state, command.cardId);
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    expect(result.events).toEqual(preview!.events);
    expect(result.state.team[0]!.combat!.negate).toBe(true);
    expect(result.state.battle!.enemies.map((enemy) => enemy.combat.burn)).toEqual([2, 2, 2]);
    expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
      state.battle.enemies.map((enemy) => enemy.health),
    );
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("enemy Spark Decoy applies Burn to the opposing side and respects Nullify", () => {
    const state = produce(pyrellaBattle(), (draft) => {
      const actor = draft.battle.enemies[0]!;
      actor.species = "pyrella";
      draft.team[0]!.combat!.nullify = true;
      executeAbility(draft, { side: "enemy", actor, def: definition("pyrella-spark-decoy"), value: 2 }, []);
    });
    expect(state.battle.enemies[0]!.combat.negate).toBe(true);
    expect(state.team.map((unit) => unit.combat!.burn)).toEqual([0, 2, 2]);
    expect(state.team[0]!.combat!.nullify).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { ordinaryAttackFacts } from "../../../../src/game/ability-facts";
import { definition } from "../../../../src/game/content";
import { modifiedDamage } from "../../../../src/game/combat/damage-values";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { enemyCardValue } from "../../../../src/game/combat/enemy-policy";
import { playEnemyAbility } from "../../../../src/game/combat/enemy-action";
import { encounterPacks } from "../../../support/encounter-packs";
import { accept, authoredPack, prepareDestination, run, teamRun } from "../../../support/game";
import type { BattleState, GameState } from "../../../../src/game/types";

function play(state: GameState, id: string, targetId?: string) {
  const card = state.cards.find((entry) => entry.definitionId === id)!;
  const ready = produce(state, (draft) => {
    for (const zone of ["draw", "hand", "discard", "buffer"] as const)
      draft.battle![zone] = draft.battle![zone].filter((slot) => slot !== card.id);
    draft.battle!.hand.push(card.id);
    draft.battle!.mana = 4;
  });
  const result = dispatch(ready, { type: "play", cardId: card.id, targetId, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  return result;
}

describe("Tithemaw", () => {
  it("heals existing allies before summoning two wards, then replaces only defeated wards", () => {
    let state = produce(teamRun(42, ["tithemaw"]) as BattleState, (draft) => {
      draft.team[0]!.health = 50;
    });
    expect(state.battle.minions ?? []).toHaveLength(0);
    state = play(state, "tithemaw-gilded-ward").state as BattleState;
    expect(state.team[0]!.health).toBe(52);
    expect(state.battle.minions!.map((ward) => [ward.name, ward.health])).toEqual([
      ["Gilded Ward", 4],
      ["Gilded Ward", 4],
    ]);
    state = produce(state, (draft) => {
      draft.battle.minions![0]!.health = 0;
      draft.battle.minions![1]!.health = 1;
    });
    state = play(state, "tithemaw-gilded-ward").state as BattleState;
    expect(state.battle.minions!.map((ward) => ward.health)).toEqual([4, 3]);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it("uses each target's Block for the owner's attack bonus at every rank", () => {
    for (const [rank, bonus] of [4, 6, 8, 10, 12, 14].entries()) {
      produce(teamRun(42, ["tithemaw"]) as BattleState, (draft) => {
        draft.discovery.recruited.tithemaw = rank + 1;
        const actor = draft.team[0]!;
        const target = draft.battle.enemies[0]!;
        target.block = 20;
        expect(
          modifiedDamage(
            draft,
            actor,
            target,
            4,
            "physical",
            { origin: "ability", primaryAttack: true },
            true,
          ),
        ).toBe(4 + bonus);
        target.block = 0;
        expect(
          modifiedDamage(
            draft,
            actor,
            target,
            4,
            "physical",
            { origin: "ability", primaryAttack: true },
            true,
          ),
        ).toBe(4);
      });
    }
  });

  it("each surviving uncontrolled ward answers once per attack, including area attacks", () => {
    let state = play(teamRun(42, ["tithemaw"]), "tithemaw-gilded-ward").state as BattleState;
    state = produce(state, (draft) => {
      for (const enemy of draft.battle.enemies) {
        enemy.health = enemy.maxHealth = 50;
        enemy.combat.controlled = "stun";
        enemy.combat.controlTurns = 1;
      }
      draft.battle.minions![1]!.combat.controlled = "freeze";
      draft.battle.minions![1]!.combat.controlTurns = 1;
    });
    const result = play(state, "tithemaw-oath-howl");
    expect(
      result.events.filter((event) => event.kind === "damage" && event.actorId?.startsWith("ward-")),
    ).toHaveLength(3);
    expect(
      result.events
        .filter((event) => event.kind === "damage" && event.actorId?.startsWith("ward-"))
        .every((event) => event.kind === "damage" && event.amount === 1 && event.damageType === "light"),
    ).toBe(true);
  });

  it("previews the same shielded Coinfang and chorus without changing the live state", () => {
    const summoned = play(teamRun(42, ["tithemaw"]), "tithemaw-gilded-ward").state as BattleState;
    const card = summoned.cards.find((entry) => entry.definitionId === "tithemaw-coinfang")!;
    const state = produce(summoned, (draft) => {
      for (const zone of ["draw", "hand", "discard", "buffer"] as const)
        draft.battle[zone] = draft.battle[zone].filter((id) => id !== card.id);
      draft.battle.hand.push(card.id);
      draft.battle.mana = 4;
      const target = draft.battle.enemies[0]!;
      target.block = 20;
      target.combat.controlled = "stun";
      target.combat.controlTurns = 1;
    });
    const target = state.battle.enemies[0]!;
    const def = definition("tithemaw-coinfang");
    if (def.effect !== "attack") throw new Error("Coinfang must attack");
    expect(ordinaryAttackFacts(state, state.team[0]!, def, 4, target)[0]!.blocked).toBe(8);
    const before = encodeSave(state);
    const preview = previewCard(state, card.id, target.id);
    const actual = dispatch(state, {
      type: "play",
      cardId: card.id,
      targetId: target.id,
      autoEndTurn: false,
    });
    expect(preview).toEqual(actual);
    expect(encodeSave(state)).toBe(before);
  });

  it("a repeat triggers each living Ward once per resolution, and support never triggers the chorus", () => {
    const summoned = play(teamRun(42, ["tithemaw"]), "tithemaw-gilded-ward");
    expect(
      summoned.events.some((event) => event.kind === "damage" && event.actorId?.startsWith("ward-")),
    ).toBe(false);
    const state = produce(summoned.state as BattleState, (draft) => {
      draft.battle.repeatNext.player = true;
      for (const enemy of draft.battle.enemies) {
        enemy.health = enemy.maxHealth = 100;
        enemy.combat.controlled = "stun";
        enemy.combat.controlTurns = 1;
      }
    });
    const result = play(state, "tithemaw-oath-howl");
    expect(
      result.events.filter((event) => event.kind === "damage" && event.actorId?.startsWith("ward-")),
    ).toHaveLength(12);
  });

  it("does not give the passive bonus to supplemental damage, reflected attacks or a Ward", () => {
    const state = play(teamRun(42, ["tithemaw"]), "tithemaw-gilded-ward").state as BattleState;
    produce(state, (draft) => {
      const target = draft.battle.enemies[0]!;
      target.block = 20;
      const ward = draft.battle.minions![0]!;
      const actor = draft.team[0]!;
      expect(
        modifiedDamage(draft, actor, target, 4, "physical", { origin: "ability", attackAbility: true }, true),
      ).toBe(4);
      expect(
        modifiedDamage(draft, ward, target, 1, "light", { origin: "ability", primaryAttack: true }, true),
      ).toBe(1);
      expect(
        modifiedDamage(
          draft,
          actor,
          target,
          4,
          "physical",
          { origin: "ability", primaryAttack: true, delivery: "reflection" },
          true,
        ),
      ).toBe(4);
    });
  });

  it("enemy Tithemaw values summons and resolves the same chorus", () => {
    let state = produce(run(), (draft) => {
      draft.encounter = 9;
      draft.expedition = {
        pack: authoredPack(
          9,
          encounterPacks(9).findIndex((pack) => pack[0] === "tithemaw"),
        ),
        recruit: null,
        lastRoom: "boss",
      };
      prepareDestination(draft);
      draft.journey!.victories = 9;
    });
    state = accept(state, { type: "beginBattle" });
    expect(state.battle!.enemies[0]!.deck!.draw).toHaveLength(6);
    const card = definition("tithemaw-gilded-ward");
    expect(enemyCardValue(state as BattleState, state.battle!.enemies[0]!, card)).toBeGreaterThan(0);
    const events: import("../../../../src/game/types").GameEvent[] = [];
    state = produce(state as BattleState, (draft) => {
      const boss = draft.battle.enemies[0]!;
      playEnemyAbility(draft, boss, card, undefined, undefined, events);
      playEnemyAbility(draft, boss, definition("tithemaw-oath-howl"), undefined, undefined, events);
    });
    expect(state.battle!.minions!.map((ward) => ward.minion.side)).toEqual(["enemy", "enemy"]);
    expect(events.some((event) => event.kind === "damage" && event.actorId?.startsWith("ward-"))).toBe(true);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
});

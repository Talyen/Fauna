import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { combat, hit } from "../../src/game/combat";
import { definition, species, SPECIES } from "../../src/game/content";
import { decodeSave, encodeSave, validateContent } from "../../src/game/save";
import { recruitChoice, accept, policy, run, teamRun, winBattle } from "./helpers";
describe("game commands", () => {
  it("validates authored content and starts with one unlocked creature and its three cards", () => {
    validateContent();
    let s = createGame();
    expect(dispatch(s, { type: "start" }).accepted).toBe(false);
    expect(
      dispatch(s, { type: "draft", species: SPECIES.find((kind) => !s.starterOffers.includes(kind.id))!.id })
        .accepted,
    ).toBe(false);
    const chosen = s.starterOffers[0]!;
    s = accept(s, { type: "draft", species: chosen });
    expect(s.selected).toEqual([chosen]);
    s = accept(s, { type: "start" });
    s = accept(s, { type: "beginBattle" });
    expect(s.roster).toEqual([chosen]);
    expect(s.team).toHaveLength(1);
    expect(s.cards).toHaveLength(3);
    expect(s.battle!.hand).toHaveLength(3);
    expect(s.battle!.mana).toBe(4);
  });
  it("publishes deeply frozen state and leaves the previous state untouched", () => {
    const s = run();
    const before = JSON.stringify(s);
    accept(s, { type: "endTurn" });
    expect(JSON.stringify(s)).toBe(before);
    expect(Object.isFrozen(s.battle!.hand)).toBe(true);
  });
  it("rejects wrong targets, absent cards, and insufficient mana before consuming RNG", () => {
    const s = produce(run(), (game) => {
      const attack = game.cards.find((card) => card.definitionId === "emberback-attack")!;
      game.battle!.hand = [attack.id];
      game.battle!.buffer = [];
      game.battle!.discard = [];
      game.battle!.draw = game.cards.filter((card) => card.id !== attack.id).map((card) => card.id);
    });
    const attack = s.cards.find((card) => card.definitionId === "emberback-attack")!;
    for (const cmd of [
      { type: "play" as const, cardId: "constructor", targetId: "enemy-0" },
      { type: "play" as const, cardId: attack.id, targetId: "ally-0" },
    ]) {
      const result = dispatch(s, cmd);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(s);
    }
    const empty = produce(s, (d) => {
      d.battle!.mana = 0;
    });
    expect(dispatch(empty, { type: "play", cardId: attack.id, targetId: "enemy-0" }).state).toBe(empty);
  });
  it("spends mana, applies traits, and commits ordered feedback", () => {
    let s = run();
    const attack = s.cards.find((c) => c.definitionId === "emberback-attack")!;
    s = produce(s, (d) => {
      d.battle!.hand = [attack.id];
      d.battle!.draw = d.cards.filter((c) => c.id !== attack.id).map((c) => c.id);
      d.battle!.enemies[0]!.health = 18;
    });
    const r = dispatch(s, { type: "play", cardId: attack.id, targetId: "enemy-0" });
    expect(r.accepted).toBe(true);
    expect(r.state.battle!.mana).toBe(3);
    expect(r.state.battle!.enemies[0]!.health).toBe(14);
    expect(r.events.map((e) => e.kind)).toEqual(["action", "damage", "status"]);
    expect(r.events.find((e) => e.kind === "damage")?.damageType).toBe("physical");
    expect(r.state.team[1]!.combat!.armor).toBe(2);
    expect(r.state.battleXP.armor).toBe(1);
    expect(r.state.battle!.discard).toContain(attack.id);
  });
  it("persists enemy repertoire history and never repeats consecutive abilities", () => {
    let s = decodeSave(encodeSave(run()));
    for (let turn = 0; turn < 4 && s.phase === "battle"; turn++) {
      const previous = s.battle!.enemies.map((enemy) => enemy.lastAbility);
      s = accept(s, { type: "endTurn" });
      s.battle!.enemies.forEach((enemy, index) => {
        if (enemy.health > 0 && !enemy.combat.skipped) {
          expect(enemy.lastAbility).not.toBe(previous[index]);
          expect(definition(enemy.lastAbility!).species).toBe(enemy.species);
        }
      });
      expect(decodeSave(encodeSave(s))).toEqual(s);
    }
  });
  it("keeps knockout slots inert and never draws them while living creatures remain", () => {
    let s = run();
    s = produce(s, (d) => {
      d.team[0]!.health = 0;
      d.battle!.enemies.forEach((e) => (e.targetId = "ally-0"));
    });
    s = accept(s, { type: "endTurn" });
    expect(s.team[0]!.health).toBe(0);
    for (let i = 0; i < 2; i++) {
      const b = s.battle!;
      const removed = s.cards.filter((c) => c.ownerId === "ally-0").map((c) => c.id);
      expect(b.hand.some((id) => removed.includes(id))).toBe(false);
      expect(decodeSave(encodeSave(s))).toEqual(s);
      s = accept(s, { type: "endTurn" });
    }
  });
  it("grants self Block and retains residual Block at the next player turn", () => {
    let s = run();
    const guard = s.cards.find((c) => c.definitionId === "mossguard-guard")!;
    s = produce(s, (d) => {
      d.battle!.hand = [guard.id];
      d.battle!.draw = d.cards.filter((c) => c.id !== guard.id).map((c) => c.id);
      d.battle!.enemies.forEach((e) => {
        e.targetId = "ally-0";
        e.combat.controlled = "stun";
      });
    });
    s = accept(s, { type: "play", cardId: guard.id, targetId: "ally-0" });
    expect(s.team[0]!.block).toBe(6);
    s = accept(s, { type: "endTurn" });
    expect(s.team[0]!.health).toBe(32);
    expect(s.team[0]!.block).toBe(3);
    expect(s.battle!.mana).toBe(4);
    expect(s.battle!.turn).toBe(2);
  });
  it("ends the expedition when the whole team falls", () => {
    let s = run();
    s = produce(s, (d) => {
      d.team.forEach((c) => {
        c.health = 1;
        combat(c).deathDoorUsed = true;
      });
      d.battle!.enemies[0]!.damage = 100;
    });
    for (let i = 0; i < 20 && s.phase === "battle"; i++) s = accept(s, { type: "endTurn" });
    expect(s.phase).toBe("defeat");
    expect(s.reward!.outcome).toBe("defeat");
    expect(dispatch(s, { type: "endTurn" }).accepted).toBe(false);
  });
  it("restores all creatures after victory and resumes at a reward", () => {
    const s = winBattle();
    expect(s.phase).toBe("recruit");
    expect(s.team.every((c) => c.health === species(c.species).health)).toBe(true);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    expect(dispatch(s, { type: "play", cardId: s.cards[0]!.id, targetId: "enemy-0" }).accepted).toBe(false);
  });
  it("recruits a defeated species into reserves and swaps its kit before the next battle", () => {
    let s = winBattle();
    expect(dispatch(s, { type: "recruit", species: "prismram" }).accepted).toBe(false);
    s = accept(s, { type: "recruit", species: "emberback" });
    expect(s.roster).toHaveLength(4);
    expect(s.team[0]!.species).toBe("mossguard");
    s = accept(s, { type: "swap", activeId: "ally-0", reserve: s.reserves[0]!.id });
    expect(s.team[0]!.species).toBe("emberback");
    expect(s.cards.some((c) => c.definitionId.startsWith("mossguard"))).toBe(false);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("settles rewards once and preserves the complete eligible roster and permanent progress", () => {
    let s = run();
    for (let battle = 0; battle < 3; battle++) {
      s = winBattle(s);
      const bank = s.currency;
      expect(dispatch(s, { type: "skipBoon" }).accepted).toBe(false);
      expect(s.currency).toBe(bank);
      if (s.phase === "recruit") s = accept(s, recruitChoice(s));
      if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
      if (s.phase === "teamSelection") s = accept(s, { type: "beginBattle" });
    }
    expect(s.phase).toBe("victory");
    expect(s.wins).toBe(1);
    expect(s.unlocked.filter((id) => id === "prismram")).toHaveLength(1);
    const bank = s.currency;
    s = accept(s, { type: "newRun", seed: 123 });
    expect(s.currency).toBe(bank);
    expect(s.unlocked).toContain("prismram");
    expect(s.roster).toEqual([]);
  });
  it("replays identical seeds and commands with identical results through complete expeditions", () => {
    let a = run(7),
      b = run(7);
    for (let i = 0; i < 150 && !["victory", "defeat"].includes(a.phase); i++) {
      const command = policy(a);
      a = accept(a, command);
      b = accept(b, command);
      expect(b).toEqual(a);
      expect(decodeSave(encodeSave(a))).toEqual(a);
    }
    expect(a.phase).toBe("victory");
  });
  it("supports all unlocked team combinations without engine failures or invalid saves", () => {
    for (let first = 0; first < SPECIES.length - 2; first++)
      for (let second = first + 1; second < SPECIES.length - 1; second++)
        for (let third = second + 1; third < SPECIES.length; third++) {
          let s = teamRun(
            first * 100 + second * 10 + third,
            [first, second, third].map((index) => SPECIES[index]!.id),
          );
          for (let i = 0; i < 500 && !["victory", "defeat"].includes(s.phase); i++) {
            s = accept(s, policy(s));
            decodeSave(encodeSave(s));
          }
          expect(["victory", "defeat"]).toContain(s.phase);
        }
  });
});
describe("save validation", () => {
  it.each(["not json", "{}", JSON.stringify({ ...createGame(), version: 999 }), "x".repeat(100001)])(
    "rejects malformed or unsupported saves",
    (raw) => {
      expect(() => decodeSave(raw)).toThrow();
    },
  );
  it("rejects duplicated cards, mismatched owners, missing zones, unknown content, and invalid outcomes", () => {
    const s = run();
    for (const change of [
      (d: typeof s) => {
        d.battle!.hand.push(d.battle!.hand[0]!);
      },
      (d: typeof s) => {
        d.cards[0]!.ownerId = "constructor";
      },
      (d: typeof s) => {
        d.battle!.draw = [];
      },
      (d: typeof s) => {
        d.cards[0]!.definitionId = "missing";
      },
      (d: typeof s) => {
        d.phase = "victory";
      },
    ]) {
      expect(() => decodeSave(JSON.stringify(produce(s, change)))).toThrow();
    }
  });
});
describe("creature traits and deck circulation", () => {
  it("applies Prism Charge damage and heals the most injured living ally without reviving knockouts", () => {
    let s = teamRun(5, ["prismram", "pollenmoth", "mossguard"]);
    const attack = s.cards.find((c) => c.definitionId === "prismram-attack")!,
      heal = s.cards.find((c) => c.definitionId === "pollenmoth-heal")!;
    s = produce(s, (d) => {
      d.team[2]!.health = 10;
      d.battle!.hand = [attack.id, heal.id];
      d.battle!.draw = d.cards.filter((c) => ![attack.id, heal.id].includes(c.id)).map((c) => c.id);
    });
    s = accept(s, { type: "play", cardId: attack.id, targetId: "enemy-0" });
    expect(s.battle!.enemies[0]!.health).toBe(12);
    s = accept(s, { type: "play", cardId: heal.id, targetId: "ally-2" });
    expect(s.team[2]!.health).toBe(13);
    expect(s.battleXP.health).toBe(1);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    const knocked = produce(s, (d) => {
      d.team[2]!.health = 0;
      d.battle!.hand = [heal.id];
      d.battle!.mana = 3;
    });
    const healed = accept(knocked, { type: "play", cardId: heal.id });
    expect(healed.team[2]!.health).toBe(0);
  });
  it("deals Thorns only for health damage", () => {
    let s = teamRun(3, ["emberback", "prismram", "mossguard"]);
    expect(s.team[1]!.block).toBe(0);
    const events: Parameters<typeof hit>[5] = [];
    s = produce(s, (d) => {
      d.team[0]!.block = 4;
      combat(d.team[0]!).thorns = 2;
      hit(d, d.battle!.enemies[0]!, d.team[0]!, 4, "nature", events, { retaliation: true });
      expect(d.battle!.enemies[0]!.health).toBe(18);
      d.rng = 1;
      hit(d, d.battle!.enemies[1]!, d.team[0]!, 4, "burn", events);
    });
    expect(s.battle!.enemies[1]!.health).toBe(14);
    expect(s.team[0]!.combat!.thorns).toBe(1);
  });
  it("reshuffles deterministically and retains every live card exactly once across zones", () => {
    let s = run(8);
    const firstHand = s.battle!.hand;
    s = accept(s, { type: "endTurn" });
    const zones = [...s.battle!.draw, ...s.battle!.hand, ...s.battle!.discard];
    expect(new Set(zones).size).toBe(9);
    expect(zones).toHaveLength(9);
    expect(s.battle!.hand).not.toEqual(firstHand);
    expect(s.battle!.hand).toHaveLength(4);
    expect(s.battle!.discard).toHaveLength(4);
  });
});

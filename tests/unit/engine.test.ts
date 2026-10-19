import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { definition, species, SPECIES } from "../../src/game/content";
import { decodeSave, encodeSave, validateContent } from "../../src/game/save";
import { accept, policy, run, winBattle } from "./helpers";
describe("game commands", () => {
  it("validates authored content and drafts three distinct unlocked species", () => {
    validateContent();
    let s = createGame();
    expect(dispatch(s, { type: "start" }).accepted).toBe(false);
    expect(dispatch(s, { type: "draft", species: "moonhart" }).accepted).toBe(false);
    s = accept(s, { type: "draft", species: "mossback" });
    s = accept(s, { type: "draft", species: "mossback" });
    expect(s.selected).toEqual([]);
    s = run();
    expect(s.cards).toHaveLength(9);
    expect(s.battle!.hand).toHaveLength(5);
    expect(s.battle!.energy).toBe(3);
  });
  it("rejects a fourth draft choice without changing state or RNG", () => {
    let s = createGame();
    for (const kind of ["mossback", "emberfox", "stormfin"] as const)
      s = accept(s, { type: "draft", species: kind });
    const result = dispatch(s, { type: "draft", species: "silkmoth" });
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(s);
  });
  it("publishes deeply frozen state and leaves the previous state untouched", () => {
    const s = run();
    const before = JSON.stringify(s);
    accept(s, { type: "endTurn" });
    expect(JSON.stringify(s)).toBe(before);
    expect(Object.isFrozen(s.battle!.hand)).toBe(true);
  });
  it("rejects wrong targets, absent cards, and insufficient energy before consuming RNG", () => {
    const s = run();
    const attack = s.cards.find(
      (c) => s.battle!.hand.includes(c.id) && definition(c.definitionId).effect === "attack",
    )!;
    for (const cmd of [
      { type: "play" as const, cardId: "constructor", targetId: "enemy-0" },
      { type: "play" as const, cardId: attack.id, targetId: "ally-0" },
    ]) {
      const result = dispatch(s, cmd);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(s);
    }
    const empty = produce(s, (d) => {
      d.battle!.energy = 0;
    });
    expect(dispatch(empty, { type: "play", cardId: attack.id, targetId: "enemy-0" }).state).toBe(empty);
  });
  it("spends energy, consumes marks, applies traits, and commits ordered feedback", () => {
    let s = run();
    const attack = s.cards.find((c) => c.definitionId === "emberfox-attack")!;
    s = produce(s, (d) => {
      d.battle!.hand = [attack.id];
      d.battle!.draw = d.cards.filter((c) => c.id !== attack.id).map((c) => c.id);
      d.battle!.enemies[0]!.marks = 2;
      d.battle!.enemies[0]!.health = 18;
    });
    const r = dispatch(s, { type: "play", cardId: attack.id, targetId: "enemy-0" });
    expect(r.accepted).toBe(true);
    expect(r.state.battle!.energy).toBe(2);
    expect(r.state.battle!.enemies[0]!.health).toBe(2);
    expect(r.state.battle!.enemies[0]!.marks).toBe(0);
    expect(r.events.map((e) => e.kind)).toEqual(["action", "damage"]);
    expect(r.state.battle!.discard).toContain(attack.id);
  });
  it("removes knocked-out creature cards from every zone and never draws them again", () => {
    let s = run();
    s = produce(s, (d) => {
      d.team[0]!.health = 1;
      d.battle!.enemies.forEach((e) => (e.targetId = "ally-0"));
    });
    s = accept(s, { type: "endTurn" });
    expect(s.team[0]!.health).toBe(0);
    for (let i = 0; i < 2; i++) {
      const b = s.battle!;
      const removed = s.cards.filter((c) => c.ownerId === "ally-0").map((c) => c.id);
      expect([...b.hand, ...b.draw, ...b.discard].some((id) => removed.includes(id))).toBe(false);
      s = accept(s, { type: "endTurn" });
    }
  });
  it("grants guard bonuses and removes residual block at the next player turn", () => {
    let s = run();
    const guard = s.cards.find((c) => c.definitionId === "mossback-guard")!;
    s = produce(s, (d) => {
      d.battle!.hand = [guard.id];
      d.battle!.draw = d.cards.filter((c) => c.id !== guard.id).map((c) => c.id);
      d.battle!.enemies.forEach((e) => (e.targetId = "ally-0"));
    });
    s = accept(s, { type: "play", cardId: guard.id, targetId: "ally-0" });
    expect(s.team[0]!.block).toBe(9);
    s = accept(s, { type: "endTurn" });
    expect(s.team[0]!.health).toBe(32);
    expect(s.team[0]!.block).toBe(0);
    expect(s.battle!.energy).toBe(3);
    expect(s.battle!.turn).toBe(2);
  });
  it("ends the expedition when the whole team falls", () => {
    let s = run();
    s = produce(s, (d) => {
      d.team.forEach((c) => (c.health = 1));
      d.battle!.enemies[0]!.damage = 100;
    });
    for (let i = 0; i < 3 && s.phase === "battle"; i++) s = accept(s, { type: "endTurn" });
    expect(s.phase).toBe("defeat");
    expect(dispatch(s, { type: "endTurn" }).accepted).toBe(false);
  });
  it("restores all creatures after victory and resumes at a reward", () => {
    const s = winBattle();
    expect(s.phase).toBe("reward");
    expect(s.team.every((c) => c.health === species(c.species).health)).toBe(true);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    expect(dispatch(s, { type: "play", cardId: s.cards[0]!.id, targetId: "enemy-0" }).accepted).toBe(false);
  });
  it("recruitment replaces only one creature’s cards and clears their upgrades", () => {
    let s = winBattle();
    s = produce(s, (d) => {
      d.cards.filter((c) => c.ownerId === "ally-0").forEach((c) => (c.level = 2));
    });
    const retained = s.cards.filter((c) => c.ownerId !== "ally-0");
    s = accept(s, { type: "recruit", species: "silkmoth", replaceId: "ally-0" });
    expect(s.encounter).toBe(1);
    expect(s.team[0]!.species).toBe("silkmoth");
    expect(
      s.cards
        .filter((c) => c.ownerId === "ally-0")
        .every((c) => c.level === 0 && definition(c.definitionId).species === "silkmoth"),
    ).toBe(true);
    expect(s.cards.filter((c) => c.ownerId !== "ally-0")).toEqual(retained);
    expect(dispatch(s, { type: "recruit", species: "briartooth", replaceId: "ally-0" }).accepted).toBe(false);
  });
  it("upgrades once, rejects duplicate rewards, unlocks Moonhart once, and preserves discoveries", () => {
    let s = winBattle();
    const card = s.cards[0]!;
    s = accept(s, { type: "upgrade", cardId: card.id });
    expect(s.cards[0]!.level).toBe(1);
    expect(dispatch(s, { type: "upgrade", cardId: card.id }).accepted).toBe(false);
    s = winBattle(s);
    s = accept(s, { type: "upgrade", cardId: card.id });
    s = winBattle(s);
    expect(s.phase).toBe("victory");
    expect(s.wins).toBe(1);
    expect(s.unlocked.filter((id) => id === "moonhart")).toHaveLength(1);
    s = accept(s, { type: "newRun", seed: 123 });
    expect(s.phase).toBe("draft");
    expect(s.unlocked).toContain("moonhart");
    expect(s.wins).toBe(1);
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
    for (let first = 0; first < 4; first++)
      for (let second = first + 1; second < 5; second++)
        for (let third = second + 1; third < 6; third++) {
          let s = produce(createGame(first * 100 + second * 10 + third), (d) => {
            d.unlocked.push("moonhart");
            d.wins = 1;
          });
          for (const index of [first, second, third])
            s = accept(s, { type: "draft", species: SPECIES[index]!.id });
          s = accept(s, { type: "start" });
          for (let i = 0; i < 180 && !["victory", "defeat"].includes(s.phase); i++) {
            s = accept(s, policy(s));
            decodeSave(encodeSave(s));
          }
          expect(["victory", "defeat"]).toContain(s.phase);
        }
  });
});
describe("save validation", () => {
  it.each(["not json", "{}", JSON.stringify({ ...createGame(), version: 2 }), "x".repeat(100001)])(
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
  it("applies Charged marks and Tender healing while rejecting revival of knocked-out allies", () => {
    let s = createGame(5);
    for (const kind of ["stormfin", "silkmoth", "mossback"] as const)
      s = accept(s, { type: "draft", species: kind });
    s = accept(s, { type: "start" });
    const mark = s.cards.find((c) => c.definitionId === "stormfin-mark")!,
      heal = s.cards.find((c) => c.definitionId === "silkmoth-heal")!;
    s = produce(s, (d) => {
      d.team[2]!.health = 10;
      d.battle!.hand = [mark.id, heal.id];
      d.battle!.draw = d.cards.filter((c) => ![mark.id, heal.id].includes(c.id)).map((c) => c.id);
    });
    s = accept(s, { type: "play", cardId: mark.id, targetId: "enemy-0" });
    expect(s.battle!.enemies[0]!.marks).toBe(3);
    s = accept(s, { type: "play", cardId: heal.id, targetId: "ally-2" });
    expect(s.team[2]!.health).toBe(20);
    const knocked = produce(s, (d) => {
      d.team[2]!.health = 0;
      d.battle!.hand = [heal.id];
      d.battle!.energy = 3;
    });
    expect(dispatch(knocked, { type: "play", cardId: heal.id, targetId: "ally-2" }).accepted).toBe(false);
  });
  it("deals Thorns only for health damage and grants Moonlit starting block", () => {
    let s = produce(createGame(3), (d) => {
      d.unlocked.push("moonhart");
      d.wins = 1;
    });
    for (const kind of ["briartooth", "moonhart", "mossback"] as const)
      s = accept(s, { type: "draft", species: kind });
    s = accept(s, { type: "start" });
    expect(s.team[1]!.block).toBe(4);
    s = produce(s, (d) => {
      d.battle!.enemies.forEach((e) => (e.targetId = "ally-0"));
      d.team[0]!.block = 4;
    });
    s = accept(s, { type: "endTurn" });
    expect(s.battle!.enemies[0]!.health).toBe(18);
    expect(s.battle!.enemies[1]!.health).toBe(14);
  });
  it("reshuffles deterministically and retains every live card exactly once across zones", () => {
    let s = run(8);
    const firstHand = s.battle!.hand;
    s = accept(s, { type: "endTurn" });
    const zones = [...s.battle!.draw, ...s.battle!.hand, ...s.battle!.discard];
    expect(new Set(zones).size).toBe(9);
    expect(zones).toHaveLength(9);
    expect(s.battle!.hand).not.toEqual(firstHand);
    expect(s.battle!.hand).toHaveLength(5);
    expect(s.battle!.discard).toHaveLength(0);
  });
});

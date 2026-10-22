import { describe, expect, it } from "vitest";
import { produce } from "immer";
import {
  combat,
  freshCombat,
  grantStatus,
  hit,
  removeEffects,
  startAction,
  tickStatuses,
} from "../../../src/game/combat";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { cardKeywords } from "../../../src/game/progression";
import { recruitChoice, accept, run, victoryReady } from "../../support/game";

function packet(
  type: Parameters<typeof hit>[4],
  amount = 10,
  setup?: (s: ReturnType<typeof run>) => void,
  leech = false,
) {
  const events: Parameters<typeof hit>[5] = [];
  const next = produce(run(), (s) => {
    s.rng = 1; // The first two production rolls neither Dodge nor crit.
    s.battle!.enemies[0]!.health = 18;
    s.battle!.enemies[0]!.combat.thorns = 0;
    setup?.(s);
    hit(s, s.team[1]!, s.battle!.enemies[0]!, amount, type, events, { leech });
  });
  return { next, events };
}
describe("Alchemy combat foundations", () => {
  it("spends Block before Physical Armor and decays Armor only on damage", () => {
    const { next, events } = packet("physical", 10, (s) => {
      s.battle!.enemies[0]!.block = 4;
      s.battle!.enemies[0]!.combat.armor = 2;
    });
    expect(next.battle!.enemies[0]!.health).toBe(14);
    expect(next.battle!.enemies[0]!.block).toBe(0);
    expect(next.battle!.enemies[0]!.combat.armor).toBe(1);
    expect(events.find((event) => event.kind === "damage")?.amount).toBe(4);
    const blocked = packet("physical", 2, (s) => {
      s.battle!.enemies[0]!.combat.armor = 3;
    });
    expect(blocked.next.battle!.enemies[0]!.combat.armor).toBe(3);
  });
  it("resolves typed damage and buildup without elemental reactions", () => {
    for (const type of ["nature", "light"] as const) {
      const { next } = packet(type, 3);
      expect(next.battle!.enemies[0]!.combat).toEqual(freshCombat());
    }
    expect(packet("burn", 3).next.battle!.enemies[0]!.combat.burn).toBe(3);
    expect(packet("poison", 3).next.battle!.enemies[0]!.combat.poison).toBe(3);
    expect(packet("bleed", 3).next.battle!.enemies[0]!.combat.bleed).toBe(3);
    const { next, events } = packet("burn", 2, (s) => {
      s.battle!.enemies[0]!.combat.freeze = 8;
    });
    expect(next.battle!.enemies[0]!.health).toBe(16);
    expect(events.filter((event) => event.kind === "damage")).toHaveLength(1);
  });
  it("ticks Burn then Poison then Bleed through Block, with matching decay and fatal cutoffs", () => {
    const events: Parameters<typeof hit>[5] = [];
    const next = produce(run(), (s) => {
      const enemy = s.battle!.enemies[0]!;
      enemy.health = 18;
      enemy.block = 20;
      Object.assign(enemy.combat, { burn: 5, poison: 5, bleed: 5 });
      tickStatuses(s, enemy, events);
    });
    expect(next.battle!.enemies[0]!.health).toBe(3);
    expect(next.battle!.enemies[0]!.block).toBe(20);
    expect(next.battle!.enemies[0]!.combat).toMatchObject({ burn: 3, poison: 4, bleed: 0 });
    expect(events.filter((event) => event.kind === "damage").map((event) => event.damageType)).toEqual([
      "burn",
      "poison",
      "bleed",
    ]);
    const fatal: typeof events = [];
    produce(next, (s) => {
      tickStatuses(s, s.battle!.enemies[0]!, fatal);
    });
    expect(fatal.filter((event) => event.kind === "damage").map((event) => event.damageType)).toEqual([
      "burn",
    ]);
  });
  it("uses maximum Health for CC on both sides, skips once, and shares three turns of immunity", () => {
    const below = packet("stun", 14).next;
    expect(below.battle!.enemies[0]!.combat.controlled).toBeNull();
    const threshold = packet("freeze", 15).next;
    expect(threshold.battle!.enemies[0]!.combat.controlled).toBe("freeze");
    const next = produce(threshold, (s) => {
      const enemy = s.battle!.enemies[0]!,
        events: Parameters<typeof hit>[5] = [];
      expect(startAction(enemy, events)).toBe(false);
      expect(enemy.combat.cooldown).toBe(3);
      hit(s, s.team[0]!, enemy, 1, "stun", events);
      expect(enemy.combat.stun).toBe(0);
      for (let i = 0; i < 3; i++) startAction(enemy, events);
    });
    expect(next.battle!.enemies[0]!.combat.cooldown).toBe(0);
    expect(packet("freeze", 18).next.battle!.enemies[0]!.combat.controlled).toBeNull();
  });
  it("Dodge precedes mitigation and buildup, while a crit doubles a packet exactly once", () => {
    let dodgeSeed = 0,
      critSeed = 0;
    for (let seed = 0; seed < 100000; seed++) {
      const first = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const second = (Math.imul(first, 1664525) + 1013904223) >>> 0;
      if (first / 2 ** 32 < 0.05) dodgeSeed = seed;
      if (first / 2 ** 32 >= 0.05 && second / 2 ** 32 < 0.05) critSeed = seed;
      if (dodgeSeed && critSeed) break;
    }
    const dodge = packet("burn", 3, (s) => {
      s.rng = dodgeSeed;
      s.battle!.enemies[0]!.block = 5;
    });
    expect(dodge.next.battle!.enemies[0]!.combat.burn).toBe(0);
    expect(dodge.next.battle!.enemies[0]!.block).toBe(5);
    expect(dodge.events[0]!.text).toContain("Dodges");
    expect(dodge.events[0]).toMatchObject({ status: "dodge", outcome: "dodge" });
    const crit = packet("burn", 3, (s) => {
      s.rng = critSeed;
    });
    expect(crit.next.battle!.enemies[0]!.health).toBe(12);
    expect(crit.events.find((e) => e.kind === "damage")).toMatchObject({ critical: true, amount: 6 });
  });
  it("Leech caps overkill and Bleed defers its Leech until actual tick damage", () => {
    const immediate = packet(
      "physical",
      20,
      (s) => {
        s.team[1]!.health = 1;
      },
      true,
    );
    expect(immediate.next.team[1]!.health).toBe(10);
    const bleeding = packet(
      "bleed",
      4,
      (s) => {
        s.team[1]!.health = 1;
      },
      true,
    ).next;
    expect(bleeding.team[1]!.health).toBe(1);
    const ticked = produce(bleeding, (s) => {
      tickStatuses(s, s.battle!.enemies[0]!, []);
    });
    expect(ticked.team[1]!.health).toBe(3);
    expect(ticked.battle!.enemies[0]!.combat.bleedLeech).toEqual([]);
  });
  it("Death's Door floors fatal packets once and expires without reviving knocked-out creatures", () => {
    const next = produce(run(), (s) => {
      const target = s.team[0]!,
        enemy = s.battle!.enemies[0]!,
        events: Parameters<typeof hit>[5] = [];
      hit(s, enemy, target, 999, "burn", events, { retaliation: true });
      expect(target.health).toBe(1);
      expect(combat(target)).toMatchObject({ deathDoorUsed: true, grace: 2 });
      hit(s, enemy, target, 999, "burn", events, { retaliation: true });
      expect(target.health).toBe(1);
      combat(target).grace = 0;
      hit(s, enemy, target, 999, "burn", events, { retaliation: true });
    });
    expect(next.team[0]!.health).toBe(0);
  });
  it("Cleanse and Purge remove categories without damage, recursion, or RNG", () => {
    const next = produce(run(), (s) => {
      const target = s.team[0]!;
      const rng = s.rng;
      Object.assign(combat(target), { burn: 8, poison: 5, armor: 3 });
      target.block = 9;
      removeEffects(target, "cleanse", 1, []);
      expect(combat(target)).toMatchObject({ burn: 0, poison: 5, armor: 3 });
      removeEffects(target, "purge", 1, []);
      expect(target.block).toBe(0);
      grantStatus(target, "dodge", 999, []);
      expect(combat(target).dodge).toBe(70);
      expect(s.rng).toBe(rng);
    });
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
});
describe("combat commands and journey health", () => {
  it("classifies structured effects and tags once, without deriving XP from prose", () => {
    expect(cardKeywords({ definitionId: "emberback-attack" })).toEqual(["physical", "armor"]);
    expect(cardKeywords({ definitionId: "pollenmoth-heal" })).toEqual(["health"]);
  });
  it("keeps damage and knockouts through victory, rewards, and the next battle", () => {
    let s = produce(victoryReady(), (d) => {
      d.team[0]!.health = 0;
      d.team[1]!.health = 7;
    });
    // Use a living creature's attack, retaining every inert knocked-out card slot.
    const attack = s.cards.find((c) => c.definitionId === "emberback-attack")!;
    s = produce(s, (d) => {
      d.battle!.hand = [attack.id];
      d.battle!.draw = d.cards.filter((c) => c.id !== attack.id).map((c) => c.id);
    });
    s = accept(s, { type: "play", cardId: attack.id, targetId: "enemy-0" });
    s = accept(s, recruitChoice(s));
    expect(s.team.map((c) => c.health)).toEqual([0, 7, 30]);
    s = accept(decodeSave(encodeSave(s)), { type: "beginBattle" });
    expect(s.team.map((c) => c.health)).toEqual([0, 7, 30]);
  });
  it("heals the whole roster including knockouts and permits another visit while still hurt", () => {
    let s = produce(run(), (d) => {
      d.phase = "teamSelection";
      d.battle = null;
      d.encounter = 3;
      d.expedition = { pack: 0 };
      d.team[0]!.health = 0;
      d.team[1]!.health = 7;
    });
    const rng = s.rng;
    s = accept(s, { type: "visitCampfire" });
    expect(decodeSave(encodeSave(s))).toEqual(s);
    const revision = s.revision;
    s = accept(s, { type: "rest" });
    expect(s.team.map((c) => c.health)).toEqual([10, 16, 30]);
    expect(s.revision).toBe(revision + 1);
    expect(s.rng).toBe(rng);
    expect(s.encounter).toBe(3);
    expect(dispatch(s, { type: "rest" }).state).toBe(s);
    s = accept(decodeSave(encodeSave(s)), { type: "visitCampfire" });
    s = accept(s, { type: "rest" });
    s = accept(s, { type: "visitCampfire" });
    s = accept(s, { type: "rest" });
    expect(s.team.map((c) => c.health)).toEqual([30, 30, 30]);
    expect(dispatch(s, { type: "visitCampfire" }).state).toBe(s);
  });
});

it("rejects current-format saves that lose combat lifetime flags or invent control and Leech sources", () => {
  const changes: ((state: ReturnType<typeof run>) => void)[] = [
    (s) => {
      s.team[0]!.combat = undefined;
    },
    (s) => {
      s.team[0]!.combat!.grace = 2;
    },
    (s) => {
      s.battle!.enemies[0]!.lastAbility = "constructor";
    },
    (s) => {
      s.team[0]!.combat!.cooldown = 4;
    },
    (s) => {
      s.team[0]!.combat!.bleed = 3;
      s.team[0]!.combat!.bleedLeech = [{ sourceId: "missing", amount: 3 }];
    },
  ];
  for (const change of changes) expect(() => decodeSave(encodeSave(produce(run(), change)))).toThrow();
});

it("allows Dodge again after the control skip resolves while shared buildup immunity remains", () => {
  let seed = 1;
  while (((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32 >= 0.05) seed++;
  const events: Parameters<typeof hit>[5] = [];
  const next = produce(run(), (s) => {
    const enemy = s.battle!.enemies[0]!;
    enemy.health = 18;
    enemy.combat.controlled = "freeze";
    startAction(enemy, events);
    s.rng = seed;
    hit(s, s.team[0]!, enemy, 3, "stun", events);
  });
  expect(next.battle!.enemies[0]!.health).toBe(18);
  expect(next.battle!.enemies[0]!.combat.cooldown).toBe(3);
  expect(events.at(-1)!.text).toContain("Dodges");
});

it("keeps Campfire lineup changes resumable before and after Rest", () => {
  let state = produce(run(), (s) => {
    s.phase = "teamSelection";
    s.battle = null;
    s.encounter = 3;
    s.expedition = { pack: 0 };
    s.roster.push("pollenmoth");
    s.reserves.push({ id: "reserve-moth", species: "pollenmoth", health: 5, block: 0, attacked: false });
  });
  state = accept(state, { type: "visitCampfire" });
  const outgoing = state.team[0]!.id;
  state = accept(state, { type: "setLineup", activeId: outgoing, reserve: "reserve-moth" });
  expect(state.team[0]!.id).toBe("reserve-moth");
  expect(state.cards.filter((card) => card.ownerId === "reserve-moth")).toHaveLength(3);
  state = decodeSave(encodeSave(state));
  state = accept(state, { type: "rest" });
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(state.team[0]!.health).toBe(12);
  expect(state.reserves[0]!.id).toBe(outgoing);
});

it("publishes actual control immunity, capped buildup and removed status identities", () => {
  const immune = packet("freeze", 3, (s) => {
    s.battle!.enemies[0]!.combat.cooldown = 2;
  });
  expect(immune.next.battle!.enemies[0]!.combat.freeze).toBe(0);
  expect(immune.events).toContainEqual(expect.objectContaining({ status: "freeze", outcome: "immune" }));
  expect(immune.events.some((e) => e.outcome === "apply")).toBe(false);
  const gained = packet("burn", 3, (s) => {
    s.battle!.enemies[0]!.combat.burn = 999999;
  });
  expect(gained.events).toContainEqual(
    expect.objectContaining({ status: "burn", outcome: "gain", amount: 1 }),
  );
  const events: Parameters<typeof hit>[5] = [];
  produce(run(), (s) => {
    const target = s.battle!.enemies[0]!;
    target.combat.controlled = "freeze";
    target.combat.controlTurns = 1;
    target.combat.burn = 3;
    removeEffects(target, "cleanse", 2, events, s);
  });
  expect(events.filter((e) => e.status === "cleanse").map((e) => e.affectedStatus)).toEqual([
    "freeze",
    "burn",
  ]);
});

it("does not admit an enemy action after its own status tick knocks it out", () => {
  const initial = produce(run(7), (game) => {
    const enemy = game.battle!.enemies[0]!;
    enemy.health = 1;
    enemy.combat.poison = 1;
  });
  const result = dispatch(initial, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.events).toContainEqual(expect.objectContaining({ kind: "knockout", targetId: "enemy-0" }));
  expect(result.events.some((event) => event.kind === "action" && event.actorId === "enemy-0")).toBe(false);
  expect(result.state.battle!.enemies[0]!.lastAbility).toBe(initial.battle!.enemies[0]!.lastAbility);
});

it("rejects a save whose allied creature shares an enemy identity", () => {
  const state = produce(run(), (draft) => {
    const ally = draft.team[0]!;
    const previous = ally.id;
    ally.id = draft.battle!.enemies[0]!.id;
    draft.lineup = draft.lineup.map((id) => (id === previous ? ally.id : id));
    for (const card of draft.cards) if (card.ownerId === previous) card.ownerId = ally.id;
    for (const enemy of draft.battle!.enemies) if (enemy.targetId === previous) enemy.targetId = ally.id;
  });
  // Every owner reference still resolves, but status attribution and target identity are ambiguous.
  expect(() => decodeSave(encodeSave(state))).toThrow();
});

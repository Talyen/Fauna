import { addReserve, swapFixture, prepareDestination, accept, run, teamRun } from "../../support/game";
import { freshCombat } from "../../../src/game/combat/index";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { draw, drawKeyword, receiveCard } from "../../../src/game/card-zones";
import { shuffle } from "../../../src/game/random";
import { drawBossCards } from "../../../src/game/combat/legendary";
import type { GameEvent } from "../../../src/game/types";

it("promotes a Boss's oldest buffered cards before new draws without consuming randomness", () => {
  const state = structuredClone(run());
  const deck = {
    hand: ["h1", "h2", "h3", "h4"],
    buffer: ["b1", "b2", "b3"],
    draw: ["d1", "d2"],
    discard: [],
    mana: 4,
    pearls: 0,
  };
  const rng = state.rng;
  drawBossCards(state, deck, 2);
  expect(deck.hand).toEqual(["h1", "h2", "h3", "h4", "b1", "b2"]);
  expect(deck.buffer).toEqual(["b3", "d2", "d1"]);
  deck.hand.splice(0, 2);
  drawBossCards(state, deck, 0);
  expect(deck.hand).toEqual(["h3", "h4", "b1", "b2", "b3", "d2"]);
  expect(deck.buffer).toEqual(["d1"]);
  expect(state.rng).toBe(rng);
});

it("keeps draw eligibility and seeded recycling stable while Well Read grows a large deck", () => {
  const initial = produce(teamRun(42, ["rookhaven", "reedstag", "almanelle"]), (state) => {
    state.discovery.recruited.rookhaven = 6;
    state.team[1]!.health = 0;
    state.team[2]!.health = 0;
    state.cards = state.cards.filter((card) => !card.temporary);
    const inert = state.cards.find((card) => card.ownerId === state.team[1]!.id)!;
    for (let index = 0; index < 200; index++)
      state.cards.push({ ...inert, id: `copy-${index}`, temporary: true });
    const active = state.cards.filter((card) => card.ownerId === state.team[0]!.id);
    state.battle!.copySerial = 200;
    state.battle!.hand = [];
    state.battle!.buffer = [];
    state.battle!.draw = [
      active[0]!.id,
      ...state.cards.filter((card) => card.ownerId !== state.team[0]!.id).map((card) => card.id),
    ];
    state.battle!.discard = active.slice(1).map((card) => card.id);
    state.rng = 17;
  });
  expect(decodeSave(encodeSave(initial))).toEqual(initial);
  const random = { ...initial };
  const recycled = shuffle(random, [...initial.battle!.discard]).reverse();
  const drawn = [initial.battle!.draw[0]!, ...recycled];
  const events: GameEvent[] = [];
  const result = produce(initial, (state) => {
    draw(state, 3, events);
  });
  expect(result.battle!.hand).toEqual(drawn.flatMap((id, index) => [id, `copy-${200 + index}`]));
  expect(result.battle!.draw).toEqual(initial.battle!.draw.slice(1));
  expect(result.battle!.discard).toEqual([]);
  expect(result.cards).toHaveLength(initial.cards.length + 3);
  expect(decodeSave(encodeSave(result))).toEqual(result);
  expect(result.rng).toBe(random.rng);
  expect(events).toHaveLength(3);
  expect(initial.cards).toHaveLength(209);

  const revived = produce(result, (state) => {
    state.team[1]!.health = 1;
    draw(state, 1);
  });
  expect(revived.battle!.buffer).toEqual(["copy-199", "copy-203"]);
  expect(revived.rng).toBe(result.rng);
});

it.each([false, true])("preserves seeded draw recycling with all owners knocked out: %s", (allDead) => {
  const initial = produce(run(), (state) => {
    state.team[1]!.health = 0;
    state.team[2]!.health = 0;
    if (allDead) state.team[0]!.health = 0;
    state.rng = 17;
    const ids = state.cards.map((card) => card.id);
    state.battle!.hand = [];
    state.battle!.buffer = [];
    state.battle!.draw = [ids[0]!, ids[3]!];
    state.battle!.discard = [ids[1]!, ids[4]!, ids[2]!, ids[5]!];
  });
  const ids = initial.cards.map((card) => card.id);
  const random = { ...initial };
  const recycled = shuffle(random, allDead ? [ids[1]!, ids[4]!, ids[2]!, ids[5]!] : [ids[1]!, ids[2]!]);
  const result = produce(initial, (state) => {
    draw(state, allDead ? 6 : 3);
  });
  expect(result.battle!.hand).toEqual([...(allDead ? [ids[3]!, ids[0]!] : [ids[0]!]), ...recycled.reverse()]);
  expect(result.battle!.draw).toEqual(allDead ? [] : [ids[3]!]);
  expect(result.battle!.discard).toEqual(allDead ? [] : [ids[4]!, ids[5]!]);
  expect(result.rng).toBe(random.rng);
});

it("keyword draws prefer the last eligible slot and recycle only living owners' matching cards", () => {
  const initial = produce(teamRun(42, ["reedstag", "captoad", "almanelle"]), (state) => {
    state.team[1]!.health = 0;
    const first = state.cards.find((card) => card.definitionId === "reedstag-attack")!;
    const inert = state.cards.find((card) => card.definitionId === "captoad-attack")!;
    const recycled = state.cards.find((card) => card.definitionId === "almanelle-rooted-year")!;
    const second = state.cards.find((card) => card.definitionId === "reedstag-guard")!;
    const unrelated = state.cards.find((card) => card.definitionId === "reedstag-heal")!;
    const retained = state.cards.filter(
      (card) =>
        (card.ownerId === state.team[1]!.id && card.definitionId !== "captoad-attack") ||
        (card.ownerId === state.team[2]!.id && card.definitionId !== "almanelle-rooted-year"),
    );
    state.battle!.hand = [];
    state.battle!.buffer = [];
    state.battle!.draw = [first!.id, second.id, unrelated.id, inert!.id];
    state.battle!.discard = [recycled!.id, ...retained.map((card) => card.id)];
  });
  const first = produce(initial, (state) => drawKeyword(state, "nature"));
  expect(first.battle!.hand).toEqual([initial.battle!.draw[1]]);
  expect(first.battle!.discard).toEqual(initial.battle!.discard);
  expect(first.rng).toBe(initial.rng);
  const second = produce(first, (state) => drawKeyword(state, "nature"));
  expect(second.battle!.hand).toEqual([initial.battle!.draw[1], initial.battle!.draw[0]]);
  const third = produce(second, (state) => drawKeyword(state, "nature"));
  expect(third.battle!.hand).toEqual([
    initial.battle!.draw[1],
    initial.battle!.draw[0],
    initial.battle!.discard[0],
  ]);
  expect(third.battle!.draw).toEqual(initial.battle!.draw.slice(2));
  expect(third.battle!.discard).toEqual(initial.battle!.discard.slice(1));
  expect(third.rng).toBe(initial.rng);
});

it("keyword draws leave fallen owners' matching cards in place when no owner can draw", () => {
  const initial = produce(teamRun(42, ["reedstag", "captoad", "almanelle"]), (state) => {
    state.team.forEach((unit) => {
      unit.health = 0;
    });
    const ids = state.cards.map((card) => card.id);
    state.battle!.hand = [];
    state.battle!.buffer = [];
    state.battle!.draw = ids.slice(0, 3);
    state.battle!.discard = ids.slice(3);
  });
  const result = produce(initial, (state) => drawKeyword(state, "nature"));
  expect(result).toEqual(initial);
});

it.each([false, true])("preserves empty-pile reshuffle rules for keyword draw: %s", (keyword) => {
  const initial = produce(teamRun(42, ["reedstag", "captoad", "almanelle"]), (state) => {
    state.team[1]!.health = 0;
    state.battle!.hand = [];
    state.battle!.buffer = [];
    state.battle!.draw = [];
    state.battle!.discard = state.cards.map((card) => card.id);
    state.rng = 17;
  });
  const matching = initial.cards
    .filter(
      (card) =>
        card.ownerId !== initial.team[1]!.id &&
        ["reedstag-attack", "reedstag-guard", "almanelle-rooted-year"].includes(card.definitionId),
    )
    .map((card) => card.id);
  const drawable = initial.cards
    .filter((card) => card.ownerId !== initial.team[1]!.id)
    .map((card) => card.id);
  const random = { ...initial };
  const shuffled = shuffle(random, keyword ? [...matching] : [...initial.battle!.discard]);
  const drawn = [...shuffled].reverse().find((id) => keyword || drawable.includes(id))!;
  const result = produce(initial, (state) => {
    if (keyword) drawKeyword(state, "nature");
    else expect(draw(state, 1)).toBe(1);
  });
  expect(result.battle!.hand).toEqual([drawn]);
  expect(result.battle!.draw).toEqual(shuffled.filter((id) => id !== drawn));
  expect(result.battle!.discard).toEqual(
    keyword ? initial.battle!.discard.filter((id) => !matching.includes(id)) : [],
  );
  expect(result.rng).toBe(random.rng);
  expect(decodeSave(encodeSave(result))).toEqual(result);
});

it("queues a keyword draw and its Well Read copy behind existing overflow without copying queued cards", () => {
  const initial = produce(teamRun(42, ["rookhaven", "reedstag", "almanelle"]), (state) => {
    state.discovery.recruited.rookhaven = 6;
    state.cards = state.cards.filter((card) => !card.temporary);
    const ids = state.cards.map((card) => card.id);
    state.battle!.hand = ids.slice(0, 6);
    state.battle!.buffer = ids.slice(6, 7);
    state.battle!.draw = ids.slice(7);
    state.battle!.discard = [];
  });
  const events: GameEvent[] = [];
  const result = produce(initial, (state) => drawKeyword(state, "nature", events));
  const drawn = initial.battle!.draw.at(-1)!;
  const copyId = `copy-${initial.battle!.copySerial}`;
  expect(result.battle!.hand).toEqual(initial.battle!.hand);
  expect(result.battle!.buffer).toEqual([...initial.battle!.buffer, drawn, copyId]);
  expect(result.battle!.draw).toEqual(initial.battle!.draw.filter((id) => id !== drawn));
  expect(result.cards.at(-1)).toEqual({
    ...initial.cards.find((card) => card.id === drawn),
    id: copyId,
    temporary: true,
  });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ kind: "action", actorId: initial.team[0]!.id });
  expect(result.rng).toBe(initial.rng);
  expect(decodeSave(encodeSave(result))).toEqual(result);
});

function buffered() {
  return produce(run(), (d) => {
    d.battle!.hand = d.cards.slice(0, 6).map((card) => card.id);
    d.battle!.buffer = d.cards.slice(6, 8).map((card) => card.id);
    d.battle!.draw = d.cards.slice(8).map((card) => card.id);
    d.battle!.discard = [];
  });
}

describe("hidden hand overflow", () => {
  it("receives a generated card behind queued cards without triggering Well Read", () => {
    const initial = produce(teamRun(42, ["rookhaven", "reedstag", "almanelle"]), (state) => {
      state.discovery.recruited.rookhaven = 6;
      state.cards = state.cards.filter((card) => !card.temporary);
      const ids = state.cards.map((card) => card.id);
      state.battle!.hand = ids.slice(0, 5);
      state.battle!.buffer = ids.slice(5, 8);
      state.battle!.discard = ids.slice(8);
      state.battle!.draw = [];
    });
    const id = `copy-${initial.battle!.copySerial}`;
    const result = produce(initial, (state) => {
      state.cards.push({ ...state.cards[0]!, id, temporary: true });
      state.battle!.copySerial++;
      receiveCard(state, id);
    });
    expect(result.battle!.hand).toEqual([...initial.battle!.hand, initial.battle!.buffer[0]]);
    expect(result.battle!.buffer).toEqual([...initial.battle!.buffer.slice(1), id]);
    expect(result.cards).toHaveLength(initial.cards.length + 1);
    expect(result.rng).toBe(initial.rng);
    expect(decodeSave(encodeSave(result))).toEqual(result);
  });

  it("draws four opening cards plus Wind Feather without exceeding the six-card hand", () => {
    const s = accept(
      produce(run(), (d) => {
        prepareDestination(d);
        d.boons = ["tattered-pages"];
      }),
      { type: "beginBattle" },
    );
    expect(s.battle!.hand).toHaveLength(5);
    expect(s.battle!.buffer).toHaveLength(0);
    expect(s.battle!.draw).toHaveLength(4);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it("promotes queued cards in order after plays, without RNG, and rejects playing buffered cards", () => {
    let s = buffered();
    const first = s.battle!.buffer[0]!,
      second = s.battle!.buffer[1]!;
    const rejected = dispatch(s, { type: "play", cardId: first, targetId: "enemy-0" });
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(s);
    const before = encodeSave(s);
    const preview = previewCard(s, s.battle!.hand[0]!);
    expect(preview.state.battle!.hand.at(-1)).toBe(first);
    expect(encodeSave(s)).toBe(before);
    s = accept(s, { type: "play", cardId: s.battle!.hand[0]! });
    expect(s.battle!.hand).toHaveLength(6);
    expect(s.battle!.hand.at(-1)).toBe(first);
    expect(s.battle!.buffer).toEqual([second]);
    expect(s.rng).toBe(preview.state.rng);
    s = accept(s, { type: "play", cardId: s.battle!.hand[0]! });
    expect(s.battle!.hand).toHaveLength(6);
    expect(s.battle!.hand.at(-1)).toBe(second);
    expect(s.battle!.buffer).toEqual([]);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it.each([false, true])(
    "discards the hand while preserving oldest buffered cards on explicit or automatic turn end (automatic %s)",
    (automatic) => {
      const s = produce(buffered(), (d) => {
        if (automatic) d.battle!.mana = 1;
      });
      const queued = [...s.battle!.buffer];
      const next = accept(s, automatic ? { type: "play", cardId: s.battle!.hand[0]! } : { type: "endTurn" });
      expect(next.battle!.turn).toBe(2);
      expect(next.battle!.hand).toHaveLength(automatic ? 5 : 6);
      expect(next.battle!.hand.slice(0, automatic ? 1 : 2)).toEqual(automatic ? queued.slice(1) : queued);
      expect(next.battle!.buffer).toEqual([]);
      expect(
        queued.every((id) =>
          [...next.battle!.hand, ...next.battle!.draw, ...next.battle!.discard].includes(id),
        ),
      ).toBe(true);
      expect(decodeSave(encodeSave(next))).toEqual(next);
    },
  );

  it("preserves buffered card slots and switches their owner during a reserve swap", () => {
    const s = produce(run(), (d) => {
      addReserve(d, "recruit-pollenmoth", "pollenmoth", 23, freshCombat());
      const owned = d.cards.filter((card) => card.ownerId === "ally-1");
      d.battle!.buffer = [owned[0]!.id];
      d.battle!.hand = d.cards
        .filter((card) => card.id !== owned[0]!.id)
        .slice(0, 6)
        .map((card) => card.id);
      d.battle!.draw = d.cards
        .filter((card) => ![...d.battle!.hand, ...d.battle!.buffer].includes(card.id))
        .map((card) => card.id);
      d.battle!.discard = [];
    });
    const next = swapFixture(s, { type: "swap", activeId: "ally-1", reserve: "recruit-pollenmoth" });
    expect(next.battle!.buffer).toEqual(s.battle!.buffer);
    expect(next.cards.find((card) => card.id === next.battle!.buffer[0])!.ownerId).toBe("recruit-pollenmoth");
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("rejects oversized hands, duplicate buffered slots, and unfilled visible slots with waiting cards", () => {
    for (const change of [
      (s: ReturnType<typeof buffered>) => {
        s.battle!.hand.push(s.battle!.buffer.shift()!);
      },
      (s: ReturnType<typeof buffered>) => {
        s.battle!.buffer.push(s.battle!.hand[0]!);
      },
      (s: ReturnType<typeof buffered>) => {
        s.battle!.discard.push(s.battle!.hand.pop()!);
      },
    ])
      expect(() => decodeSave(encodeSave(produce(buffered(), change)))).toThrow();
  });
});

import { swapFixture } from "../../support/game";
import { freshCombat } from "../../../src/game/combat/index";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../../src/game/engine";
import { previewPlay } from "../../../src/game/preview";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { prepareDestination, accept, run } from "../../support/game";
import { draw } from "../../../src/game/card-zones";
import { shuffle } from "../../../src/game/random";

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
  const result = produce(initial, (state) => draw(state, allDead ? 6 : 3));
  expect(result.battle!.hand).toEqual([...(allDead ? [ids[3]!, ids[0]!] : [ids[0]!]), ...recycled.reverse()]);
  expect(result.battle!.draw).toEqual(allDead ? [] : [ids[3]!]);
  expect(result.battle!.discard).toEqual(allDead ? [] : [ids[4]!, ids[5]!]);
  expect(result.rng).toBe(random.rng);
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
    const preview = previewPlay(s, s.battle!.hand[0]!);
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
      d.reserves.push({
        id: "recruit-pollenmoth",
        species: "pollenmoth",
        health: 23,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      });
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

import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { previewPlay } from "../../src/game/preview";
import { combat, hit } from "../../src/game/combat";
import { dispatch } from "../../src/game/engine";
import { appendFeedback, feedbackFrames } from "../../src/ui/combat-feedback-model";
import type { GameEvent } from "../../src/game/types";
import { run, feedbackBattle } from "./helpers";
import { decodeSave, encodeSave } from "../../src/game/save";
describe("uncommitted previews", () => {
  it("includes traits and upgrades without mutating the committed state", () => {
    const original = produce(run(), (d) => {
      const attack = d.cards.find((c) => c.definitionId === "emberfox-attack")!;
      attack.level = 1;
      d.battle!.hand = [attack.id];
      d.battle!.enemies[0]!.health = 12;
    });
    const serialized = JSON.stringify(original),
      card = original.battle!.hand[0]!;
    const preview = previewPlay(original, card, "enemy-0");
    expect(preview.accepted).toBe(true);
    expect(preview.state.battle!.enemies[0]!.health).toBe(0);
    expect(preview.events.find((e) => e.kind === "damage")?.amount).toBe(12);
    expect(preview.events.some((e) => e.kind === "knockout" && e.targetId === "enemy-0")).toBe(true);
    expect(JSON.stringify(original)).toBe(serialized);
    expect(dispatch(original, { type: "play", cardId: card, targetId: "enemy-0" })).toEqual(preview);
    expect(previewPlay(original, card, "ally-0").accepted).toBe(false);
  });
  it("reports absorbed block separately and caps damage at actual health lost", () => {
    const state = produce(run(), (d) => {
      d.team[0]!.health = 1;
      d.team[0]!.block = 2;
      d.battle!.enemies.forEach((e) => (e.targetId = "ally-0"));
    });
    const events: Parameters<typeof hit>[5] = [];
    produce(state, (d) => {
      d.rng = 1;
      combat(d.team[0]!).deathDoorUsed = true;
      hit(d, d.battle!.enemies[0]!, d.team[0]!, 4, "nature", events);
    });
    expect(events.filter((e) => e.targetId === "ally-0").map((e) => [e.kind, e.amount])).toEqual([
      ["block", -2],
      ["damage", 1],
      ["knockout", undefined],
    ]);
  });
});
describe("floating feedback", () => {
  it("merges matching display values without mutating events or renewing lifetime", () => {
    const events = [
      {
        kind: "damage" as const,
        targetId: "enemy-0",
        damageType: "fire" as const,
        amount: 4,
        text: "4 Fire damage",
      },
    ];
    const first = appendFeedback([], events, 1, 0);
    const merged = appendFeedback(first, events, 2, 100);
    expect(merged[0]!.entries[0]!.amount).toBe(8);
    expect(merged[0]!.started).toBe(0);
    expect(merged[0]!.id).toBe(first[0]!.id);
    expect(first[0]!.entries[0]!.amount).toBe(4);
    expect(events[0]!.amount).toBe(4);
    expect(appendFeedback(merged, [], 3, 1099)).not.toEqual([]);
    expect(appendFeedback(merged, [], 3, 1100)).toEqual([]);
  });
  it("separates types, recipients and directions, bounds bursts, and excludes prose", () => {
    const event = {
      kind: "damage" as const,
      targetId: "enemy-0",
      damageType: "fire" as const,
      amount: 3,
      text: "",
    };
    const grouped = appendFeedback(
      [],
      [
        event,
        { ...event, damageType: "nature" },
        { ...event, targetId: "ally-0" },
        { kind: "block", targetId: "ally-0", amount: 4, text: "" },
        { kind: "block", targetId: "ally-0", amount: -4, text: "" },
        { kind: "action", text: "Uses a card" },
      ],
      1,
      0,
    );
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.entries).toHaveLength(2);
    expect(grouped[1]!.entries).toHaveLength(3);
    let bursts = grouped;
    for (let i = 1; i < 5; i++) bursts = appendFeedback(bursts, [event], i + 1, i * 260);
    expect(bursts.filter((b) => b.targetId === "enemy-0")).toHaveLength(3);
  });
});

const damage = (amount: number, damageType: GameEvent["damageType"] = "fire"): GameEvent => ({
  kind: "damage",
  targetId: "enemy-0",
  amount,
  damageType,
  text: "damage",
});
it("gives unmatched effects their own lifetime and reserves digit width without restarting an existing Critical", () => {
  const first = appendFeedback([], [damage(9)], "first", 0);
  const mixed = appendFeedback(first, [{ ...damage(1), critical: true }, damage(3, "ice")], "mixed", 200);
  expect(mixed.map((b) => [b.started, b.entries.map((e) => e.amount)])).toEqual([
    [0, [10]],
    [200, [3]],
  ]);
  expect(mixed[0]!.entries[0]!.id).toBe(first[0]!.entries[0]!.id);
  expect(mixed[0]!.entries[0]!.critical).toBe(true);
  const overflow = appendFeedback(mixed, [damage(90)], "overflow", 210);
  expect(overflow.map((b) => b.entries[0]!.amount)).toEqual([10, 3, 90]);
  expect(appendFeedback(overflow, [], "expiry", 1100).map((b) => b.started)).toEqual([200, 210]);
});
it("evicts before merging so a fresh result cannot disappear with the oldest burst", () => {
  let bursts = appendFeedback([], [damage(2)], 1, 0);
  bursts = appendFeedback(bursts, [damage(3, "ice")], 2, 50);
  bursts = appendFeedback(bursts, [damage(4, "nature")], 3, 100);
  const next = appendFeedback(bursts, [damage(5), damage(6, "light")], 4, 150);
  expect(next).toHaveLength(3);
  expect(next.at(-1)!.entries.map((e) => e.amount)).toEqual([5, 6]);
  expect(next.some((b) => b.id === bursts[0]!.id)).toBe(false);
});
it("orders notices, losses and gains, suppresses redundant zeros and keeps ineffective feedback", () => {
  const events: GameEvent[] = [
    { kind: "heal", targetId: "enemy-0", amount: 3, text: "heal" },
    damage(0),
    { kind: "status", status: "freeze", outcome: "immune", targetId: "enemy-0", text: "immune" },
    damage(2),
    { kind: "block", targetId: "enemy-0", amount: -2, text: "absorb" },
  ];
  const burst = appendFeedback([], events, 1, 0)[0]!;
  expect(burst.entries.map((e) => e.kind)).toEqual(["status", "damage", "block", "heal"]);
  expect(appendFeedback([], [damage(0)], 2, 0)[0]!.entries[0]!.amount).toBe(0);
  const duplicate = appendFeedback([burst], [events[2]!], 3, 100);
  expect(duplicate[0]!.entries.filter((e) => e.kind === "status")).toHaveLength(1);
});
it("keeps non-additive and periodic packets separate across actions but totals actual same-action damage", () => {
  const initial = appendFeedback([], [damage(3)], 1, 0);
  expect(appendFeedback(initial, [{ ...damage(2), additive: false }], 2, 100)).toHaveLength(2);
  expect(appendFeedback(initial, [{ ...damage(2), periodic: true }], 2, 100)).toHaveLength(2);
  const same = appendFeedback([], [damage(3), { ...damage(2), periodic: true, critical: true }], 3, 0);
  expect(same[0]!.entries).toMatchObject([{ amount: 5, critical: true }]);
});
it("sequences resolved actions without treating counterattack source IDs as new actions", () => {
  const attack: GameEvent = { kind: "action", actionType: "attack", actorId: "enemy-0", text: "attack" };
  const frames = feedbackFrames([
    attack,
    damage(2),
    { ...damage(1), actorId: "ally-0" },
    { ...attack, actorId: "enemy-1" },
    { ...damage(3), actorId: "enemy-1" },
  ]);
  expect(frames.map((frame) => frame.length)).toEqual([3, 2]);
});

it("keeps the rendered mixed-feedback fixture current and exercises a real Critical, absorption and status gain", () => {
  const game = feedbackBattle();
  expect(decodeSave(encodeSave(game))).toEqual(game);
  const played = dispatch(game, {
    type: "play",
    cardId: game.battle!.hand[0]!,
    targetId: "enemy-0",
    autoEndTurn: false,
  });
  expect(played.accepted).toBe(true);
  expect(played.state.phase).toBe("battle");
  expect(played.events).toContainEqual(expect.objectContaining({ kind: "damage", critical: true }));
  expect(played.events).toContainEqual(expect.objectContaining({ kind: "block", amount: -4 }));
  expect(appendFeedback([], played.events, 1, 0).find((b) => b.targetId === "enemy-0")!.entries).toHaveLength(
    4,
  );
});

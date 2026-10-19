import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { previewPlay } from "../../src/game/preview";
import { dispatch } from "../../src/game/engine";
import { appendFeedback } from "../../src/ui/combat-feedback";
import { run } from "./helpers";
describe("uncommitted previews", () => {
  it("includes traits, upgrades and consumed marks without mutating the committed state", () => {
    const original = produce(run(), (d) => {
      const attack = d.cards.find((c) => c.definitionId === "emberfox-attack")!;
      attack.level = 1;
      d.battle!.hand = [attack.id];
      d.battle!.enemies[0]!.health = 18;
      d.battle!.enemies[0]!.marks = 2;
    });
    const serialized = JSON.stringify(original),
      card = original.battle!.hand[0]!;
    const preview = previewPlay(original, card, "enemy-0");
    expect(preview.accepted).toBe(true);
    expect(preview.state.battle!.enemies[0]!.health).toBe(0);
    expect(preview.state.battle!.enemies[0]!.marks).toBe(0);
    expect(preview.events.find((e) => e.kind === "damage")?.amount).toBe(18);
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
    const result = dispatch(state, { type: "endTurn" });
    expect(result.events.filter((e) => e.targetId === "ally-0").map((e) => [e.kind, e.amount])).toEqual([
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
    expect(appendFeedback(merged, [], 3, 1400)).toEqual([]);
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

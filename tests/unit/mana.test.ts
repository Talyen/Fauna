import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../src/game/engine";
import { previewPlay } from "../../src/game/preview";
import { decodeSave, encodeSave } from "../../src/game/save";
import { selectCombatCue } from "../../src/ui/combat-audio";
import { impactTargets } from "../../src/ui/combat-impact";
import { run, victoryReady } from "./helpers";
function lastMana() {
  return produce(run(7), (d) => {
    const card = d.cards.find((c) => c.definitionId === "mossback-attack")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.discard = [];
    d.battle!.mana = 1;
  });
}
describe("mana turn settlement", () => {
  it("commits the last card and enemy turn atomically, while preview stays card-only", () => {
    const before = lastMana(),
      card = before.battle!.hand[0]!;
    const preview = previewPlay(before, card, "enemy-0");
    expect(preview.state.battle!.mana).toBe(0);
    expect(preview.state.battle!.turn).toBe(1);
    expect(preview.state.team.map((c) => c.health)).toEqual([29, 24, 26]);
    const result = dispatch(before, { type: "play", cardId: card, targetId: "enemy-0" });
    expect(result.accepted).toBe(true);
    expect(result.state.revision).toBe(before.revision + 1);
    expect(result.state.battle!.turn).toBe(2);
    expect(result.state.battle!.mana).toBe(4);
    expect(result.state.battle!.hand).toHaveLength(4);
    expect(result.events.filter((e) => e.actorId?.startsWith("enemy-") && e.kind === "action")).toHaveLength(
      3,
    );
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(before.battle!.mana).toBe(1);
    expect(before.battle!.turn).toBe(1);
  });
  it("does not give defeated enemies a turn after the winning last-mana card", () => {
    const s = produce(victoryReady(), (d) => {
      d.battle!.mana = 1;
    });
    const result = dispatch(s, { type: "play", cardId: s.battle!.hand[0]!, targetId: "enemy-0" });
    expect(result.state.phase).toBe("recruit");
    expect(result.state.battle!.turn).toBe(1);
    expect(result.events.some((e) => e.actorId?.startsWith("enemy-"))).toBe(false);
  });
  it("rejects exhausted committed turns instead of repairing them during load", () => {
    const exhausted = produce(lastMana(), (d) => {
      d.battle!.mana = 0;
    });
    expect(() => decodeSave(encodeSave(exhausted))).toThrow();
  });
});
describe("outcome-driven impact and sound", () => {
  it("keeps absorbed and ineffective hits still, with distinct nonzero sound cues", () => {
    const blocked = [
      { kind: "damage" as const, targetId: "ally-0", amount: 0, text: "" },
      { kind: "block" as const, targetId: "ally-0", amount: -4, text: "" },
    ];
    expect(impactTargets(blocked)).toEqual([]);
    expect(selectCombatCue(blocked)).toBe("absorb");
    expect(selectCombatCue([{ kind: "heal", amount: 0, text: "" }])).toBeUndefined();
    const hit = {
      kind: "damage" as const,
      targetId: "enemy-0",
      damageType: "fire" as const,
      amount: 8,
      text: "",
    };
    expect(impactTargets([hit, hit])).toEqual(["enemy-0"]);
    expect(selectCombatCue([hit, { kind: "heal", amount: 8, text: "" }])).toBe("fire");
    expect(selectCombatCue([{ kind: "heal", amount: 9, text: "" }, hit])).toBe("heal");
  });
});

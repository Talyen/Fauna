import { afterEach, expect, it, vi } from "vitest";
import { produce } from "immer";
import * as content from "../../src/game/content";
import { creaturePassive } from "../../src/game/progression";
import { actionValue, enemyAbilityValue } from "../../src/game/rules";
import { createGame } from "../../src/game/engine";
import { accept, teamRun } from "./helpers";

afterEach(() => vi.restoreAllMocks());

it("resolves authored tiers and falls back for undefined star tiers", () => {
  for (const kind of content.SPECIES) {
    for (let copies = 0; copies <= 6; copies++) {
      const game = produce(createGame(), (draft) => {
        if (copies) draft.discovery.recruited[kind.id] = copies;
      });
      let rank = Math.max(0, copies - 1);
      while (rank > 0 && kind.passiveTiers[rank] === null) rank--;
      expect(creaturePassive(game, kind.id)).toEqual({ rank, ...kind.passiveTiers[rank]! });
    }
  }
});

it("resolves the highest authored tier for card rules and battle start without scaling enemies", () => {
  const base = content.species;
  vi.spyOn(content, "species").mockImplementation((kind) => {
    const original = base(kind);
    if (kind !== "stormfin") return original;
    return {
      ...original,
      passiveTiers: [
        original.passiveTiers[0],
        null,
        {
          description: "Guard cards grant 7 extra Block. Start battle with 3 Block and 4 Thorns.",
          effects: [
            { kind: "cardBonus", trigger: "guard", amount: 7 },
            { kind: "battleStart", effect: "block", amount: 3 },
            { kind: "battleStart", effect: "thorns", amount: 4 },
          ],
        },
        null,
        null,
        null,
      ],
    };
  });
  const guard = { id: "test", definitionId: "stormfin-guard", ownerId: "ally-0", level: 0 };
  for (const copies of [1, 2, 3, 4, 6]) {
    const game = produce(teamRun(42, ["stormfin", "emberfox", "silkmoth"]), (draft) => {
      draft.discovery.recruited.stormfin = copies;
      draft.phase = "teamSelection";
      draft.battle = null;
    });
    const upgraded = copies >= 3;
    expect(creaturePassive(game, "stormfin").rank).toBe(upgraded ? 2 : 0);
    expect(actionValue(guard, game.team[0]!, game)).toBe(upgraded ? 13 : 6);
    const battle = accept(game, { type: "beginBattle" });
    expect(battle.team[0]!.block).toBe(upgraded ? 3 : 0);
    expect(battle.team[0]!.combat!.thorns).toBe(upgraded ? 4 : 0);
    expect(
      enemyAbilityValue({ species: "stormfin", damage: 8 }, content.definition(guard.definitionId)),
    ).toBe(4);
  }
});

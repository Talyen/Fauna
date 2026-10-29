import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { addReserve, requireBattle, teamRun } from "../../../support/game";
import { cardId, playCard, setHand } from "../../../support/cards";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { freshCombat } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { decayBlock } from "../../../../src/game/combat/turns";
import { observeDecisions } from "../../../../src/game/random";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { validateCatalog } from "../../../../src/game/content-validation";

const mantle = "wendlet-midnight-mantle";
const snare = "wendlet-umbra-snare";
const borrowed = "wendlet-borrowed-silhouette";
function battle() {
  return produce(requireBattle(teamRun(42, ["wendlet", "coralcurl", "mossguard"])), (draft) => {
    setHand(draft, [mantle, snare, borrowed]);
  });
}

describe("Wendlet", () => {
  it("authors the chosen kit and complete passive tiers", () => {
    expect(speciesCards("wendlet").map((card) => [cardText(card), card.cost])).toEqual([
      ["Gain 20% Dodge until your next turn; Gain 3 Block", 1],
      ["Deal 6 Stun damage", 1],
      ["Draw a copy of a random backup ally ability / Gain 1 Mana", 1],
    ]);
    expect(species("wendlet").passiveTiers.map((tier) => tier.effects)).toEqual(
      [50, 60, 70, 80, 90, 100].map((amount) => [{ kind: "livingShadow", amount }]),
    );
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });
  it.each([50, 60, 70, 80, 90, 100])("gives %i percent of lost Block to the most injured ally", (percent) => {
    const ready = produce(battle(), (draft) => {
      draft.discovery.recruited.wendlet = 1 + (percent - 50) / 10;
      draft.team[0]!.block = 20;
      draft.team[1]!.health = 5;
      decayBlock(draft, draft.team[0]!, []);
    });
    expect(ready.team[0]!.block).toBe(10);
    expect(ready.team[1]!.block).toBe(percent / 10);
    expect(decodeSave(encodeSave(ready))).toEqual(ready);
  });
  it("protects itself when alone and gives nothing while in backup", () => {
    produce(battle(), (draft) => {
      draft.team[0]!.health = 1;
      draft.team[0]!.block = 20;
      decayBlock(draft, draft.team[0]!, []);
      expect(draft.team[0]!.block).toBe(15);
      const shadow = draft.team.shift()!;
      draft.reserves.push(shadow);
      shadow.block = 20;
      decayBlock(draft, shadow, []);
      expect(shadow.block).toBe(10);
    });
  });
  it("grants temporary Dodge and Block and uses the ordinary stun attack", () => {
    const ready = battle();
    const result = playCard(ready, mantle);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]).toMatchObject({ block: 3, combat: { temporaryDodge: 20 } });
    expect(previewCard(ready, cardId(ready, mantle))).toEqual(result);
    expect(definition(snare)).toMatchObject({ effect: "attack", value: 6, damageType: "stun" });
  });
  it("draws a playable Wendlet-owned copy of a living backup ability and restores Mana", () => {
    const ready = produce(battle(), (draft) => {
      addReserve(draft, "reserve", "dulcera", 20, freshCombat());
    });
    const result = playCard(ready, borrowed);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(ready.battle.mana);
    const copy = result.state.cards.find((card) => card.borrowedFrom === "dulcera")!;
    expect(copy).toMatchObject({ ownerId: "ally-0", temporary: true, level: 0 });
    expect(speciesCards("dulcera").map((card) => card.id)).toContain(copy.definitionId);
    expect([...result.state.battle!.hand, ...result.state.battle!.buffer]).toContain(copy.id);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(previewCard(ready, cardId(ready, borrowed))).toEqual(result);
  });
  it.each([
    ["memento", "memento-lost-procession"],
    ["memento", "memento-treasury-echo"],
    ["memento", "memento-drowned-revelation"],
    ["chronora", "chronora-borrowed-moment"],
    ["chronora", "chronora-bridge-rewind"],
  ] as const)("preserves save validity when Wendlet uses a borrowed %s ability %s", (kind, id) => {
    const ready = produce(battle(), (draft) => {
      addReserve(draft, "legendary", kind, 30, freshCombat());
      const def = definition(id);
      executeAbility(draft, { side: "player", actor: draft.team[0]!, def, value: def.value }, []);
    });
    expect(decodeSave(encodeSave(ready))).toEqual(ready);
  });
  it.each([
    ["memento", 0, "memento-lost-procession"],
    ["memento", 1, "memento-treasury-echo"],
    ["chronora", 2, "chronora-bridge-rewind"],
  ] as const)(
    "creates and plays a borrowed %s ability without invalidating saves",
    (kind, index, expected) => {
      const ready = produce(battle(), (draft) => {
        addReserve(draft, "legendary", kind, 30, freshCombat());
        observeDecisions(draft, () => (index + 0.5) / 3);
        executeAbility(
          draft,
          { side: "player", actor: draft.team[0]!, def: definition(borrowed), value: 1 },
          [],
        );
      });
      const copy = ready.cards.find((card) => card.borrowedFrom === kind)!;
      expect(copy.definitionId).toBe(expected);
      expect(decodeSave(encodeSave(ready))).toEqual(ready);
      const played = dispatch(ready, { type: "play", cardId: copy.id, autoEndTurn: false });
      expect(played.accepted).toBe(true);
      expect(decodeSave(encodeSave(played.state))).toEqual(played.state);
    },
  );
  it.each([
    [0, "memento-lost-procession"],
    [1, "memento-treasury-echo"],
  ] as const)("lets Oathara play fallen Wendlet's borrowed %s ability", (index, ability) => {
    const ready = produce(requireBattle(teamRun(42, ["wendlet", "oathara", "coralcurl"])), (draft) => {
      addReserve(draft, "reserve", "memento", 30, freshCombat());
      observeDecisions(draft, () => (index + 0.5) / 3);
      executeAbility(
        draft,
        { side: "player", actor: draft.team[0]!, def: definition(borrowed), value: 1 },
        [],
      );
      draft.team[0]!.health = 0;
      draft.reserves[0]!.health = 0;
      setHand(draft, [ability]);
    });
    const result = playCard(ready, ability);
    expect(result.accepted).toBe(true);
    if (index === 0) expect(result.state.battle!.minions?.[0]?.minion.ownerId).toBe("ally-1");
    else
      expect(result.state.cards.find((card) => card.definitionId === "memento-pearl")).toMatchObject({
        ownerId: "ally-1",
        borrowedFrom: "memento",
      });
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
  it("rejects a borrowed card that does not belong to its recorded source", () => {
    const ready = produce(battle(), (draft) => addReserve(draft, "reserve", "dulcera", 20, freshCombat()));
    const result = playCard(ready, borrowed);
    const corrupted = produce(result.state, (draft) => {
      const copy = draft.cards.find((card) => card.borrowedFrom)!;
      copy.definitionId = "mossguard-attack";
    });
    expect(() => decodeSave(encodeSave(corrupted))).toThrow();
  });
  it("still restores Mana without a living backup and does not sample RNG", () => {
    const ready = battle();
    const result = playCard(ready, borrowed);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(ready.battle.mana);
    expect(result.state.rng).toBe(ready.rng);
    expect(result.state.cards.some((card) => card.borrowedFrom)).toBe(false);
  });
});

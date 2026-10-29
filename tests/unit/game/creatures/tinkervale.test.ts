import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { requireBattle, teamRun } from "../../../support/game";
import { cardId, playCard, setHand } from "../../../support/cards";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { hit } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { playEnemyAbility } from "../../../../src/game/combat/enemy-action";
import { chooseEnemyCard } from "../../../../src/game/combat/enemy-policy";
import { previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { validateCatalog } from "../../../../src/game/content-validation";

const canopy = "tinkervale-copper-canopy";
const launch = "tinkervale-clockwork-launch";
const mender = "tinkervale-gear-mender";
const bee = "tinkervale-clockwork-bee";
function battle() {
  return produce(requireBattle(teamRun(42, ["tinkervale", "sternshell", "mossguard"])), (draft) => {
    setHand(draft, [canopy, launch, mender]);
  });
}

describe("Tinkervale", () => {
  it("authors the selected kit and six different passive tiers", () => {
    expect(speciesCards("tinkervale").map((card) => [cardText(card), card.cost])).toEqual([
      ["Allies gain 2 Block", 1],
      ["Add 2 Clockwork Bees to your hand", 1],
      ["Give an ally 3 Armor", 1],
    ]);
    expect(species("tinkervale").passiveTiers.map((tier) => tier.effects[0]!.amount)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });
  it.each([1, 2, 3, 4, 5, 6])("protects an ally when Armor is worn at tier %i", (amount) => {
    produce(battle(), (draft) => {
      draft.discovery.recruited.tinkervale = amount;
      const ally = draft.team[1]!;
      ally.block = 0;
      ally.combat!.armor = 3;
      hit(draft, draft.battle.enemies[0]!, ally, 6, "physical", [], { origin: "ability", cannotDodge: true });
      expect(ally.combat!.armor).toBe(2);
      expect(ally.block).toBe(amount);
    });
  });
  it("does not trigger on absorbed damage, Water, or when the maker is in backup", () => {
    produce(battle(), (draft) => {
      const ally = draft.team[1]!;
      const enemy = draft.battle.enemies[0]!;
      ally.combat!.armor = 3;
      ally.block = 20;
      hit(draft, enemy, ally, 4, "physical", [], { origin: "ability", cannotDodge: true });
      expect(ally.block).toBe(16);
      ally.block = 0;
      hit(draft, enemy, ally, 4, "water", [], { origin: "ability", cannotDodge: true });
      expect(ally.block).toBe(0);
      draft.reserves.push(draft.team.shift()!);
      hit(draft, enemy, ally, 4, "physical", [], { origin: "ability", cannotDodge: true });
      expect(ally.block).toBe(0);
    });
  });
  it("grants group Block and chosen Armor", () => {
    const ready = battle();
    const blocked = playCard(ready, canopy);
    expect(blocked.accepted).toBe(true);
    expect(blocked.state.team.map((unit) => unit.block)).toEqual([2, 2, 2]);
    const armored = playCard(ready, mender, ready.team[2]!.id);
    expect(armored.accepted).toBe(true);
    expect(armored.state.team[2]!.combat!.armor).toBe(3);
    expect(previewCard(ready, cardId(ready, mender), ready.team[2]!.id)).toEqual(armored);
  });
  it("creates two temporary Bees which survive saves and are consumed on use", () => {
    const ready = battle();
    const result = playCard(ready, launch);
    expect(result.accepted).toBe(true);
    const bees = result.state.cards.filter((card) => card.definitionId === bee);
    expect(bees).toHaveLength(2);
    expect(bees.every((card) => card.temporary && result.state.battle!.hand.includes(card.id))).toBe(true);
    expect(previewCard(ready, cardId(ready, launch))).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    const used = playCard(result.state, bee, result.state.battle!.enemies[0]!.id);
    expect(used.accepted).toBe(true);
    expect(used.state.cards.filter((card) => card.definitionId === bee)).toHaveLength(1);
    expect(decodeSave(encodeSave(used.state))).toEqual(used.state);
    expect(cardText(definition(bee))).toBe("Consume; Deal 6 Physical damage");
  });
  it("gives enemy allies the base passive and lets the enemy create and spend Bees", () => {
    produce(battle(), (draft) => {
      draft.discovery.recruited.tinkervale = 6;
      const maker = draft.battle.enemies[0]!;
      const ally = draft.battle.enemies[1]!;
      maker.species = "tinkervale";
      ally.combat.armor = 3;
      ally.block = 0;
      hit(draft, draft.team[0]!, ally, 6, "physical", [], { origin: "ability", cannotDodge: true });
      expect(ally.block).toBe(1);
      executeAbility(draft, { side: "enemy", actor: maker, def: definition(launch), value: 2 }, []);
      expect(maker.clockworkBees).toBe(2);
      draft.team[1]!.health = 20;
      expect(chooseEnemyCard(draft, maker, [definition(bee)])?.def.id).toBe(bee);
      playEnemyAbility(draft, maker, definition(bee), draft.team[0]!.id, undefined, []);
      expect(maker.clockworkBees).toBe(1);
    });
  });
  it("buffers a Bee when Clockwork Launch fills the hand", () => {
    const ready = produce(battle(), (draft) => {
      const more = draft.cards.filter((card) => card.ownerId !== draft.team[0]!.id).slice(0, 3);
      const hand = [canopy, launch, mender].map((id) => cardId(draft, id));
      draft.battle.hand = [...hand, ...more.map((card) => card.id)];
      draft.battle.draw = draft.battle.draw.filter((id) => !draft.battle.hand.includes(id));
      draft.battle.discard = draft.battle.discard.filter((id) => !draft.battle.hand.includes(id));
    });
    const result = playCard(ready, launch);
    expect(result.accepted).toBe(true);
    const bees = result.state.cards.filter((card) => card.definitionId === bee);
    expect(bees).toHaveLength(2);
    expect(bees.filter((card) => result.state.battle!.hand.includes(card.id))).toHaveLength(1);
    expect(bees.filter((card) => result.state.battle!.buffer.includes(card.id))).toHaveLength(1);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
  it("preserves Bees created when Oathara plays a fallen Tinkervale's Launch", () => {
    const ready = produce(requireBattle(teamRun(42, ["tinkervale", "oathara", "mossguard"])), (draft) => {
      setHand(draft, [launch]);
      draft.team[0]!.health = 0;
    });
    const result = playCard(ready, launch);
    expect(result.accepted).toBe(true);
    expect(result.state.cards.filter((card) => card.definitionId === bee)).toMatchObject([
      { ownerId: ready.team[1]!.id, borrowedFrom: "tinkervale" },
      { ownerId: ready.team[1]!.id, borrowedFrom: "tinkervale" },
    ]);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
});

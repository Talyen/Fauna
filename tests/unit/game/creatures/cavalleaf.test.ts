import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { addReserve, requireBattle, teamRun } from "../../../support/game";
import { cardId, playCard, setHand } from "../../../support/cards";
import { definition, species, speciesCards } from "../../../../src/game/content";
import { cardText, enemyCard } from "../../../../src/game/card-rules";
import { freshCombat, restoreHealth } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { validateCatalog } from "../../../../src/game/content-validation";

const meadow = "cavalleaf-meadow-return";
const rain = "cavalleaf-raincall";
const leap = "cavalleaf-prairie-leap";

function battle() {
  return produce(requireBattle(teamRun(42, ["cavalleaf", "coralcurl", "mossguard"])), (draft) => {
    draft.team[0]!.health = 20;
    draft.team[1]!.health = 20;
    draft.team[2]!.health = 20;
    draft.team[0]!.combat!.burn = 4;
    draft.team[1]!.combat!.burn = 2;
    draft.team[1]!.combat!.poison = 3;
    setHand(draft, [meadow, rain, leap]);
  });
}

describe("Cavalleaf", () => {
  it("authors the selected kit and six complete passive tiers", () => {
    expect(speciesCards("cavalleaf").map((card) => [cardText(card), card.cost])).toEqual([
      ["Restore 2 Health to all allies", 1],
      ["Draw a Water card / Cleanse Burn from allies", 1],
      ["Swap out for a random backup / Incoming ally gains 4 Thorns", 1],
    ]);
    expect(species("cavalleaf").passiveTiers.map((tier) => tier.effects)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => [{ kind: "wildPath", amount }]),
    );
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it.each([1, 2, 3, 4, 5, 6])("grants tier %i Thorns per actual allied restoration", (amount) => {
    const ready = produce(battle(), (draft) => {
      draft.discovery.recruited.cavalleaf = amount;
      draft.team[2]!.health = species("mossguard").health;
    });
    const result = playCard(ready, meadow);
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((unit) => unit.combat!.thorns)).toEqual([amount, amount, 0]);
    expect(previewCard(ready, cardId(ready, meadow))).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("uses any allied restoration, including backup healing, but not a provider in backup", () => {
    produce(battle(), (draft) => {
      addReserve(draft, "reserve", "dulcera", 12, freshCombat());
      restoreHealth(draft.reserves[0]!, 2, [], false, draft, false, draft.team[1]);
      expect(draft.reserves[0]!.combat!.thorns).toBe(1);
      draft.team[0]!.health = 0;
      restoreHealth(draft.team[1]!, 2, [], false, draft, false, draft.team[2]);
      expect(draft.team[1]!.combat!.thorns).toBe(0);
    });
  });

  it("gives an enemy Cavalleaf its base-tier passive without the player's rank", () => {
    produce(battle(), (draft) => {
      draft.discovery.recruited.cavalleaf = 6;
      const enemy = draft.battle.enemies[0]!;
      enemy.species = "cavalleaf";
      enemy.health = 10;
      restoreHealth(enemy, 2, [], false, draft, false, enemy);
      expect(enemy.combat.thorns).toBe(1);
    });
  });

  it("draws a Water card then removes only Burn from the deployed team", () => {
    const ready = battle();
    const result = playCard(ready, rain);
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((ally) => ally.combat!.burn)).toEqual([0, 0, 0]);
    expect(result.state.team[1]!.combat!.poison).toBe(3);
    expect(
      result.state.battle!.hand.some(
        (id) => result.state.cards.find((card) => card.id === id)?.definitionId === "coralcurl-attack",
      ),
    ).toBe(true);
    expect(previewCard(ready, cardId(ready, rain))).toEqual(result);
    expect(cardText(enemyCard(definition(rain)))).toBe(cardText(definition(rain)));
  });

  it("swaps to a living backup and grants incoming Thorns, with preview and save parity", () => {
    const ready = produce(battle(), (draft) => addReserve(draft, "reserve", "dulcera", 20, freshCombat()));
    const result = playCard(ready, leap);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]).toMatchObject({ id: "reserve", combat: { thorns: 4 } });
    expect(result.state.reserves[0]!.species).toBe("cavalleaf");
    expect(previewCard(ready, cardId(ready, leap))).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("rejects play without a living backup and retains state and RNG", () => {
    const ready = battle();
    const rejected = playCard(ready, leap);
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(ready);
    expect(rejected.reason).toBe("There are no living backups.");
    produce(ready, (draft) => {
      const before = draft.team.map((unit) => unit.id);
      const rng = draft.rng;
      executeAbility(draft, { side: "player", actor: draft.team[0]!, def: definition(leap), value: 4 }, []);
      expect(draft.team.map((unit) => unit.id)).toEqual(before);
      expect(draft.team.map((unit) => unit.combat!.thorns)).toEqual([0, 0, 0]);
      expect(draft.rng).toEqual(rng);
    });
  });
});

import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { accept, authoredPack, prepareDestination, teamRun, victoryReady } from "../../../support/game";
import { setBattleCards } from "../../../support/cards";
import { CARDS, definition, species } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { freshCombat, hit, removeEffects } from "../../../../src/game/combat";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { validateCatalog } from "../../../../src/game/content-validation";
import { rankedBattleChoices } from "../../../../src/application/battle-policy";

describe("Ravelland", () => {
  it("keeps the authored catalog valid at startup", () => {
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });
  it("offers playable choices to Auto-play", () => {
    const state = teamRun(42, ["ravelland"]);
    const choices = rankedBattleChoices(state, false);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((choice) => dispatch(state, choice.command).accepted)).toBe(true);
  });
  it("has a solo six-card kit whose previews and saves match committed plays", () => {
    expect(
      CARDS.filter((card) => card.species === "ravelland").map((card) => [card.cost, cardText(card)]),
    ).toEqual([
      [1, "Deal 8 Physical damage"],
      [1, "Deal 3 Physical damage to all enemies"],
      [1, "Gain 6 Block"],
    ]);
    for (const id of ["ravelland-antler-pass", "ravelland-canyon-rebuke", "ravelland-rainward"]) {
      const state = produce(teamRun(42, ["ravelland"]), (draft) => {
        const card = draft.cards.find((entry) => entry.definitionId === id)!;
        setBattleCards(draft, [card.id]);
        for (const enemy of draft.battle!.enemies) enemy.combat = freshCombat();
      });
      expect(state.cards).toHaveLength(6);
      const cardId = state.battle!.hand[0]!;
      const target = id === "ravelland-antler-pass" ? state.battle!.enemies[0]!.id : undefined;
      const result = dispatch(state, { type: "play", cardId, targetId: target, autoEndTurn: false });
      expect(result.accepted).toBe(true);
      expect(previewCard(state, cardId, target)).toEqual(result);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    }
  });

  it.each([1, 2, 3, 4, 5, 6])("gains tier %i Armor after damage breaks Block", (tier) => {
    produce(teamRun(42, ["ravelland"]), (draft) => {
      draft.discovery.recruited.ravelland = tier;
      const target = draft.team[0]!;
      const attacker = draft.battle!.enemies[0]!;
      target.block = 4;
      const events: import("../../../../src/game/types").GameEvent[] = [];
      hit(draft, attacker, target, 6, "physical", events);
      expect(target.health).toBe(species("ravelland").health - 2);
      expect(target.block).toBe(0);
      expect(target.combat!.armor).toBe(tier);
      expect(events.findIndex((event) => event.kind === "damage")).toBeLessThan(
        events.findIndex((event) => event.kind === "status" && event.status === "armor"),
      );
    });
  });

  it("does not grant Armor for partial Block, Purge, or a knockout", () => {
    for (const mode of ["partial", "purge", "knockout"] as const) {
      produce(teamRun(42, ["ravelland"]), (draft) => {
        const target = draft.team[0]!;
        const attacker = draft.battle!.enemies[0]!;
        target.block = 4;
        if (mode === "purge") removeEffects(target, "purge", 1, [], draft);
        else {
          if (mode === "knockout") {
            target.health = 1;
            target.combat!.deathDoorUsed = true;
          }
          hit(draft, attacker, target, mode === "partial" ? 2 : 6, "physical", []);
        }
        expect(target.combat!.armor).toBe(0);
      });
    }
  });

  it("uses the base tier for enemy Ravelland", () => {
    produce(teamRun(42, ["mossguard"]), (draft) => {
      draft.discovery.recruited.ravelland = 6;
      const enemy = draft.battle!.enemies[0]!;
      enemy.species = "ravelland";
      enemy.block = 4;
      enemy.combat = freshCombat();
      hit(draft, draft.team[0]!, enemy, 4, "water", []);
      expect(enemy.combat.armor).toBe(1);
    });
  });

  it("starts the final boss alone with its own deck and offers it after victory", () => {
    let state = produce(teamRun(42, ["mossguard"]), (draft) => {
      prepareDestination(draft);
      draft.encounter = 7;
      draft.journey!.victories = 7;
      draft.expedition = { pack: authoredPack(7), recruit: null, lastRoom: "boss" };
    });
    state = accept(state, { type: "beginBattle" });
    const enemy = state.battle!.enemies[0]!;
    expect(state.battle!.enemies).toHaveLength(1);
    expect(enemy.species).toBe("ravelland");
    expect([
      ...enemy.deck!.hand,
      ...enemy.deck!.draw,
      ...enemy.deck!.discard,
      ...enemy.deck!.buffer,
    ]).toHaveLength(6);
    expect(decodeSave(encodeSave(state))).toEqual(state);
    const turn = dispatch(state, { type: "endTurn" });
    expect(turn.accepted).toBe(true);
    expect(turn.events.some((event) => event.kind === "damage" && event.actorId === enemy.id)).toBe(true);
    state = victoryReady(state);
    const card = state.cards.find((entry) => entry.id === state.battle!.hand[0])!;
    expect(definition(card.definitionId).effect).toBe("attack");
    state = accept(state, { type: "play", cardId: card.id, targetId: enemy.id });
    expect(state.reward!.recruits).toEqual(["ravelland"]);
    state = accept(state, { type: "recruit", species: "ravelland" });
    expect(state.discovery.recruited.ravelland).toBe(1);
  });
});

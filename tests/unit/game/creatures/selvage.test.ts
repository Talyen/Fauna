import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { definition, speciesCards } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { playTargeting } from "../../../../src/game/mending";
import { previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { availablePlays, chosenRecipients } from "../../../../src/game/play-queries";
import { freshCombat } from "../../../../src/game/combat/index";
import { battleChoices } from "../../../../src/application/battle-policy";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { observeDecisions } from "../../../../src/game/random";
import { dispatch } from "../../../../src/game/engine";
import { chooseEnemyCard } from "../../../../src/game/combat/enemy-policy";
import { enemyCard } from "../../../../src/game/card-rules";
import { addReserve, enemyPlay, requireBattle, teamRun } from "../../../support/game";
import { cardId, playCard, setHand } from "../../../support/cards";

const song = "selvage-mending-song";
function battle() {
  return produce(requireBattle(teamRun(42, ["selvage", "emberback", "prismram"])), (draft) => {
    draft.team[1]!.health = 10;
    addReserve(draft, "fallen", "mossguard", 0, freshCombat());
    setHand(draft, [song, "selvage-gust-wing", "selvage-nest-ward"]);
  });
}

describe("Selvage", () => {
  it("authors the selected one-Mana abilities", () => {
    expect(speciesCards("selvage").map((card) => [card.cost, cardText(card)])).toEqual([
      [1, "Deal 2 Physical damage to all enemies"],
      [1, "Give all allies 2 Block"],
      [1, "Restore 6 Health to the most injured ally"],
    ]);
  });

  it.each([2, 3, 4, 5, 6, 7])("revives a chosen fallen backup with up to %i Health", (amount) => {
    const game = produce(battle(), (draft) => {
      draft.discovery.recruited.selvage = amount - 1;
      draft.cards.find((card) => card.definitionId === song)!.level = 1;
      draft.reserves[0]!.combat!.deathDoorUsed = true;
    });
    const before = encodeSave(game);
    const result = playCard(game, song, "fallen");
    expect(result.accepted).toBe(true);
    expect(result.state.reserves[0]!.health).toBe(amount);
    expect(result.state.reserves[0]!.combat!.deathDoorUsed).toBe(true);
    expect(result.state.battle!.mana).toBe(game.battle.mana - 1);
    expect(previewCard(game, cardId(game, song), "fallen")).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(encodeSave(game)).toBe(before);
  });

  it("offers the most injured living ally or a fallen ally and rejects other choices", () => {
    const game = battle();
    expect(playTargeting(definition(song), game)).toBe("ally");
    expect(chosenRecipients(game, definition(song)).map((unit) => unit.id)).toEqual(["ally-1", "fallen"]);
    expect(
      availablePlays(game)
        .find((play) => play.def.id === song)!
        .commands.map((c) => c.targetId),
    ).toEqual(["ally-1", "fallen"]);
    expect(
      battleChoices(game, false).some((choice) => choice.type === "play" && choice.targetId === "fallen"),
    ).toBe(true);
    for (const target of [undefined, "ally-0", "missing"]) {
      const rejected = playCard(game, song, target);
      expect(rejected.accepted).toBe(false);
      expect(rejected.state).toBe(game);
    }
    expect(playCard(game, song, "ally-1").state.team[1]!.health).toBe(16);
  });

  it("uses the normal automatic heal when nobody has fallen", () => {
    const game = produce(battle(), (draft) => {
      draft.reserves[0]!.health = 15;
    });
    expect(playTargeting(definition(song), game)).toBe("automatic");
    const result = playCard(game, song);
    expect(result.accepted).toBe(true);
    expect(result.state.team[1]!.health).toBe(16);
  });

  it("caps revival at the ability's healing value and applies resurrection Boons", () => {
    const game = produce(battle(), (draft) => {
      draft.discovery.recruited.selvage = 6;
      draft.boons.push("memory-cairn", "remembrance-wreath");
      draft.reserves[0]!.combat!.poison = 3;
    });
    const result = playCard(game, song, "fallen");
    expect(result.state.reserves[0]!.health).toBe(6);
    expect(result.state.reserves[0]!.combat!.poison).toBe(0);
    expect(result.state.reserves[0]!.combat!.negate).toBe(true);
  });

  it("keeps Wendlet's borrowed song automatic after Selvage joins the team", () => {
    const game = produce(requireBattle(teamRun(42, ["wendlet", "emberback", "prismram"])), (draft) => {
      addReserve(draft, "selvage-backup", "selvage", 20, freshCombat());
      observeDecisions(draft, () => 0.9);
      executeAbility(
        draft,
        {
          side: "player",
          actor: draft.team[0]!,
          def: definition("wendlet-borrowed-silhouette"),
          value: 1,
        },
        [],
      );
      const copy = draft.cards.find((card) => card.borrowedFrom === "selvage")!;
      expect(copy.definitionId).toBe(song);
      const singer = draft.reserves.pop()!;
      const fallen = draft.team.pop()!;
      fallen.health = 0;
      draft.reserves.push(fallen);
      draft.team.push(singer);
      draft.team[1]!.health = 10;
      draft.battle.hand = [copy.id];
    });
    const copy = game.cards.find((card) => card.borrowedFrom === "selvage")!;
    const play = availablePlays(game).find((entry) => entry.card.id === copy.id)!;
    expect(play.actor.species).toBe("wendlet");
    expect(play.commands.map((command) => command.targetId)).toEqual([undefined]);
    const result = dispatch(game, { type: "play", cardId: copy.id, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.reserves[0]!.health).toBe(0);
    expect(result.state.team[1]!.health).toBe(16);
    expect(previewCard(game, copy.id)).toEqual(result);
  });

  it("lets enemy Selvage choose a fallen ally at the base tier", () => {
    const game = produce(battle(), (draft) => {
      const [singer, fallen] = draft.battle.enemies;
      singer!.species = "selvage";
      singer!.health = singer!.maxHealth;
      fallen!.health = 0;
      if (draft.battle.enemies[2]) draft.battle.enemies[2]!.health = draft.battle.enemies[2]!.maxHealth;
    });
    const singer = game.battle.enemies[0]!;
    const fallen = game.battle.enemies[1]!;
    expect(chooseEnemyCard(game, singer, [enemyCard(definition(song))])?.allyTargetId).toBe(fallen.id);
    expect(enemyPlay(game, song, { allyTargetId: fallen.id }).state.battle!.enemies[1]!.health).toBe(2);
  });
});

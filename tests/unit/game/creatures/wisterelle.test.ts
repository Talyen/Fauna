import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { definition, FIRST_RUN_STARTERS, speciesCards } from "../../../../src/game/content";
import { cardText, enemyCard, enemyCanUse } from "../../../../src/game/card-rules";
import { createGame, dispatch, previewCard } from "../../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { drawAtTurnStart, drawDiscard, receiveCard } from "../../../../src/game/card-zones";
import { availablePlays, chosenRecipients } from "../../../../src/game/play-queries";
import { battleChoices } from "../../../../src/application/battle-policy";
import { freshCombat } from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { COMBAT_PACKS } from "../../../../src/game/encounters";
import { accept, requireBattle, teamRun, winBattle } from "../../../support/game";
import { wisterelleBattle } from "../../../support/wisterelle";
import { setBattleCards } from "../../../support/cards";
import type { BattleState, GameEvent } from "../../../../src/game/types";

const junction = "wisterelle-forgotten-junction";
const lantern = "wisterelle-lantern-fare";
const luggage = "wisterelle-left-luggage";
const cardId = (game: BattleState, def: string) => game.cards.find((card) => card.definitionId === def)!.id;
const play = (game: BattleState, def: string, targetId?: string) =>
  dispatch(game, {
    type: "play",
    cardId: cardId(game, def),
    targetId,
    autoEndTurn: false,
  });

describe("Wisterelle", () => {
  it.each([1, 2, 3, 4, 5, 6])(
    "heals the recovered card's owner by %i with preview and resume parity",
    (amount) => {
      const game = produce(wisterelleBattle(), (draft) => {
        draft.discovery.recruited.wisterelle = amount;
      });
      const before = encodeSave(game);
      const result = play(game, luggage);
      expect(result.accepted).toBe(true);
      expect(result.state.team[1]!.health).toBe(12 + amount);
      expect(result.state.team[0]!.health).toBe(12);
      expect(result.state.battle!.mana).toBe(game.battle.mana);
      expect(result.state.battle!.hand).toContain(game.battle.discard[0]);
      expect(previewCard(game, cardId(game, luggage))).toEqual(result);
      expect(play(requireBattle(decodeSave(before)), luggage)).toEqual(result);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
      expect(encodeSave(game)).toBe(before);
    },
  );

  it("rejects Left Luggage with no other living owner's discarded card", () => {
    const game = produce(wisterelleBattle(), (draft) => {
      const own = draft.cards.find((card) => card.definitionId === lantern)!;
      draft.battle.draw.push(...draft.battle.discard.splice(0));
      draft.battle.hand = draft.battle.hand.filter((id) => id !== own.id);
      draft.battle.discard = [own.id];
    });
    const result = play(game, luggage);
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(game);
    expect(availablePlays(game).some((entry) => entry.def.id === luggage)).toBe(false);
    const after = requireBattle(play(wisterelleBattle(), luggage).state);
    const moved = produce(after, (draft) => {
      const id = cardId(draft, luggage);
      draft.battle.discard = draft.battle.discard.filter((other) => other !== id);
      draft.battle.hand.push(id);
    });
    expect(play(moved, luggage).accepted).toBe(false);
    const fallen = produce(wisterelleBattle(), (draft) => {
      draft.team[1]!.health = 0;
    });
    expect(play(fallen, luggage).accepted).toBe(false);
  });

  it("uses the chosen backup, then draws after replacing the outgoing kit", () => {
    const game = wisterelleBattle();
    expect(chosenRecipients(game, definition(junction)).map((unit) => unit.id)).toEqual([
      "backup-mossguard",
      "backup-coralcurl",
    ]);
    expect(
      availablePlays(game)
        .find((entry) => entry.def.id === junction)!
        .commands.map((command) => command.targetId),
    ).toEqual(["backup-mossguard", "backup-coralcurl"]);
    const result = play(game, junction, "backup-coralcurl");
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.id).toBe("backup-coralcurl");
    expect(result.state.reserves.some((unit) => unit.id === "ally-0")).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(result.state.battle!.hand).toHaveLength(game.battle.hand.length - 3 + 1);
    expect(
      result.events.filter((event) => event.kind === "action" && event.actionType === "swap"),
    ).toHaveLength(1);
    expect(previewCard(game, cardId(game, junction), "backup-coralcurl")).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("rejects missing, deployed and fallen backup targets without consuming state or RNG", () => {
    const game = produce(wisterelleBattle(), (draft) => {
      draft.reserves[0]!.health = 0;
    });
    for (const target of [undefined, "ally-1", "backup-mossguard", "missing"]) {
      const result = play(game, junction, target);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(game);
    }
    const unavailable = produce(game, (draft) => {
      draft.reserves[1]!.health = 0;
    });
    expect(availablePlays(unavailable).some((entry) => entry.def.id === junction)).toBe(false);
    expect(play(unavailable, junction, "backup-coralcurl").accepted).toBe(false);
  });

  it("repeats the draw without exchanging an actor that already left the formation", () => {
    const game = produce(wisterelleBattle(), (draft) => {
      draft.battle.repeatNext.player = true;
    });
    const result = play(game, junction, "backup-coralcurl");
    expect(result.accepted).toBe(true);
    expect(
      result.events.filter((event) => event.kind === "action" && event.actionType === "swap"),
    ).toHaveLength(1);
    expect(result.state.team[0]!.id).toBe("backup-coralcurl");
    expect(result.state.battle!.hand).toHaveLength(game.battle.hand.length - 3 + 2);
    expect(result.state.battle!.repeatNext.player).toBe(false);
  });

  it("heals the chosen injured ally, upgrades Health and refunds one Mana", () => {
    const game = produce(wisterelleBattle(), (draft) => {
      draft.cards.find((card) => card.definitionId === lantern)!.level = 2;
      draft.battle.mana = 1;
    });
    const result = play(game, lantern, "ally-1");
    expect(result.accepted).toBe(true);
    expect(result.state.team[1]!.health).toBe(19);
    expect(result.state.team[0]!.health).toBe(12);
    expect(result.state.battle!.mana).toBe(1);
    expect(result.state.phase).toBe("battle");
    expect(previewCard(game, cardId(game, lantern), "ally-1")).toEqual(result);
    const full = produce(game, (draft) => {
      draft.team[1]!.health = 30;
    });
    expect(play(full, lantern, "ally-1").accepted).toBe(false);
    expect(play(game, lantern).accepted).toBe(false);
  });

  it("keeps normal drawing, reshuffling and buffer promotion separate from Discard draws", () => {
    const game = wisterelleBattle();
    const events: GameEvent[] = [];
    const result = produce(game, (draft) => {
      draft.battle.draw = [];
      draft.battle.discard = draft.cards
        .filter((card) => !draft.battle.hand.includes(card.id))
        .map((card) => card.id);
      expect(drawAtTurnStart(draft, 3, events)).toBeGreaterThan(0);
    });
    expect(result.team.map((unit) => unit.health)).toEqual(game.team.map((unit) => unit.health));
    expect(events.some((event) => event.kind === "heal")).toBe(false);
  });

  it("heals once for the original Discard draw when Well Read also copies it", () => {
    const events: GameEvent[] = [];
    const game = produce(requireBattle(teamRun(42, ["wisterelle", "rookhaven", "emberback"])), (draft) => {
      draft.discovery.recruited.rookhaven = 6;
      draft.team[2]!.health = 10;
      const recovered = draft.cards.find((card) => card.definitionId === "emberback-attack")!;
      setBattleCards(draft, [], [recovered.id]);
      drawDiscard(draft, events);
    });
    expect(game.team[2]!.health).toBe(11);
    expect(events.filter((event) => event.kind === "heal")).toHaveLength(1);
    expect(game.battle.hand).toHaveLength(2);
  });

  it("uses ordinary healing modifiers without card-only overhealing", () => {
    const events: GameEvent[] = [];
    const game = produce(requireBattle(teamRun(42, ["wisterelle", "reedstag", "emberback"])), (draft) => {
      draft.discovery.recruited.wisterelle = 3;
      draft.talents.push("health.mending", "health.overflow");
      draft.boons.push("groves-favor");
      draft.team[2]!.health = 27;
      const id = cardId(draft, "emberback-attack");
      setBattleCards(draft, [], [id]);
      drawDiscard(draft, events);
    });
    expect(game.team[2]!.health).toBe(30);
    expect(game.team[2]!.block).toBe(0);
    expect(game.team[2]!.combat!.thorns).toBe(1);
  });

  it("does not revive a fallen owner or trigger from an ordinary returned card", () => {
    const events: GameEvent[] = [];
    const game = produce(wisterelleBattle(), (draft) => {
      draft.team[1]!.health = 0;
      expect(drawDiscard(draft, events)).toBeUndefined();
      const id = draft.battle.discard.pop()!;
      receiveCard(draft, id);
    });
    expect(game.team[1]!.health).toBe(0);
    expect(events.some((event) => event.kind === "heal")).toBe(false);
  });

  it("supports enemy healing without inventing enemy backups or discarded cards", () => {
    const game = wisterelleBattle();
    const events: GameEvent[] = [];
    const result = produce(game, (draft) => {
      const actor = draft.battle.enemies[0]!;
      actor.species = "wisterelle";
      actor.health = 10;
      actor.combat = freshCombat();
      executeAbility(
        draft,
        { side: "enemy", actor, def: enemyCard(definition(lantern)), value: 3, allyTargetId: actor.id },
        events,
      );
    });
    expect(result.battle.enemies[0]!.health).toBe(13);
    expect(result.battle.mana).toBe(game.battle.mana);
    expect(enemyCanUse(definition(junction))).toBe(false);
    expect(enemyCanUse(definition(luggage))).toBe(false);
    expect(enemyCanUse(definition(lantern))).toBe(true);
  });

  it("registers a recruitable support kit, exact rules and legal Auto-play targets", () => {
    const game = wisterelleBattle();
    expect(FIRST_RUN_STARTERS).not.toContain("wisterelle");
    expect(COMBAT_PACKS.some((pack) => pack.some((kind) => kind === "wisterelle"))).toBe(true);
    expect(speciesCards("wisterelle").map((card) => card.cost)).toEqual([1, 1, 1]);
    expect(cardText(definition(luggage))).toBe("Draw an ally’s card from your Discard pile / Gain 1 Mana");
    expect(cardText(definition(junction))).toBe("Swap out for a chosen backup / Draw a Card");
    expect(cardText(definition(lantern))).toBe("Restore 3 Health to an injured ally / Gain 1 Mana");
    expect(cardText(definition(lantern), 2)).toBe("Restore 7 Health to an injured ally / Gain 1 Mana");
    expect(
      battleChoices(game)
        .filter((command) => command.type === "play" && command.cardId === cardId(game, junction))
        .every(
          (command) => command.type === "play" && game.reserves.some((unit) => unit.id === command.targetId),
        ),
    ).toBe(true);
  });
});

describe("one individual per species on the roster", () => {
  it.each([1, 2, 3])("drafts %i distinct collected ordinary species without repeating offers", (count) => {
    const kinds = ["mossguard", "emberback", "prismram"] as const;
    const initial = produce(createGame(42), (draft) => {
      draft.discovery.encountered = kinds.slice(0, count);
      draft.discovery.recruited = Object.fromEntries(kinds.slice(0, count).map((kind) => [kind, 1]));
    });
    let game = accept(initial, { type: "newRun", seed: 9 });
    for (let pick = 0; pick < count; pick++) {
      expect(new Set(game.starterOffers).size).toBe(game.starterOffers.length);
      expect(game.starterOffers.some((kind) => game.selected.includes(kind))).toBe(false);
      const selected = game.starterOffers[0]!;
      game = accept(game, { type: "draft", species: selected });
      expect(dispatch(game, { type: "draft", species: selected }).state).toBe(game);
      expect(decodeSave(encodeSave(game))).toEqual(game);
    }
    game = accept(game, { type: "start" });
    expect(game.team).toHaveLength(count);
    expect(new Set(game.team.map((unit) => unit.species)).size).toBe(count);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });

  it("rejects duplicate species across deployed and backup slots and duplicate remembered picks", () => {
    const game = wisterelleBattle();
    const duplicate = produce(game, (draft) => {
      draft.reserves[0]!.species = "wisterelle";
    });
    expect(() => decodeSave(encodeSave(duplicate))).toThrow();
    const picks = produce(game, (draft) => {
      draft.selected = ["wisterelle", "wisterelle"];
    });
    expect(() => decodeSave(encodeSave(picks))).toThrow();
  });

  it("repeat recruitment banks rank without refreshing, replacing or duplicating a full roster", () => {
    const reward = winBattle(wisterelleBattle());
    const result = dispatch(reward, { type: "recruit", species: "emberback" });
    expect(result.accepted).toBe(true);
    expect(result.state.phase).toBe("teamSelection");
    expect(result.state.team).toEqual(reward.team);
    expect(result.state.reserves).toEqual(reward.reserves);
    expect(result.state.cards).toEqual(reward.cards);
    expect(result.state.discovery.recruited.emberback).toBe(2);
    expect(new Set([...result.state.team, ...result.state.reserves].map((unit) => unit.species)).size).toBe(
      5,
    );
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(dispatch(result.state, { type: "confirmRecruit", replace: "ally-0" }).state).toBe(result.state);
  });
});

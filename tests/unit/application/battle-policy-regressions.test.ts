import { produce } from "immer";
import { expect, it } from "vitest";
import { chooseBattleCommand, rankedBattleChoices } from "../../../src/application/battle-policy";
import { createBattleActor } from "../../../src/application/battle-actor";
import { dispatch } from "../../../src/game/engine";
import { summonEcho } from "../../../src/game/combat/legendary";
import { freshCombat } from "../../../src/game/combat/index";
import { species } from "../../../src/game/content";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameState } from "../../../src/game/types";
import { accept, authoredPack, prepareDestination, requireBattle, teamRun } from "../../support/game";

function withHand(state: GameState, definitions: string[]) {
  return produce(state, (game) => {
    game.battle!.hand = definitions.map((id) => game.cards.find((card) => card.definitionId === id)!.id);
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards
      .filter((card) => !game.battle!.hand.includes(card.id))
      .map((card) => card.id);
  });
}

it("Auto-play preserves Traveler's Ward while its attack reflection is still active", () => {
  const state = produce(withHand(teamRun(42, ["oathara"]), ["oathara-travelers-ward"]), (game) => {
    game.team[0]!.combat!.attackReflection = true;
  });
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(chooseBattleCommand(state, false)).toEqual({ type: "endTurn" });

  const unprotected = produce(state, (game) => {
    game.team[0]!.combat!.attackReflection = false;
  });
  const command = chooseBattleCommand(unprotected, false);
  expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  expect(dispatch(unprotected, command).state.team[0]!.combat!.attackReflection).toBe(true);
});

it.each([
  ["tournelle", "tournelle-teamClearBlind", "blind", "tournelle-attack"],
  ["stillara", "stillara-thaw-path", "freeze", "stillara-reed-reservoir"],
] as const)(
  "Auto-play saves %s's Cleanse unless removal or its draw is useful",
  (kind, id, status, drawn) => {
    const state = produce(teamRun(42, [kind]), (game) => {
      game.battle!.hand = game.cards.map((card) => card.id);
      game.battle!.draw = [];
      game.battle!.buffer = [];
      game.battle!.discard = [];
    });
    const cleanse = state.cards.find((card) => card.definitionId === id)!;
    const choice = (game: GameState) =>
      rankedBattleChoices(game, false).find(
        (entry) => entry.command.type === "play" && entry.command.cardId === cleanse.id,
      );
    expect(decodeSave(encodeSave(state))).toEqual(state);
    expect(choice(state)).toBeUndefined();

    const afflicted = produce(state, (game) => {
      if (status === "blind") game.team[0]!.combat!.blind = true;
      else game.team[0]!.combat!.freeze = 2;
    });
    const cleansing = choice(afflicted)!;
    expect(cleansing).toBeDefined();
    expect(Number(dispatch(afflicted, cleansing.command).state.team[0]!.combat![status])).toBe(0);

    const drawable = produce(state, (game) => {
      const card = game.cards.find((card) => card.definitionId === drawn)!;
      game.battle!.hand = game.battle!.hand.filter((id) => id !== card.id);
      game.battle!.draw = [card.id];
    });
    const drawing = choice(drawable)!;
    expect(drawing).toBeDefined();
    expect(dispatch(drawable, drawing.command).state.battle!.hand).toContain(drawable.battle!.draw[0]);
  },
);

it("Auto-play preserves Dawn Cry's Mana when it would only redraw itself", () => {
  const state = produce(teamRun(42, ["dawncall"]), (game) => {
    game.battle!.hand = game.cards.map((card) => card.id);
    game.battle!.draw = [];
    game.battle!.buffer = [];
    game.battle!.discard = [];
  });
  expect(decodeSave(encodeSave(state))).toEqual(state);
  const cleanse = state.cards.find((card) => card.definitionId === "dawncall-teamCleanse")!;
  const choice = (game: GameState) =>
    rankedBattleChoices(game, false).find(
      (entry) => entry.command.type === "play" && entry.command.cardId === cleanse.id,
    );
  expect(choice(state)).toBeUndefined();

  const afflicted = produce(state, (game) => {
    game.team[0]!.combat!.poison = 8;
  });
  const cleansing = choice(afflicted)!;
  expect(cleansing).toBeDefined();
  expect(dispatch(afflicted, cleansing.command).state.team[0]!.combat!.poison).toBe(0);

  const drawable = produce(state, (game) => {
    const other = game.battle!.hand.find((id) => id !== cleanse.id)!;
    game.battle!.hand = game.battle!.hand.filter((id) => id !== other);
    game.battle!.draw = [other];
  });
  const drawing = choice(drawable)!;
  expect(drawing).toBeDefined();
  expect(dispatch(drawable, drawing.command).state.battle!.hand).toContain(drawable.battle!.draw[0]);
});

it("Auto-play uses Petal Veil to Blind enemy Echoes after their summoner is already Blind", () => {
  const destination = produce(teamRun(42, ["bloomquail"]), (game) => {
    prepareDestination(game);
    game.encounter = 3;
    game.journey!.victories = 3;
    game.expedition = { pack: authoredPack(3), recruit: null, lastRoom: "boss" };
  });
  const state = produce(
    withHand(accept(destination, { type: "beginBattle" }), ["bloomquail-heal"]),
    (game) => {
      const boss = game.battle!.enemies[0]!;
      boss.combat.blind = true;
      summonEcho(requireBattle(game), boss, "enemy", 6, []);
    },
  );
  expect(decodeSave(encodeSave(state))).toEqual(state);
  const command = chooseBattleCommand(state, false);
  expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.minions![0]!.combat.blind).toBe(true);
  expect(result.state.team[0]!.health).toBe(state.team[0]!.health);
  expect(chooseBattleCommand(withHand(result.state, ["bloomquail-heal"]), false)).toEqual({
    type: "endTurn",
  });
});

it("Auto-play preserves Dream Double when both Thorns and Negate are already full", () => {
  const state = produce(withHand(teamRun(42, ["reverie"]), ["reverie-dream-double"]), (game) => {
    game.team[0]!.combat!.thorns = 1_000_000;
    game.team[0]!.combat!.negate = true;
  });
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(chooseBattleCommand(state, false)).toEqual({ type: "endTurn" });
  for (const missing of ["thorns", "negate"] as const) {
    const useful = produce(state, (game) => {
      if (missing === "thorns") game.team[0]!.combat!.thorns--;
      else game.team[0]!.combat!.negate = false;
    });
    const command = chooseBattleCommand(useful, false);
    expect(command).toMatchObject({ type: "play", cardId: useful.battle!.hand[0] });
    const result = dispatch(useful, command);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.combat).toMatchObject({ thorns: 1_000_000, negate: true });
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  }
});

it("Auto-play Purges a protected enemy Echo when its summoner has no removable effects", () => {
  const destination = produce(teamRun(42, ["rookhaven"]), (game) => {
    prepareDestination(game);
    game.encounter = 3;
    game.journey!.victories = 3;
    game.expedition = { pack: authoredPack(3), recruit: null, lastRoom: "boss" };
  });
  const state = produce(
    withHand(requireBattle(accept(destination, { type: "beginBattle" })), ["rookhaven-unwritten-ending"]),
    (game) => {
      const boss = game.battle!.enemies[0]!;
      boss.block = 0;
      boss.combat = freshCombat();
      summonEcho(requireBattle(game), boss, "enemy", 6, []);
      game.battle!.minions![0]!.block = 10;
    },
  );
  const command = chooseBattleCommand(state, false);
  expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.minions![0]!.block).toBe(0);
});

it.each([
  ["reedstag", "reedstag-guard", "thorns"],
  ["prismram", "prismram-guard", "reflect"],
  ["shadebrim", "shadebrim-guard", "reflectBurn"],
] as const)("Auto-play retains %s's secondary protection at the Block cap", (kind, definition, status) => {
  const state = produce(withHand(teamRun(42, [kind]), [definition]), (game) => {
    game.team[0]!.block = 1_000_000;
  });
  const command = chooseBattleCommand(state, false);
  expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  expect(Number(result.state.team[0]!.combat![status])).toBeGreaterThan(0);
  const spent = produce(result.state, (game) => {
    if (status === "thorns") game.team[0]!.combat!.thorns = 1_000_000;
    game.battle!.hand = state.battle!.hand;
    game.battle!.discard = [];
  });
  expect(chooseBattleCommand(spent, false)).toEqual({ type: "endTurn" });
});

it("Auto-play saves Reed Reservoir until it can increase Mana or heal through Arcane Mending", () => {
  const state = withHand(teamRun(42, ["stillara"]), ["stillara-reed-reservoir"]);
  expect(chooseBattleCommand(state, false)).toEqual({ type: "endTurn" });
  const depleted = produce(state, (game) => {
    game.battle!.mana = 2;
  });
  const command = chooseBattleCommand(depleted, false);
  expect(command.type).toBe("play");
  expect(dispatch(depleted, command).state.battle!.mana).toBe(3);
  const injured = produce(state, (game) => {
    game.talents = ["mana.arcane-mending"];
    game.team[0]!.health--;
  });
  const healing = chooseBattleCommand(injured, false);
  expect(healing.type).toBe("play");
  expect(dispatch(injured, healing).state.team[0]!.health).toBe(species("stillara").health);
  const chorus = produce(
    withHand(teamRun(42, ["stillara", "cadenza"]), ["stillara-reed-reservoir"]),
    (game) => {
      game.battle!.cardsPlayedThisTurn = 1;
      game.team[0]!.health--;
    },
  );
  const singing = chooseBattleCommand(chorus, false);
  expect(singing.type).toBe("play");
  expect(dispatch(chorus, singing).state.team[0]!.health).toBe(species("stillara").health);
});

it.each(["chorus", "chimes"])("Auto-play retains capped Dodge when it can heal through %s", (trigger) => {
  const state = produce(teamRun(42, ["cadenza"]), (game) => {
    game.battle!.hand = game.cards.map((card) => card.id);
    game.battle!.draw = [];
    game.battle!.discard = [];
    game.battle!.buffer = [];
    game.battle!.cardsPlayedThisTurn = trigger === "chorus" ? 1 : 2;
    game.team[0]!.combat!.temporaryDodge = 70;
    game.team[0]!.health--;
    if (trigger === "chimes") {
      game.boons = ["resonant-chimes"];
      game.talents = ["mana.arcane-mending"];
    }
  });
  const dodge = state.cards.find((card) => card.definitionId === "cadenza-rousing-refrain")!;
  const choice = rankedBattleChoices(state, false).find(
    (entry) => entry.command.type === "play" && entry.command.cardId === dodge.id,
  )!;
  expect(choice).toBeDefined();
  expect(dispatch(state, choice.command).state.team[0]!.health).toBe(species("cadenza").health);
});

it.each(["dunefox", "glintstride", "cadenza"] as const)(
  "Auto-play does not spend Mana on %s's capped Dodge just to redraw the same card",
  (kind) => {
    const state = produce(teamRun(42, [kind]), (game) => {
      game.battle!.hand = game.cards.map((card) => card.id);
      game.battle!.draw = [];
      game.battle!.discard = [];
      game.battle!.buffer = [];
      game.team[0]!.combat!.temporaryDodge = 70;
    });
    const dodge = state.cards.find(
      (card) => card.definitionId === `${kind}-${kind === "cadenza" ? "rousing-refrain" : "dodge"}`,
    )!;
    expect(
      rankedBattleChoices(state, false).some(
        (choice) => choice.command.type === "play" && choice.command.cardId === dodge.id,
      ),
    ).toBe(false);
    const useful = produce(state, (game) => {
      game.team[0]!.combat!.temporaryDodge--;
    });
    const choice = rankedBattleChoices(useful, false).find(
      (entry) => entry.command.type === "play" && entry.command.cardId === dodge.id,
    )!;
    expect(choice).toBeDefined();
    expect(dispatch(useful, choice.command).state.team[0]!.combat!.temporaryDodge).toBe(70);
    const drawable = produce(state, (game) => {
      game.battle!.draw.push(game.battle!.hand.shift()!);
    });
    expect(
      rankedBattleChoices(drawable, false).some(
        (entry) => entry.command.type === "play" && entry.command.cardId === dodge.id,
      ),
    ).toBe(true);
    const buffered = produce(state, (game) => {
      for (let serial = 0; serial < 4; serial++) {
        const copy = { ...game.cards[0]!, id: `copy-${serial}`, temporary: true as const };
        game.cards.push(copy);
        (serial < 3 ? game.battle!.hand : game.battle!.buffer).push(copy.id);
      }
      game.battle!.copySerial = 4;
    });
    expect(decodeSave(encodeSave(buffered))).toEqual(buffered);
    const overflow = rankedBattleChoices(buffered, false).find(
      (entry) => entry.command.type === "play" && entry.command.cardId === dodge.id,
    )!;
    expect(overflow).toBeDefined();
    expect(dispatch(buffered, overflow.command).state.battle!.hand).toContain("copy-3");
  },
);

it("cycle detection distinguishes the visible discarded card available to Echoes Remember", () => {
  const state = produce(
    withHand(teamRun(42, ["cadenza", "mossguard"]), ["cadenza-echoes-remember"]),
    (game) => {
      const discarded = game.cards.find((card) => card.definitionId === "cadenza-rousing-refrain")!.id;
      game.battle!.draw = game.battle!.draw.filter((id) => id !== discarded);
      game.battle!.discard = [discarded];
    },
  );
  const actor = createBattleActor();
  expect(decodeSave(encodeSave(state))).toEqual(state);
  const first = actor.choose(state, false);
  expect(first.command.type).toBe("play");
  const changed = produce(state, (game) => {
    const attack = game.cards.find((card) => card.definitionId === "mossguard-attack")!.id;
    const previous = game.battle!.discard[0]!;
    game.battle!.draw = game.battle!.draw.map((id) => (id === attack ? previous : id));
    game.battle!.discard = [attack];
    game.revision++;
  });
  expect(decodeSave(encodeSave(changed))).toEqual(changed);
  expect(actor.choose(changed, false).command).toEqual(first.command);
  const hiddenOrderOnly = produce(state, (game) => {
    game.battle!.draw.reverse();
    game.revision++;
  });
  const unchanged = createBattleActor();
  unchanged.choose(state, false);
  expect(unchanged.choose(hiddenOrderOnly, false).command).toEqual({ type: "endTurn" });
});

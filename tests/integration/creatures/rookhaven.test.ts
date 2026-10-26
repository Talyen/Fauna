import {
  addReserve,
  authoredPack,
  swapFixture,
  prepareDestination,
  requireBattle,
  accept,
  teamRun,
  winBattle,
} from "../../support/game";
import { setBattleCards } from "../../support/cards";
import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, FIRST_RUN_STARTERS, definition, species } from "../../../src/game/content";
import { cardText, enemyCanUse } from "../../../src/game/card-rules";
import { validateContent } from "../../../src/game/content-validation";
import { draw, drawKeyword, fillHand, MAX_BATTLE_CARDS } from "../../../src/game/card-zones";
import { freshCombat } from "../../../src/game/combat/index";
import { executeAbility } from "../../../src/game/combat/abilities";
import { swapBackup, swapFromCard } from "../../../src/game/team";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { roll } from "../../../src/game/random";
import { settle } from "../../../src/game/journey";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { battleChoices } from "../../../src/application/battle-policy";
import type { GameState, GameEvent } from "../../../src/game/types";

function ready(ability = "margin-of-possibility", copies = 6) {
  return produce(teamRun(1, ["rookhaven", "mossguard", "prismram"]), (game) => {
    game.cards = game.cards.filter((card) => !card.temporary);
    game.battle!.copySerial = 0;
    game.discovery.recruited.rookhaven = copies;
    const card = game.cards.find((entry) => entry.definitionId === `rookhaven-${ability}`)!;
    setBattleCards(game, [card.id]);
    game.rng = 1;
  });
}
function play(game: GameState) {
  return dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
}
function copies(game: GameState) {
  return game.cards.filter((card) => card.temporary);
}
function roundTrip(game: GameState) {
  expect(decodeSave(encodeSave(game))).toEqual(game);
}
it("registers the agreed kit, ranks, recruitment and enemy support", () => {
  expect(() => validateContent()).not.toThrow();
  expect(
    CARDS.filter((card) => card.species === "rookhaven").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Deal 1 Light damage to all enemies; Blind all enemies"],
    [1, "Purge all enemies"],
    [1, "Draw 2 cards"],
  ]);
  expect(species("rookhaven").trait).toBe("Well Read");
  expect(species("rookhaven").passiveTiers.map((tier) => tier.effects)).toEqual(
    [20, 35, 50, 70, 85, 100].map((amount) => [{ kind: "wellRead", amount }]),
  );
  expect(species("rookhaven").passiveTiers[5].description).toBe("Drawing a card copies it");
  expect(FIRST_RUN_STARTERS).not.toContain("rookhaven");
  expect(CARDS.filter((card) => card.species === "rookhaven").map(enemyCanUse)).toEqual([true, true, false]);
  let game = produce(teamRun(1, ["mossguard", "emberback", "prismram"]), (draft) => {
    prepareDestination(draft);
    draft.expedition = {
      recruit: null,
      lastRoom: null,
      pack: authoredPack(
        draft.encounter,
        COMBAT_PACKS.findIndex((pack) => pack[0] === "rookhaven"),
      ),
    };
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.discovery.encountered).toContain("rookhaven");
  game = accept(winBattle(game), { type: "recruit", species: "rookhaven" });
  expect(game.discovery.recruited.rookhaven).toBe(1);
  roundTrip(game);
});
it.each(["borrowed-brilliance", "unwritten-ending", "margin-of-possibility"])(
  "%s uses authoritative preview without changing the source or rejected state",
  (ability) => {
    const game = ready(ability);
    const before = encodeSave(game);
    const result = play(game);
    expect(result.accepted).toBe(true);
    expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    roundTrip(result.state);
    const denied = produce(game, (draft) => {
      draft.battle!.mana = 0;
    });
    expect(play(denied)).toMatchObject({ accepted: false, state: denied, events: [] });
    expect(play(denied).state).toBe(denied);
  },
);
it("Borrowed Brilliance deals one area hit and Blinds living enemies without targeting", () => {
  const game = produce(ready("borrowed-brilliance"), (draft) => {
    draft.battle!.enemies.forEach((enemy, index) => {
      enemy.block = 0;
      enemy.combat = freshCombat();
      if (index === 2) enemy.health = 0;
    });
  });
  const result = play(game);
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.blind)).toEqual([true, true, false]);
  const hits = result.events.filter(
    (event): event is Extract<GameEvent, { kind: "damage" }> =>
      event.kind === "damage" && event.damageType === "light",
  );
  expect(hits.map((event) => [event.targetId, event.amount])).toEqual([
    ["enemy-0", 1],
    ["enemy-1", 1],
  ]);
  expect(result.state.battleXP.light).toBe(1);
  expect(battleChoices(game, false)).toContainEqual({
    type: "play",
    cardId: game.battle!.hand[0],
    autoEndTurn: false,
  });
});
it("Unwritten Ending removes every beneficial effect, retains harmful effects and skips defeated enemies", () => {
  const game = produce(ready("unwritten-ending"), (draft) => {
    draft.battle!.enemies.forEach((enemy, index) => {
      enemy.block = 5;
      Object.assign(enemy.combat, {
        armor: 10,
        thorns: 2,
        waterThorns: 3,
        dodge: 20,
        temporaryDodge: 20,
        reflect: true,
        reflectBurn: true,
        nullify: true,
        nullifyFreeze: true,
        burn: 4,
        poison: 2,
        blind: true,
      });
      if (index === 2) enemy.health = 0;
    });
  });
  const result = play(game);
  for (const enemy of result.state.battle!.enemies.slice(0, 2)) {
    expect(enemy.block).toBe(0);
    expect(enemy.combat).toMatchObject({
      armor: 0,
      thorns: 0,
      waterThorns: 0,
      dodge: 0,
      temporaryDodge: 0,
      reflect: false,
      reflectBurn: false,
      nullify: false,
      nullifyFreeze: false,
      burn: 4,
      poison: 2,
      blind: true,
    });
  }
  expect(result.state.battle!.enemies[2]).toEqual(game.battle!.enemies[2]);
  expect(result.state.battleXP.light).toBe(1);
  expect(battleChoices(game, false)).toContainEqual({
    type: "play",
    cardId: game.battle!.hand[0],
    autoEndTurn: false,
  });
  expect(
    battleChoices(
      produce(game, (draft) => {
        draft.battle!.enemies.forEach((enemy) => {
          enemy.block = 0;
          enemy.combat = freshCombat();
        });
      }),
      false,
    ),
  ).toEqual([]);
  roundTrip(result.state);
});
it("enemy Rookhaven attacks and Purges the opposing deployed row without player-only draws", () => {
  for (const ability of ["borrowed-brilliance", "unwritten-ending"]) {
    const def = definition(`rookhaven-${ability}`);
    const game = ready();
    const events: GameEvent[] = [];
    const result = produce(game, (draft) => {
      const enemy = draft.battle!.enemies[0]!;
      enemy.species = "rookhaven";
      draft.team.forEach((unit) => {
        unit.block = 3;
      });
      executeAbility(requireBattle(draft), { side: "enemy", actor: enemy, def, value: 1 }, events, {
        swap: swapFromCard,
      });
    });
    expect(result.battle!.hand).toEqual(game.battle!.hand);
    expect(result.battle!.copySerial).toBe(game.battle!.copySerial);
    if (ability === "borrowed-brilliance") expect(result.team.every((unit) => unit.combat!.blind)).toBe(true);
    else expect(result.team.every((unit) => unit.block === 0)).toBe(true);
  }
});
it("Margin draws two originals and Well Read copies each once with the same owner, level and cost", () => {
  const game = produce(ready(), (draft) => {
    draft.cards.forEach((card) => {
      if (card.id !== draft.battle!.hand[0]) card.level = 2;
    });
  });
  const drawn = game.battle!.draw.slice(-2).reverse();
  const result = play(game);
  expect(result.state.battle!.hand).toHaveLength(4);
  expect(copies(result.state)).toHaveLength(2);
  drawn.forEach((id, index) => {
    const original = game.cards.find((card) => card.id === id)!;
    expect(copies(result.state)[index]).toMatchObject({
      definitionId: original.definitionId,
      ownerId: original.ownerId,
      level: 2,
    });
  });
});
it.each([1, 2, 3, 4, 5, 6])(
  "Well Read tier %i follows its seeded chance and skips RNG at 100 percent",
  (rank) => {
    const game = ready("margin-of-possibility", rank);
    for (const seed of [1, 1234567, 2000000000, 3000000000, 4000000000]) {
      let expectedRng = seed;
      const probe = { ...game, rng: seed };
      const chance = [20, 35, 50, 70, 85, 100][rank - 1]!;
      const succeeds = chance === 100 || roll(probe) < chance / 100;
      if (chance !== 100) expectedRng = probe.rng;
      const next = produce(game, (draft) => {
        draft.rng = seed;
        draw(draft, 1);
      });
      expect(copies(next)).toHaveLength(Number(succeeds));
      expect(next.rng).toBe(expectedRng);
      roundTrip(next);
    }
  },
);
it("opening, next-turn and keyword draws copy, while empty draws and buffer promotion do not", () => {
  const destination = produce(ready(), (draft) => {
    prepareDestination(draft);
  });
  const opening = accept(destination, { type: "beginBattle" });
  expect(copies(opening)).toHaveLength(4);
  expect(opening.battle!.hand).toHaveLength(6);
  expect(opening.battle!.buffer).toHaveLength(2);
  roundTrip(opening);
  const next = accept(opening, { type: "endTurn" });
  expect(copies(next).length).toBeGreaterThan(4);
  roundTrip(next);
  const keyword = produce(ready(), (draft) => {
    drawKeyword(draft, "light");
  });
  expect(copies(keyword)).toHaveLength(1);
  expect(definition(copies(keyword)[0]!.definitionId)).toMatchObject({ damageType: "light" });
  const empty = produce(keyword, (draft) => {
    draft.battle!.hand.push(...draft.battle!.draw.splice(0));
    draft.battle!.buffer.push(...draft.battle!.hand.splice(6));
  });
  const promoted = produce(empty, (draft) => {
    draft.battle!.discard.push(draft.battle!.hand.pop()!);
    fillHand(draft);
  });
  expect(copies(promoted)).toEqual(copies(empty));
  expect(promoted.rng).toBe(empty.rng);
  const exhausted = produce(empty, (draft) => {
    draw(draft, 1);
  });
  expect(exhausted).toEqual(empty);
});
it.each(["knocked out", "backup"])("a %s Rookhaven supplies no copies", (mode) => {
  const game = produce(ready(), (draft) => {
    if (mode === "knocked out") draft.team[0]!.health = 0;
    else {
      addReserve(draft, "backup", "emberback", species("emberback").health, freshCombat());
      swapBackup(draft, draft.team[0]!.id, "backup", []);
    }
  });
  const next = produce(game, (draft) => {
    draw(draft, 1);
  });
  expect(copies(next)).toHaveLength(0);
  expect(next.rng).toBe(game.rng);
  roundTrip(next);
});
it("copies survive play, discard, reshuffle, save/resume and copying a previously copied card", () => {
  let game = produce(ready(), (draft) => {
    const index = draft.battle!.draw.findIndex(
      (id) => definition(draft.cards.find((card) => card.id === id)!.definitionId).effect === "guard",
    );
    const [guard] = draft.battle!.draw.splice(index, 1);
    draft.battle!.draw.push(guard!);
    draw(draft, 1);
  });
  const copy = copies(game)[0]!;
  game = accept(game, { type: "play", cardId: copy.id, targetId: copy.ownerId!, autoEndTurn: false });
  expect(game.battle!.discard).toContain(copy.id);
  roundTrip(game);
  game = produce(game, (draft) => {
    draft.battle!.hand.push(...draft.battle!.draw.splice(0));
    draft.battle!.buffer.push(...draft.battle!.hand.splice(6));
    draw(draft, 1);
  });
  expect(copies(game)).toHaveLength(2);
  expect(game.battle!.buffer).toContain(copy.id);
  const second = copies(game)[1]!;
  expect(second).toMatchObject({ definitionId: copy.definitionId, ownerId: copy.ownerId, level: copy.level });
  expect(second.id).not.toBe(copy.id);
  roundTrip(game);
});
it.each([false, true])(
  "swaps retire outgoing copies and preserve permanent slots (card-driven %s)",
  (fromCard) => {
    const game = produce(ready(), (draft) => {
      draft.battle!.draw.sort(
        (a, b) =>
          Number(draft.cards.find((card) => card.id === a)!.ownerId === "ally-0") -
          Number(draft.cards.find((card) => card.id === b)!.ownerId === "ally-0"),
      );
      draw(draft, 1);
      addReserve(draft, "backup", "sternshell", 32, freshCombat());
    });
    const copied = copies(game)[0]!;
    const next = produce(game, (draft) => {
      swapBackup(draft, "ally-0", "backup", [], fromCard);
    });
    expect(next.cards.some((card) => card.id === copied.id)).toBe(false);
    for (const zone of ["hand", "draw", "buffer", "discard"] as const)
      expect(next.battle![zone]).not.toContain(copied.id);
    const kit = next.cards.filter((card) => card.ownerId === "backup");
    expect(kit).toHaveLength(3);
    expect(
      kit.every((card) => !card.temporary && definition(card.definitionId).species === "sternshell"),
    ).toBe(true);
    const retained = game.battle!.hand.filter((id) => {
      const card = game.cards.find((entry) => entry.id === id)!;
      return id !== copied.id && (!fromCard || card.ownerId !== "ally-0");
    });
    expect(next.battle!.hand.slice(0, retained.length)).toEqual(retained);
    roundTrip(next);
  },
);
it("victory and abandonment clear every copy without changing the three-card kits", () => {
  const game = produce(ready(), (draft) => {
    draw(draft, 2);
  });
  expect(copies(game)).toHaveLength(2);
  for (const next of [winBattle(game), accept(game, { type: "abandon" })]) {
    expect(copies(next)).toHaveLength(0);
    expect(next.cards).toHaveLength(9);
    roundTrip(next);
  }
});
it("bounds extreme copy growth without dropping drawn cards or accepting corrupt copies", () => {
  const game = produce(ready(), (draft) => {
    for (let i = 0; i < 100; i++) {
      draft.battle!.discard.push(...draft.battle!.hand.splice(0));
      draw(draft, 9);
    }
  });
  expect(game.cards).toHaveLength(MAX_BATTLE_CARDS);
  const zones = [...game.battle!.hand, ...game.battle!.buffer, ...game.battle!.draw, ...game.battle!.discard];
  expect(new Set(zones).size).toBe(MAX_BATTLE_CARDS);
  roundTrip(game);
  for (const corrupt of [
    produce(game, (draft) => {
      draft.battle!.copySerial = 0;
    }),
    produce(game, (draft) => {
      copies(draft)[0]!.temporary = undefined;
    }),
    produce(game, (draft) => {
      draft.cards = draft.cards.filter((card) => card.temporary);
    }),
  ])
    expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it("the deployed Rookhaven copies once, including while controlled", () => {
  const game = produce(teamRun(1, ["rookhaven", "reedstag", "mossguard"]), (draft) => {
    draft.cards = draft.cards.filter((card) => !card.temporary);
    draft.battle!.copySerial = 0;
    draft.battle!.hand = [];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.map((card) => card.id);
    draft.discovery.recruited.rookhaven = 6;
    Object.assign(draft.team[0]!.combat!, { controlled: "freeze", controlTurns: 1 });
  });
  const events: GameEvent[] = [];
  const next = produce(game, (draft) => {
    draw(draft, 1, events);
  });
  expect(copies(next)).toHaveLength(1);
  expect(events.map((event) => event.actorId)).toEqual(["ally-0"]);
  expect(next.battle!.hand).toHaveLength(2);
  expect(next.rng).toBe(game.rng);
  roundTrip(next);
});
it("defeat clears copies before publishing the saved result", () => {
  const game = produce(ready(), (draft) => {
    draw(draft, 2);
  });
  const next = produce(game, (draft) => {
    draft.team.forEach((unit) => {
      unit.health = 0;
    });
    settle(requireBattle(draft), []);
  });
  expect(next.phase).toBe("defeat");
  expect(copies(next)).toHaveLength(0);
  expect(next.cards).toHaveLength(9);
  roundTrip(next);
});

it("keeps the battle card limit and a saveable hand when deploying into a copy-filled formation", () => {
  const game = produce(teamRun(1, ["rookhaven", "mossguard"]), (draft) => {
    addReserve(draft, "backup", "prismram", species("prismram").health, freshCombat());
    const original = draft.cards[0]!;
    while (draft.cards.length < MAX_BATTLE_CARDS) {
      draft.cards.push({ ...original, id: `copy-${draft.battle!.copySerial++}`, temporary: true });
    }
    const ids = draft.cards.map((card) => card.id);
    draft.battle!.hand = ids.slice(0, 6);
    draft.battle!.buffer = ids.slice(6);
    draft.battle!.draw = [];
    draft.battle!.discard = [];
  });
  roundTrip(game);
  const result = { state: swapFixture(game, { type: "swap", activeId: "", reserve: "backup" }) };
  expect(result.state.cards).toHaveLength(MAX_BATTLE_CARDS);
  expect(result.state.cards.filter((card) => card.ownerId === "backup")).toHaveLength(3);
  expect(result.state.cards.filter((card) => card.temporary)).toEqual(
    game.cards.filter((card) => card.temporary).slice(0, -3),
  );
  roundTrip(result.state);
});

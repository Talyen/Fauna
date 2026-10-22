import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, FIRST_RUN_STARTERS } from "../../../src/game/content";
import { freshCombat } from "../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { battleChoices } from "../../../src/application/battle-policy";
import type { GameState } from "../../../src/game/types";
import { accept, teamRun, winBattle } from "../../support/game";

function ready(ability = "resonant-well") {
  return produce(teamRun(1, ["cadenza", "mossguard", "prismram"]), (game) => {
    const card = game.cards.find((entry) => entry.definitionId === `cadenza-${ability}`)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    game.rng = 1;
  });
}
function play(game: GameState, autoEndTurn = false) {
  return dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn });
}
it("registers Cadenza's kit, recruitment, automatic targeting and save/preview parity", () => {
  expect(
    CARDS.filter((card) => card.species === "cadenza").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Draw 2 cards; Gain 1 Mana"],
    [1, "Return a random discarded card from a living ally to your hand"],
    [1, "Give all allies 20% Dodge until your next turn; Draw 1 card"],
  ]);
  expect(FIRST_RUN_STARTERS).not.toContain("cadenza");
  for (const ability of ["resonant-well", "echoes-remember", "rousing-refrain"]) {
    const game = ready(ability);
    const before = encodeSave(game);
    const result = play(game);
    expect(result.accepted).toBe(true);
    expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    const policyGame =
      ability === "echoes-remember"
        ? produce(game, (draft) => {
            draft.battle!.discard.push(draft.battle!.draw.pop()!);
          })
        : game;
    expect(battleChoices(policyGame)).toContainEqual(
      expect.objectContaining({ type: "play", cardId: game.battle!.hand[0] }),
    );
  }
  let game = produce(teamRun(1, ["mossguard", "emberback", "prismram"]), (draft) => {
    draft.phase = "teamSelection";
    draft.battle = null;
    draft.expedition = {
      recruit: null,
      lastRoom: null,
      pack: COMBAT_PACKS.findIndex((pack) => pack[0] === "cadenza"),
    };
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.discovery.encountered).toContain("cadenza");
  expect(accept(winBattle(game), { type: "recruit", species: "cadenza" }).discovery.recruited.cadenza).toBe(
    1,
  );
});
it("Resonant Well draws twice and refunds before automatic end turn", () => {
  const game = produce(ready(), (draft) => {
    draft.battle!.mana = 1;
  });
  const result = play(game, true);
  expect(result.state.battle!.hand).toHaveLength(2);
  expect(result.state.battle!.mana).toBe(1);
  expect(result.state.battle!.turn).toBe(1);
  expect(result.state.battleXP.mana).toBe(1);
  const rejected = produce(game, (draft) => {
    draft.battle!.mana = 0;
  });
  expect(play(rejected)).toMatchObject({ accepted: false, state: rejected, events: [] });
  expect(play(rejected).state).toBe(rejected);
});
it("Echoes Remember recovers other creatures' cards with seeded randomness and no duplicates", () => {
  const selected = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const game = produce(ready("echoes-remember"), (draft) => {
      draft.rng = seed * 1234567;
      const others = draft.battle!.draw.splice(0, 3);
      draft.battle!.discard = others;
    });
    const result = play(game);
    expect(result).toEqual(play(game));
    const battle = result.state.battle!;
    const recovered = battle.hand[0]!;
    selected.add(result.state.cards.find((card) => card.id === recovered)!.ownerId);
    expect(battle.discard).not.toContain(recovered);
    expect(battle.hand).toHaveLength(1);
    const zones = [...battle.hand, ...battle.draw, ...battle.discard, ...battle.buffer];
    expect(zones).toHaveLength(game.cards.length);
    expect(new Set(zones).size).toBe(game.cards.length);
  }
  expect(selected.size).toBeGreaterThan(1);
  const empty = ready("echoes-remember");
  expect(play(empty).state.battle!.hand).toEqual(empty.battle!.hand);
});
it("Echoes Remember preserves overflow ordering and recovers exactly one card when upgraded", () => {
  const game = produce(ready("echoes-remember"), (draft) => {
    draft.cards.find((card) => card.id === draft.battle!.hand[0])!.level = 2;
    draft.battle!.hand.push(...draft.battle!.draw.splice(0, 6));
    draft.battle!.buffer.push(draft.battle!.draw.pop()!);
    draft.battle!.discard.push(draft.battle!.draw.pop()!);
  });
  const result = play(game);
  expect(result.state.battle!.hand).toHaveLength(7);
  expect(result.state.battle!.buffer).toHaveLength(1);
  expect(result.state.battle!.hand.at(-1)).toBe(game.battle!.buffer[0]);
  expect(result.state.battle!.discard).toHaveLength(1);
});
it("Rousing Refrain protects only living deployed allies and expires at their next turn", () => {
  const game = produce(ready("rousing-refrain"), (draft) => {
    draft.team[2]!.health = 0;
    draft.roster.push("coralcurl");
    draft.reserves.push({
      id: "backup",
      species: "coralcurl",
      health: 20,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
    draft.battle!.enemies.forEach((enemy) => {
      enemy.power = 0;
    });
  });
  const result = play(game);
  expect(result.state.team.map((unit) => unit.combat!.temporaryDodge)).toEqual([20, 20, 0]);
  expect(result.state.reserves[0]!.combat!.temporaryDodge).toBe(0);
  expect(result.state.battle!.hand).toHaveLength(1);
  expect(result.state.battleXP.dodge).toBe(1);
  const next = accept(result.state, { type: "endTurn" });
  expect(next.team.every((unit) => unit.combat!.temporaryDodge === 0)).toBe(true);
});
it("Living Chorus heals after the team's second card at every tier and only once", () => {
  for (let tier = 0; tier < 6; tier++) {
    const game = produce(ready("echoes-remember"), (draft) => {
      draft.discovery.recruited.cadenza = tier + 1;
      draft.team[1]!.health = 5;
      draft.team[0]!.health = 20;
    });
    const first = play(game).state;
    expect(first.team[1]!.health).toBe(5);
    const resumed = decodeSave(encodeSave(first));
    const second = play(resumed).state;
    expect(second.team[1]!.health).toBe(6 + tier);
    const third = play(second).state;
    expect(third.team[1]!.health).toBe(6 + tier);
    expect(third.battle!.cardsPlayedThisTurn).toBe(3);
  }
});
it("Living Chorus counts other allies' free cards and resets next turn", () => {
  let game = produce(ready("echoes-remember"), (draft) => {
    draft.team[1]!.health = 5;
    const guard = draft.cards.find(
      (card) =>
        card.ownerId === draft.team[1]!.id &&
        CARDS.find((def) => def.id === card.definitionId)!.effect === "guard",
    )!;
    draft.battle!.draw = draft.battle!.draw.filter((id) => id !== guard.id);
    draft.battle!.hand.push(guard.id);
    draft.team[1]!.combat!.freeCard = true;
  });
  game = play(game).state;
  const guard = game.battle!.hand[0]!;
  game = accept(game, { type: "play", cardId: guard, targetId: game.team[1]!.id, autoEndTurn: false });
  expect(game.team[1]!.health).toBe(6);
  expect(game.battle!.cardsPlayedThisTurn).toBe(2);
  game = accept(game, { type: "endTurn" });
  expect(game.battle!.cardsPlayedThisTurn).toBe(0);
});
it("Living Chorus requires a living deployed singer", () => {
  for (const unavailable of ["knockout", "backup"]) {
    const game = produce(ready("echoes-remember"), (draft) => {
      draft.battle!.cardsPlayedThisTurn = 1;
      const guard = draft.cards.find(
        (card) =>
          card.ownerId === draft.team[1]!.id &&
          CARDS.find((def) => def.id === card.definitionId)!.effect === "guard",
      )!;
      draft.battle!.draw = draft.battle!.draw.filter((id) => id !== guard.id);
      draft.battle!.discard.push(...draft.battle!.hand);
      draft.battle!.hand = [guard.id];
      draft.team[1]!.health = 5;
      if (unavailable === "knockout") draft.team[0]!.health = 0;
      else draft.reserves.push(...draft.team.splice(0, 1));
    });
    const result = dispatch(game, {
      type: "play",
      cardId: game.battle!.hand[0]!,
      targetId: "ally-1",
      autoEndTurn: false,
    });
    expect(result.accepted).toBe(true);
    expect(result.state.team.find((unit) => unit.id === "ally-1")!.health).toBe(5);
  }
});
it.each([0, 2])(
  "enemy Cadenza at position %s protects and heals its side on consecutive turns",
  (position) => {
    let game = produce(ready(), (draft) => {
      const enemies = draft.battle!.enemies;
      enemies[position]!.species = "cadenza";
      enemies[position]!.name = "Cadenza";
      enemies[position]!.health = 10;
      enemies[position]!.maxHealth = 28;
      enemies[1]!.health = 1;
      enemies[1]!.maxHealth = 100;
      enemies.forEach((enemy) => {
        enemy.power = 0;
      });
    });
    for (let turn = 0; turn < 2; turn++) {
      const result = dispatch(game, { type: "endTurn" });
      expect(result.accepted).toBe(true);
      expect(
        result.events.filter((event) => event.kind === "heal" && event.targetId === "enemy-1").length,
      ).toBeGreaterThan(0);
      expect(result.state.battle!.enemies[position]!.lastAbility).toBe("cadenza-rousing-refrain");
      expect(
        result.state
          .battle!.enemies.filter((enemy) => enemy.health > 0)
          .map((enemy) => enemy.combat.temporaryDodge),
      ).toEqual([20, 20, 20]);
      game = result.state;
    }
  },
);
it("Living Chorus chooses the lowest Health proportion, breaks ties by position and works while controlled", () => {
  for (const tie of [false, true]) {
    const game = produce(ready("echoes-remember"), (draft) => {
      draft.battle!.cardsPlayedThisTurn = 1;
      draft.team[0]!.health = 14;
      draft.team[0]!.combat!.controlled = "stun";
      draft.team[0]!.combat!.skipped = true;
      draft.team[1]!.health = tie ? 16 : 15;
      const guard = draft.cards.find(
        (card) =>
          card.ownerId === "ally-1" && CARDS.find((def) => def.id === card.definitionId)!.effect === "guard",
      )!;
      draft.battle!.draw = draft.battle!.draw.filter((id) => id !== guard.id);
      draft.battle!.discard.push(...draft.battle!.hand);
      draft.battle!.hand = [guard.id];
    });
    const result = dispatch(game, {
      type: "play",
      cardId: game.battle!.hand[0]!,
      targetId: "ally-1",
      autoEndTurn: false,
    });
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.health).toBe(tie ? 15 : 14);
    expect(result.state.team[1]!.health).toBe(16);
  }
});
it("Living Chorus does not count repeated resolutions as additional cards", () => {
  let repeated = false;
  for (let seed = 1; seed < 30 && !repeated; seed++) {
    const game = produce(teamRun(seed, ["cadenza", "chimecricket", "mossguard"]), (draft) => {
      draft.discovery.recruited.chimecricket = 6;
      draft.team[2]!.health = 5;
      draft.battle!.cardsPlayedThisTurn = 1;
      const card = draft.cards.find((entry) => entry.definitionId === "chimecricket-nullify")!;
      draft.battle!.hand = [card.id];
      draft.battle!.buffer = [];
      draft.battle!.discard = [];
      draft.battle!.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    });
    const result = play(game);
    repeated = result.events.some((event) => event.text.includes("repeats"));
    expect(result.state.team[2]!.health).toBe(6);
    expect(result.state.battle!.cardsPlayedThisTurn).toBe(2);
  }
  expect(repeated).toBe(true);
});
it("swapping Cadenza out and back does not reset the team's second-card cadence", () => {
  const game = produce(ready("echoes-remember"), (draft) => {
    draft.roster.push("coralcurl");
    draft.reserves.push({
      id: "backup",
      species: "coralcurl",
      health: 20,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
    draft.team[1]!.health = 5;
  });
  let next = play(game).state;
  next = accept(next, { type: "swap", activeId: "ally-0", reserve: "backup" });
  next = accept(next, { type: "swap", activeId: "backup", reserve: "ally-0" });
  expect(next.battle!.cardsPlayedThisTurn).toBe(1);
  const result = play(next);
  expect(result.accepted).toBe(true);
  expect(result.state.team[1]!.health).toBe(6);
});

it("Echoes Remember leaves knocked-out owners' inert slots in discard", () => {
  const game = produce(ready("echoes-remember"), (draft) => {
    draft.team[1]!.health = 0;
    const fallenCards = draft.cards.filter((card) => card.ownerId === "ally-1").map((card) => card.id);
    draft.battle!.discard = fallenCards;
    draft.battle!.draw = draft.battle!.draw.filter((id) => !fallenCards.includes(id));
    draft.rng = 1;
  });
  const result = play(game);
  const recovered = result.state.cards.find((card) => card.id === result.state.battle!.hand[0])!;
  expect(recovered.ownerId).toBe("ally-0");
  expect(result.state.battle!.discard).toEqual(game.battle!.discard);
  expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, species } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import { freshCombat, grantBlock } from "../../../src/game/combat/index";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { battleChoices } from "../../../src/application/battle-policy";
import type { GameEvent } from "../../../src/game/types";
import { authoredPack, accept, teamRun, winBattle } from "../../support/game";

function ready(id = "bloomquail-guard", copies = 1) {
  return produce(teamRun(1, ["bloomquail", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.bloomquail = copies;
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.rng = 1;
  });
}

it("plays the approved one-Mana kit with deterministic previews and current-format resume", () => {
  expect(
    CARDS.filter((card) => card.species === "bloomquail").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Gain 6 Block"],
    [1, "Draw 2 cards; Restore 2 Health"],
    [1, "Restore 2 Health to all allies; Blind all enemies"],
  ]);
  for (const id of ["bloomquail-guard", "bloomquail-draw", "bloomquail-heal"]) {
    const game = produce(ready(id), (draft) => {
      draft.team[0]!.health = 20;
      draft.team[1]!.health = 10;
    });
    const cardId = game.battle!.hand[0]!;
    const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, cardId)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    if (id === "bloomquail-guard") {
      expect(result.state.team[0]!.block).toBe(3);
      expect(result.state.team[1]!.health).toBe(13);
      expect(game.team[1]!.health).toBe(10);
    }
    if (id === "bloomquail-draw") {
      expect(result.state.battle!.hand).toHaveLength(2);
      expect(result.state.team[0]!.health).toBe(22);
      expect(result.state.team[1]!.health).toBe(10);
      expect(battleChoices(game)[0]).toMatchObject({ type: "play", cardId });
    }
  }
  const game = ready();
  expect(dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId: "ally-1" }).state).toBe(
    game,
  );
});

it.each([50, 60, 70, 80, 90, 100])("converts %i percent of newly gained Block immediately", (percent) => {
  const events: GameEvent[] = [];
  const result = produce(ready("bloomquail-guard", (percent - 50) / 10 + 1), (game) => {
    game.team[0]!.block = 7;
    game.team[1]!.health = 1;
    const rng = game.rng;
    grantBlock(game, game.team[0]!, 10, events);
    expect(game.rng).toBe(rng);
  });
  expect(result.team[0]!.block).toBe(17 - percent / 10);
  expect(result.team[1]!.health).toBe(1 + percent / 10);
  expect(events).toContainEqual(
    expect.objectContaining({ kind: "heal", targetId: "ally-1", amount: percent / 10 }),
  );
  expect(species("bloomquail").passiveTiers[(percent - 50) / 10]!.description).toBe(
    `Convert ${percent === 100 ? "your Block" : `${percent}% of your Block`} into Health for the most injured ally`,
  );
});

it("rounds normally and keeps Block beyond the chosen ally's missing Health without healing another ally", () => {
  const result = produce(ready(), (game) => {
    game.team[1]!.health -= 1;
    game.team[2]!.health -= 1;
    grantBlock(game, game.team[0]!, 9, []);
  });
  // Prismram has the lower Health percentage (29/30 versus 31/32)
  expect(result.team[0]!.block).toBe(8);
  expect(result.team[1]!.health).toBe(31);
  expect(result.team[2]!.health).toBe(30);
  const rounded = produce(ready(), (game) => {
    game.team[0]!.health = 1;
    grantBlock(game, game.team[0]!, 3, []);
  });
  expect(rounded.team[0]!.health).toBe(3);
  expect(rounded.team[0]!.block).toBe(1);
  const full = produce(ready("bloomquail-guard", 6), (game) => grantBlock(game, game.team[0]!, 6, []));
  expect(full.team[0]!.block).toBe(6);
});

it("selects by Health percentage with stable ties, including itself and excluding backup and knockouts", () => {
  const game = produce(ready(), (draft) => {
    draft.team[0]!.health = 13;
    draft.team[1]!.health = 16;
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[0]!, id: "backup", health: 1 });
    grantBlock(draft, draft.team[0]!, 6, []);
  });
  expect(game.team.map((ally) => ally.health)).toEqual([16, 16, 0]);
  expect(game.reserves[0]!.health).toBe(1);
  const noConversion = produce(game, (draft) => {
    grantBlock(draft, draft.reserves[0]!, 6, []);
    grantBlock(draft, draft.team[2]!, 6, []);
    grantBlock(draft, draft.team[0]!, 0, []);
  });
  expect(noConversion.team).toEqual(game.team);
  expect(noConversion.reserves[0]!.block).toBe(game.reserves[0]!.block + 6);
});

it("converts only actual stack-capped gains and converts Block received through Reedguard", () => {
  const capped = produce(ready(), (game) => {
    game.team[0]!.block = 999999;
    game.team[1]!.health = 1;
    grantBlock(game, game.team[0]!, 6, []);
  });
  expect(capped.team[0]!.block).toBe(999999);
  expect(capped.team[1]!.health).toBe(2);
  const shared = produce(teamRun(1, ["reedstag", "bloomquail", "mossguard"]), (game) => {
    game.discovery.recruited.reedstag = 6;
    game.discovery.recruited.bloomquail = 6;
    game.team[2]!.health = 1;
    game.boons = ["groves-favor"];
    grantBlock(game, game.team[0]!, 6, []);
  });
  expect(shared.team.map((ally) => ally.block)).toEqual([6, 0, 6]);
  expect(shared.team[2]!.health).toBe(7);
  expect(shared.team[2]!.combat!.thorns).toBe(1);
});

it("heals each deployed ally and Blinds each enemy once, including at full Health", () => {
  const game = produce(ready("bloomquail-heal"), (draft) => {
    draft.team[0]!.health -= 3;
    draft.team[1]!.health -= 3;
    draft.team[2]!.health = 0;
    draft.battle!.enemies.forEach((enemy) => {
      enemy.combat = freshCombat();
      enemy.combat.nullify = true;
    });
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.state.team.map((ally) => ally.health)).toEqual([25, 31, 0]);
  // A second application in the same play would spend Nullify and then Blind
  expect(result.state.battle!.enemies.every((enemy) => !enemy.combat.nullify && !enemy.combat.blind)).toBe(
    true,
  );
  const full = ready("bloomquail-heal");
  expect(battleChoices(full)[0]).toMatchObject({ type: "play" });
  const blinded = accept(full, { type: "play", cardId: full.battle!.hand[0]!, autoEndTurn: false });
  expect(blinded.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
});

it("uses enemy base conversion on its own side and Cradle heals only its actor", () => {
  const game = produce(ready("bloomquail-draw", 6), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "bloomquail";
    enemy.health = 1;
    enemy.lastAbility = "bloomquail-heal";
    const rng = draft.rng;
    grantBlock(draft, enemy, 6, []);
    expect(draft.rng).toBe(rng);
    expect(enemy.health).toBe(4);
    expect(enemy.block).toBe(3);
  });
  expect(game.team).toEqual(ready("bloomquail-draw", 6).team);
  const results = Array.from({ length: 20 }, (_, seed) =>
    dispatch(
      produce(game, (draft) => {
        draft.rng = seed * 1000;
      }),
      { type: "endTurn" },
    ),
  );
  const cradle = results.find((result) =>
    result.events.some((event) => event.text.includes("uses Bloom Cradle")),
  )!;
  expect(cradle).toBeDefined();
  expect(cradle.events).toContainEqual(
    expect.objectContaining({ kind: "heal", targetId: "enemy-0", amount: 2 }),
  );
  expect(cradle.state.battle!.enemies[0]!.block).toBe(2);
});

it("discovers, recruits and resumes Bloomquail with its complete kit", () => {
  const initial = createGame(7);
  let game = accept(
    accept(initial, { type: "draft", species: initial.starterOffers.find((kind) => kind !== "bloomquail")! }),
    { type: "start" },
  );
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = authoredPack(
        draft.encounter,
        COMBAT_PACKS.findIndex((pack) => pack[0] === "bloomquail"),
      );
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("bloomquail");
  game = accept(winBattle(game), { type: "recruit", species: "bloomquail" });
  expect(game.discovery.recruited.bloomquail).toBe(1);
  expect(game.cards.filter((card) => card.ownerId === game.team[1]!.id)).toHaveLength(3);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 32 }))).toThrow();
});

it("applies healing talents without card-only overhealing rewards or recursive conversion", () => {
  const events: GameEvent[] = [];
  const result = produce(ready("bloomquail-guard", 6), (game) => {
    game.talents = ["health.mending", "health.overflow", "health.clean-slate"];
    game.team[0]!.health = 20;
    game.team[0]!.combat!.poison = 2;
    grantBlock(game, game.team[0]!, 6, events);
  });
  expect(result.team[0]!.health).toBe(26);
  expect(result.team[0]!.block).toBe(0);
  expect(result.team[0]!.combat!.poison).toBe(2);
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(1);
});

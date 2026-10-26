import { enemyPlay } from "../../support/game";
import { addBackups } from "../../support/game";
import { authoredPack, swapFixture } from "../../support/game";
import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, species } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import { freshCombat, hit, openingCriticalBonus, startAction } from "../../../src/game/combat/index";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { battleChoices } from "../../../src/application/battle-policy";
import { prepareDestination, accept, teamRun, winBattle } from "../../support/game";
import type { GameEvent, GameState } from "../../../src/game/types";

function ready(id = "dawncall-attack", copies = 6) {
  return produce(teamRun(1, ["dawncall", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.dawncall = copies;
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    for (const enemy of game.battle!.enemies) {
      enemy.block = 0;
      enemy.combat = freshCombat();
      enemy.combat.controlled = "freeze";
      enemy.combat.controlTurns = 1;
    }
    game.rng = 1;
  });
}
function play(game: GameState, definitionId?: string) {
  return dispatch(game, {
    type: "play",
    cardId: definitionId
      ? game.cards.find((card) => card.definitionId === definitionId)!.id
      : game.battle!.hand[0]!,
    autoEndTurn: false,
  });
}
function rehand(game: GameState, id: string) {
  return produce(game, (draft) => {
    const card = draft.cards.find((card) => card.definitionId === id)!;
    for (const zone of ["hand", "draw", "discard", "buffer"] as const)
      draft.battle![zone] = draft.battle![zone].filter((entry) => entry !== card.id);
    draft.battle!.hand.unshift(card.id);
  });
}
const attacks = (events: GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { kind: "damage" }> => e.kind === "damage" && e.actorId === "ally-0",
  );

it("uses the approved one-Mana kit with deterministic previews and current-format resume", () => {
  expect(
    CARDS.filter((card) => card.species === "dawncall").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Cleanse 1 harmful effect from all allies; Draw 1 card"],
    [1, "Deal 2 Light damage to all enemies"],
    [1, "Restore 2 Health to all allies"],
  ]);
  for (const id of ["dawncall-teamCleanse", "dawncall-attack", "dawncall-heal"]) {
    const game = ready(id);
    const result = play(game);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
    expect(game.team[0]!.combat!.firstAttackUsed).toBe(false);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  }
});

it("makes every landed enemy hit Critical at five stars, only on the first attack", () => {
  const first = play(ready());
  expect(attacks(first.events)).toHaveLength(3);
  expect(attacks(first.events).map((e) => [e.amount, e.critical])).toEqual([
    [4, true],
    [4, true],
    [4, true],
  ]);
  expect(first.state.battleXP.light).toBe(1);
  const second = play(
    produce(rehand(first.state, "dawncall-attack"), (draft) => {
      draft.rng = 1;
    }),
  );
  expect(attacks(second.events).map((e) => [e.amount, e.critical])).toEqual([
    [2, false],
    [2, false],
    [2, false],
  ]);
  expect(first.state.rng).toBe(1);
});

it.each([20, 35, 50, 65, 80])(
  "adds the exact %i%% opening bonus to ordinary allied Critical chance",
  (bonus) => {
    const copies = [20, 35, 50, 65, 80].indexOf(bonus) + 1;
    for (const [fraction, expected] of [
      [(bonus + 5) / 100 - 0.001, true],
      [(bonus + 5) / 100 + 0.001, false],
    ] as const) {
      let seed = 0;
      while (true) {
        const value = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
        if (value >= fraction && value < fraction + 0.0001) break;
        seed++;
      }
      const result = play(
        produce(ready("dawncall-attack", copies), (draft) => {
          draft.rng = seed;
        }),
      );
      expect(attacks(result.events)[0]!.critical).toBe(expected);
    }
  },
);

it("Cleanses one category per living deployed ally before drawing and leaves Early Bird available", () => {
  const game = produce(ready("dawncall-teamCleanse"), (draft) => {
    for (const ally of draft.team) Object.assign(ally.combat!, { burn: 2, poison: 3 });
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[1]!, id: "backup", combat: { ...freshCombat(), burn: 2 } });
    draft.reserves[0]!.health = 0;
  });
  const result = play(game);
  const withLivingBackup = produce(game, (draft) => {
    draft.team[2]!.health = 1;
    draft.reserves[0]!.health = 32;
  });
  expect(play(withLivingBackup).state.reserves[0]).toEqual(withLivingBackup.reserves[0]);
  expect(result.state.team.map((ally) => ally.combat!.burn)).toEqual([0, 0, 2]);
  expect(result.state.team.map((ally) => ally.combat!.poison)).toEqual([3, 3, 3]);
  expect(result.state.reserves[0]!.combat!.burn).toBe(2);
  expect(result.state.battle!.hand).toHaveLength(1);
  expect(result.state.team[0]!.combat!.firstAttackUsed).toBe(false);
  expect(result.state.battleXP.health).toBe(1);
  expect(battleChoices(ready("dawncall-teamCleanse"), false)).toContainEqual({
    type: "play",
    cardId: game.battle!.hand[0]!,
    autoEndTurn: false,
  });
  const clean = play(ready("dawncall-teamCleanse"));
  expect(clean.state.battle!.hand).toHaveLength(1);
});

it("Morning Bloom heals all living deployed allies by two without reviving or healing backup", () => {
  const game = produce(ready("dawncall-heal"), (draft) => {
    draft.team[0]!.health = 20;
    draft.team[1]!.health = 31;
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[1]!, id: "backup", health: 10, combat: freshCombat() });
    draft.reserves[0]!.health = 0;
  });
  const result = play(game);
  const withLivingBackup = produce(game, (draft) => {
    draft.team[2]!.health = 1;
    draft.reserves[0]!.health = 10;
  });
  expect(play(withLivingBackup).state.reserves[0]).toEqual(withLivingBackup.reserves[0]);
  expect(result.state.team.map((ally) => ally.health)).toEqual([22, 32, 0]);
  expect(result.state.reserves[0]!.health).toBe(0);
  expect(result.state.team[0]!.combat!.firstAttackUsed).toBe(false);
});

it("retains the opening receipt through swaps and resume, resets in backup and at a new battle", () => {
  let game = produce(play(ready()).state, (draft) => {
    addBackups(draft, {
      ...draft.team[1]!,
      id: "backup",
      species: "captoad" as const,
      health: 30,
      combat: freshCombat(),
    });
  });
  game = swapFixture(game, { type: "swap", activeId: "ally-0", reserve: "backup" });
  game = decodeSave(encodeSave(game));
  expect(game.reserves[0]!.combat!.firstAttackUsed).toBe(true);
  game = accept(game, { type: "endTurn" });
  expect(game.reserves[0]!.combat!.firstAttackUsed).toBe(false);
  game = swapFixture(game, { type: "swap", activeId: "backup", reserve: "ally-0" });
  const result = play(rehand(game, "dawncall-attack"));
  expect(attacks(result.events).every((event) => event.kind === "damage" && event.critical)).toBe(true);
  game = produce(result.state, (draft) => {
    prepareDestination(draft);
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.team[0]!.combat!.firstAttackUsed).toBe(false);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 31 }))).toThrow();
});

it("does not spend Early Bird on rejected commands, retaliation or periodic damage; a missed attack spends it", () => {
  const rejected = produce(ready(), (draft) => {
    draft.battle!.mana = 0;
  });
  expect(play(rejected).state).toBe(rejected);
  expect(rejected.team[0]!.combat!.firstAttackUsed).toBe(false);
  produce(ready(), (draft) => {
    hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 2, "light", [], { origin: "retaliation" as const });
    hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 2, "light", [], { origin: "periodic" as const });
    expect(draft.team[0]!.combat!.firstAttackUsed).toBe(false);
  });
  const missed = play(
    produce(ready(), (draft) => {
      draft.team[0]!.combat!.blind = true;
    }),
  );
  expect(attacks(missed.events)).toHaveLength(0);
  expect(missed.events.filter((event) => event.kind === "status" && event.outcome === "dodge")).toHaveLength(
    3,
  );
  expect(missed.state.team[0]!.combat!.firstAttackUsed).toBe(true);
});

it("enemy Early Bird uses only its base bonus, and resets on a skipped turn", () => {
  produce(ready(), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "dawncall";
    expect(openingCriticalBonus(draft, enemy)).toBe(20);
    expect(openingCriticalBonus(draft, enemy)).toBe(0);
    startAction(enemy, [], draft);
    expect(enemy.combat.firstAttackUsed).toBe(false);
  });
});

it.each([
  ["Dawn Cry", 0],
  ["Sunwing Sweep", 1000],
  ["Morning Bloom", 1500],
] as const)("enemy %s affects its own side correctly", (name, seed) => {
  const game = produce(ready(), (draft) => {
    draft.rng = seed;
    for (const enemy of draft.battle!.enemies) {
      enemy.combat = freshCombat();
      enemy.health = enemy.maxHealth - 5;
    }
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "dawncall";
    enemy.name = "Dawncall";
    enemy.power = 1;
    for (const unit of draft.team) unit.block = 100;
    for (const other of draft.battle!.enemies.slice(1)) {
      Object.assign(other.combat, { controlled: "freeze", controlTurns: 2, blind: true, burn: 2 });
    }
  });
  const result = enemyPlay(
    game,
    name === "Dawn Cry"
      ? "dawncall-teamCleanse"
      : name === "Sunwing Sweep"
        ? "dawncall-attack"
        : "dawncall-heal",
  );
  expect(
    result.events.some((event) => event.actorId === "enemy-0" && event.text.includes(`uses ${name}`)),
  ).toBe(true);
  if (name === "Dawn Cry") {
    const removed = result.events.filter(
      (event) =>
        event.kind === "status" &&
        event.outcome === "remove" &&
        event.status === "cleanse" &&
        event.affectedStatus,
    );
    expect(removed).toHaveLength(2);
    expect(removed.every((event) => event.kind === "status" && event.affectedStatus === "freeze")).toBe(true);
    expect(result.state.team.every((unit) => unit.combat!.burn === 0)).toBe(true);
  } else if (name === "Sunwing Sweep") {
    const damage = result.events.filter(
      (event): event is Extract<GameEvent, { kind: "damage" }> =>
        event.kind === "damage" && event.actorId === "enemy-0",
    );
    expect(damage).toHaveLength(3);
    expect(
      damage.every(
        (event) =>
          event.kind === "damage" && event.damageType === "light" && event.targetId!.startsWith("ally-"),
      ),
    ).toBe(true);
  } else {
    expect(
      result.events.filter(
        (event) => event.kind === "heal" && event.amount === 2 && event.targetId!.startsWith("enemy-"),
      ),
    ).toHaveLength(3);
  }
});

it("discovers and recruits Dawncall through ordinary encounters", () => {
  const initial = createGame(7);
  let game = accept(
    accept(initial, { type: "draft", species: initial.starterOffers.find((id) => id !== "dawncall")! }),
    { type: "start" },
  );
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = authoredPack(
        draft.encounter,
        COMBAT_PACKS.findIndex((pack) => pack[0] === "dawncall"),
      );
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("dawncall");
  game = accept(winBattle(game), { type: "recruit", species: "dawncall" });
  expect(game.discovery.recruited.dawncall).toBe(1);
  expect(game.cards.filter((card) => card.definitionId.startsWith("dawncall-"))).toHaveLength(3);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  expect(species("dawncall").health).toBe(24);
});

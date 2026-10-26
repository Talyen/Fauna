import { expect, it } from "vitest";
import { produce } from "immer";
import { chooseBattleCommand, rankedBattleChoices } from "../../../src/application/battle-policy";
import { dispatch } from "../../../src/game/engine";
import { accept, authoredPack, prepareDestination, requireBattle, teamRun } from "../../support/game";
import { summonEcho } from "../../../src/game/combat/legendary";
import { freshCombat, removeEffects } from "../../../src/game/combat/index";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { attack } from "../../../src/game/content/card-builders";
import { species, SPECIES, TALENTS, BOONS } from "../../../src/game/content";
import { KEYWORDS } from "../../../src/game/progression";
import { encodeSave, decodeSave } from "../../../src/game/save";

it.each([
  "block",
  "armor",
  "thorns",
  "waterThorns",
  "fireThorns",
  "dodge",
  "temporaryDodge",
  "reflect",
  "reflectBurn",
  "nullify",
  "nullifyFreeze",
  "negate",
  "attackReflection",
] as const)("Auto-play values Purge for an enemy's %s alone", (status) => {
  const state = produce(teamRun(42, ["rookhaven"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === "rookhaven-unwritten-ending")!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    for (const enemy of game.battle!.enemies) {
      enemy.block = 0;
      enemy.combat = freshCombat();
    }
    const enemy = game.battle!.enemies[0]!;
    if (status === "block") enemy.block = 2;
    else Object.assign(enemy.combat, { [status]: typeof enemy.combat[status] === "boolean" ? true : 2 });
  });
  const [choice] = rankedBattleChoices(state, false);
  expect(choice!.score).toBe(status === "block" || status === "armor" ? 1701 : 161);
  const result = dispatch(state, choice!.command);
  expect(result.accepted).toBe(true);
  const enemy = result.state.battle!.enemies[0]!;
  expect(Number(status === "block" ? enemy.block : enemy.combat[status])).toBe(0);
});

it.each([
  ["cadenza", "cadenza-rousing-refrain"],
  ["stillara", "stillara-thaw-path"],
  ["tournelle", "tournelle-teamClearBlind"],
] as const)("Auto-play keeps healing ahead of useful draw for %s's spent support", (kind, definitionId) => {
  const base = teamRun(42, kind === "cadenza" ? [kind] : [kind, "cadenza"]);
  for (const [healing, drawing, score] of [
    [false, false, undefined],
    [false, true, 200],
    [true, false, 3000],
    [true, true, 3000],
  ] as const) {
    const state = produce(base, (game) => {
      game.battle!.hand = game.cards.map((card) => card.id);
      game.battle!.draw = [];
      game.battle!.discard = [];
      game.battle!.buffer = [];
      for (const ally of game.team) ally.combat!.temporaryDodge = 70;
      if (healing) {
        game.team[0]!.health--;
        game.battle!.cardsPlayedThisTurn = 1;
      }
      if (drawing) {
        const drawn = game.cards.find((card) => card.definitionId === "tournelle-attack") ?? game.cards[0]!;
        game.battle!.hand = game.battle!.hand.filter((id) => id !== drawn.id);
        game.battle!.draw = [drawn.id];
      }
    });
    const card = state.cards.find((card) => card.definitionId === definitionId)!;
    const choice = rankedBattleChoices(state, false).find(
      (choice) => choice.command.type === "play" && choice.command.cardId === card.id,
    );
    expect(choice?.score).toBe(score);
    if (choice) expect(dispatch(state, choice.command).accepted).toBe(true);
  }
});

it("Purge retains its removal order and removes both kinds of Dodge together", () => {
  const removed: string[] = [];
  produce(teamRun(42, ["rookhaven"]), (game) => {
    const enemy = game.battle!.enemies[0]!;
    enemy.block = 1;
    Object.assign(enemy.combat, {
      armor: 1,
      thorns: 1,
      waterThorns: 1,
      fireThorns: 1,
      dodge: 1,
      temporaryDodge: 1,
      reflect: true,
      reflectBurn: true,
      nullify: true,
      nullifyFreeze: true,
      negate: true,
      attackReflection: true,
    });
    for (let index = 0; index < 12; index++) {
      const events: Parameters<typeof removeEffects>[3] = [];
      expect(removeEffects(enemy, "purge", 1, events, game)).toBe(1);
      removed.push(
        ...events.flatMap((event) =>
          event.kind === "status" && event.status === "purge" && event.affectedStatus
            ? [event.affectedStatus]
            : [],
        ),
      );
      if (index === 5) expect([enemy.combat.dodge, enemy.combat.temporaryDodge]).toEqual([0, 0]);
    }
  });
  expect(removed).toEqual([
    "block",
    "armor",
    "thorns",
    "waterThorns",
    "fireThorns",
    "dodge",
    "reflect",
    "reflect",
    "nullify",
    "nullify",
    "negate",
    "attackReflection",
  ]);
});

it.each(["none", "nullifyFreeze", "negate", "attackReflection"] as const)(
  "ordinary attack assessment preserves packet defenses with %s",
  (protection) => {
    const state = requireBattle(
      produce(teamRun(42, ["prismram"]), (game) => {
        game.battle!.hand = [game.cards[0]!.id];
        game.boons = ["sundering-charm", "crater-punch"];
        const enemy = game.battle!.enemies[0]!;
        enemy.block = 2;
        enemy.combat = { ...freshCombat(), armor: 5 };
        if (protection !== "none") enemy.combat[protection] = true;
      }),
    );
    const def = {
      ...attack("prismram", "Assessment", 6, "physical"),
      criticalWhenLastCard: true,
      alternateDamageType: "freeze" as const,
    };
    const before = encodeSave(state);
    const hits = ordinaryAttackFacts(state, state.team[0]!, def, 6, state.battle.enemies[0]!);
    const negated = protection === "negate" || protection === "attackReflection";
    expect(hits.map(({ lost, blocked, eroded, negated }) => ({ lost, blocked, eroded, negated }))).toEqual([
      { lost: negated ? 0 : 8, blocked: negated ? 0 : 2, eroded: negated ? 0 : 2, negated },
      { lost: protection === "none" ? 10 : 0, blocked: protection === "none" ? 2 : 0, eroded: 0, negated },
    ]);
    expect(encodeSave(state)).toBe(before);
  },
);

it.each(SPECIES)("preserves visible rankings and legal choices for $id", ({ id }) => {
  const rankings = ["ordinary", "injured", "defended", "talented"].map((condition) => {
    const state = produce(teamRun(42, [id]), (game) => {
      const battle = game.battle!;
      battle.hand = game.cards.map((card) => card.id);
      battle.draw = [];
      battle.buffer = [];
      battle.discard = [];
      if (condition === "talented") {
        game.talents = TALENTS.map((talent) => talent.id);
        game.keywordXP = Object.fromEntries(KEYWORDS.map((keyword) => [keyword, 1_000_000]));
        game.boons = BOONS.map((boon) => boon.id);
      }
      if (condition === "injured" || condition === "talented") {
        game.team[0]!.health = 1;
        game.team[0]!.combat!.poison = 2;
      }
      if (condition === "defended" || condition === "talented") {
        for (const enemy of battle.enemies) {
          enemy.block = 10;
          enemy.combat.armor = 4;
          enemy.combat.thorns = 2;
        }
      }
    });
    const saved = encodeSave(state);
    const ranked = rankedBattleChoices(state, false);
    for (const choice of ranked) expect(dispatch(state, choice.command).accepted).toBe(true);
    const hidden = produce(state, (game) => {
      game.rng ^= 0x7fffffff;
      game.battle!.draw.reverse();
      game.battle!.enemies.forEach((enemy) => enemy.deck?.draw.reverse());
    });
    expect(rankedBattleChoices(hidden, false)).toEqual(ranked);
    expect(rankedBattleChoices(decodeSave(saved), false)).toEqual(ranked);
    expect(encodeSave(state)).toBe(saved);
    return [condition, ranked.map((choice) => JSON.stringify(choice))];
  });
  expect(rankings).toMatchSnapshot();
});

it("ignores hidden draw order and RNG while ranking a partly hidden deck", () => {
  const state = teamRun(42, ["prismram", "emberback", "mossguard"]);
  expect(state.battle!.draw.length).toBeGreaterThan(1);
  const ranked = rankedBattleChoices(state, false);
  const saved = encodeSave(state);
  const hidden = produce(state, (game) => {
    game.rng ^= 0x7fffffff;
    game.battle!.draw.reverse();
  });
  expect(rankedBattleChoices(hidden, false)).toEqual(ranked);
  expect(encodeSave(state)).toBe(saved);
});
it("Auto-play prioritizes Bloom Cradle's healing over an ordinary attack", () => {
  const state = produce(teamRun(42, ["bloomquail", "emberback"]), (game) => {
    const heal = game.cards.find((card) => card.definitionId === "bloomquail-draw")!;
    const attack = game.cards.find((card) => card.definitionId === "emberback-attack")!;
    game.battle!.hand = [heal.id, attack.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards
      .filter((card) => !game.battle!.hand.includes(card.id))
      .map((card) => card.id);
    game.team[0]!.health = 1;
    game.battle!.enemies.forEach((enemy) => {
      enemy.health = enemy.maxHealth;
      enemy.block = 0;
      enemy.combat.armor = 0;
    });
  });
  const command = chooseBattleCommand(state, false);
  expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  expect(dispatch(state, command).state.team[0]!.health).toBe(3);
  const healthy = produce(state, (game) => {
    game.team[0]!.health = species("bloomquail").health;
  });
  expect(chooseBattleCommand(healthy, false)).toMatchObject({
    type: "play",
    cardId: healthy.battle!.hand[1],
  });
});

it("Auto-play preserves Mana when Undertow Knot cannot add Water Thorns", () => {
  const state = produce(teamRun(42, ["neradora"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === "neradora-undertow-knot")!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((card) => card.id);
    game.team[0]!.combat!.waterThorns = 1_000_000;
  });
  expect(chooseBattleCommand(state, false)).toEqual({ type: "endTurn" });
  const useful = produce(state, (game) => {
    game.team[0]!.combat!.waterThorns--;
  });
  const command = chooseBattleCommand(useful, false);
  expect(command).toMatchObject({ type: "play", cardId: useful.battle!.hand[0] });
  expect(dispatch(useful, command).state.team[0]!.combat!.waterThorns).toBe(1_000_000);
});

it.each(["reedstag", "chimecricket"] as const)(
  "Auto-play uses %s healing to Cleanse a full-health recipient",
  (kind) => {
    const state = produce(teamRun(42, [kind]), (game) => {
      const card = game.cards.find((card) => card.definitionId === `${kind}-heal`)!;
      game.battle!.hand = [card.id];
      game.battle!.buffer = [];
      game.battle!.discard = [];
      game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((card) => card.id);
      game.team[0]!.combat!.poison = 8;
    });
    const command = chooseBattleCommand(state, false);
    expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0]! });
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.combat!.poison).toBe(0);
    expect(result.state.team[0]!.health).toBe(state.team[0]!.health);
    const clean = produce(state, (game) => {
      game.team[0]!.combat!.poison = 0;
    });
    expect(chooseBattleCommand(clean, false)).toEqual({ type: "endTurn" });
  },
);

it.each(["mossguard-guard", "pollenmoth-teamGuard", "ringpalm-teamProtection"])(
  "Auto-play adds protection with %s even when existing Block exceeds the card value",
  (definitionId) => {
    const state = produce(teamRun(42, ["mossguard", "pollenmoth", "ringpalm"]), (game) => {
      const card = game.cards.find((card) => card.definitionId === definitionId)!;
      game.battle!.hand = [card.id];
      game.battle!.buffer = [];
      game.battle!.discard = [];
      game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((card) => card.id);
      for (const ally of game.team) {
        ally.block = 10;
        ally.combat!.thorns = 10;
      }
    });
    const command = chooseBattleCommand(state, false);
    expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0]! });
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.block + result.state.team[0]!.combat!.thorns).toBeGreaterThan(
      state.team[0]!.block + state.team[0]!.combat!.thorns,
    );
    expect(result.state.battle!.turn).toBe(state.battle!.turn);
    expect(state.team[0]!.block).toBe(10);
    const capped = produce(state, (game) => {
      for (const ally of game.team) {
        ally.block = 1_000_000;
        ally.combat!.thorns = 1_000_000;
      }
    });
    expect(chooseBattleCommand(capped, false)).toEqual({ type: "endTurn" });
  },
);

it("Auto-play avoids recovering Echoes Remember itself or a knocked-out owner's card", () => {
  const state = produce(teamRun(42, ["cadenza", "mossguard"]), (game) => {
    const recover = game.cards.find((card) => card.definitionId === "cadenza-echoes-remember")!;
    game.battle!.hand = [recover.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => card.id !== recover.id).map((card) => card.id);
  });
  expect(chooseBattleCommand(state, false)).toEqual({ type: "endTurn" });
  const useful = produce(state, (game) => {
    game.battle!.discard.push(game.battle!.draw.pop()!);
  });
  expect(chooseBattleCommand(useful, false)).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const inert = produce(useful, (game) => {
    game.team[1]!.health = 0;
  });
  expect(chooseBattleCommand(inert, false)).toEqual({ type: "endTurn" });
});

it("does not treat one lethal branch of a random damage type as a battle finish", () => {
  const state = produce(teamRun(42, ["cindernewt", "mossguard"]), (game) => {
    const attack = game.cards.find((card) => card.definitionId === "cindernewt-attack")!;
    const heal = game.cards.find((card) => card.definitionId === "mossguard-heal")!;
    game.battle!.hand = [attack.id, heal.id];
    game.team[0]!.health = 5;
    game.battle!.enemies.forEach((enemy, index) => {
      enemy.health = index ? 0 : 3;
      enemy.block = 0;
      enemy.combat.armor = 100;
    });
  });
  expect(chooseBattleCommand(state, false)).toMatchObject({ type: "play", cardId: state.battle!.hand[1] });
  const both = produce(state, (game) => {
    game.battle!.enemies[0]!.combat.armor = 0;
  });
  expect(chooseBattleCommand(both, false)).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
});

it.each([
  ["bloomquail", "health.overflow"],
  ["reedstag", "health.overflow"],
  ["bloomquail", "health.clean-slate"],
] as const)(
  "Auto-play uses %s full-health healing for %s and stops when it has no benefit",
  (kind, talent) => {
    const state = produce(teamRun(42, [kind]), (game) => {
      const heal = game.cards.find((card) => card.definitionId === `${kind}-heal`)!;
      game.battle!.hand = [heal.id];
      game.battle!.buffer = [];
      game.battle!.discard = [];
      game.battle!.draw = game.cards.filter((card) => card.id !== heal.id).map((card) => card.id);
      game.talents = [talent];
      for (const enemy of game.battle!.enemies) enemy.combat.blind = true;
      if (talent === "health.clean-slate") {
        game.team[0]!.combat!.poison = 2;
      }
    });
    const command = chooseBattleCommand(state, false);
    expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    if (talent === "health.overflow")
      expect(result.state.team[0]!.block).toBeGreaterThan(state.team[0]!.block);
    else expect(result.state.team[0]!.combat!.poison).toBe(0);
    const spent = produce(state, (game) => {
      game.team[0]!.combat!.burn = 0;
      game.team[0]!.combat!.poison = 0;
      game.team[0]!.block = 1_000_000;
    });
    expect(chooseBattleCommand(spent, false)).toEqual({ type: "endTurn" });
  },
);

it("finishes the last enemy before healing or killing a Minion, without sampling RNG", () => {
  const state = produce(teamRun(42, ["prismram", "mossguard"]), (game) => {
    const attack = game.cards.find((card) => card.definitionId === "prismram-attack")!;
    const heal = game.cards.find((card) => card.definitionId === "mossguard-heal")!;
    game.battle!.hand = [heal.id, attack.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards
      .filter((card) => !game.battle!.hand.includes(card.id))
      .map((card) => card.id);
    game.team.forEach((unit) => {
      unit.health = 5;
    });
    game.battle!.enemies.forEach((enemy, index) => {
      enemy.health = index ? 0 : 3;
      enemy.block = 0;
      enemy.combat.armor = 0;
    });
    const boss = game.battle!.enemies[0]!;
    game.battle!.minions = [
      {
        ...boss,
        id: "echo",
        name: "Echo",
        species: "memento",
        power: 1,
        targetId: boss.id,
        lastAbility: null,
        health: 1,
        maxHealth: 6,
        minion: { ownerId: boss.id, side: "enemy" },
      },
    ];
  });
  const before = JSON.stringify(state);
  const chosen = chooseBattleCommand(state, false);
  expect(chosen).toMatchObject({
    type: "play",
    cardId: state.battle!.hand[1],
    targetId: state.battle!.enemies[0]!.id,
  });
  expect(
    chooseBattleCommand(
      produce(state, (draft) => {
        draft.rng = 1;
      }),
      false,
    ),
  ).toEqual(chosen);
  expect(JSON.stringify(state)).toBe(before);
  expect(dispatch(state, chosen).state.phase).not.toBe("battle");
});

it("Purges Armor before a fully blocked attack and still values attacks that deplete Block", () => {
  const state = produce(teamRun(42, ["prismram", "rookhaven"]), (game) => {
    const ids = ["prismram-attack", "rookhaven-unwritten-ending"].map(
      (id) => game.cards.find((card) => card.definitionId === id)!.id,
    );
    game.battle!.hand = ids;
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => !ids.includes(card.id)).map((card) => card.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.combat.armor = 100;
      enemy.block = 0;
    });
  });
  const chosen = chooseBattleCommand(state, false);
  expect(chosen).toMatchObject({ type: "play", cardId: state.battle!.hand[1] });
  const purged = dispatch(state, chosen);
  expect(purged.accepted).toBe(true);
  expect(chooseBattleCommand(purged.state, false)).toMatchObject({
    type: "play",
    cardId: state.battle!.hand[0],
  });
  const inert = produce(state, (game) => {
    game.battle!.hand = [game.battle!.hand[0]!];
  });
  expect(chooseBattleCommand(inert, false)).toEqual({ type: "endTurn" });
  const eroding = produce(inert, (game) => {
    game.boons = ["sundering-charm"];
  });
  expect(chooseBattleCommand(eroding, false)).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const block = produce(inert, (game) => {
    game.battle!.enemies[0]!.block = 20;
  });
  expect(chooseBattleCommand(block, false)).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
});

it("restores missing deployed damage instead of choosing the first support backup", () => {
  const state = produce(teamRun(42, ["mossguard", "cadenza"]), (game) => {
    game.team[0]!.health = 0;
    game.reserves = [
      { ...game.team[1]!, id: "a-support" },
      { ...game.team[0]!, id: "z-attacker", species: "emberback", health: 20 },
    ];
  });
  const selected = chooseBattleCommand(state, false);
  expect(selected).toMatchObject({ type: "swap", reserve: "z-attacker" });
  const result = dispatch(state, selected);
  expect(result.accepted).toBe(true);
  expect(result.state.team.some((unit) => unit.species === "emberback" && unit.health > 0)).toBe(true);
});

it("favors a healthy complementary backup when deployed damage is already available", () => {
  const state = produce(teamRun(42, ["mossguard", "prismram"]), (game) => {
    game.team[0]!.health = 0;
    game.reserves = [
      { ...game.team[0]!, id: "a-attacker", species: "emberback", health: 1 },
      { ...game.team[0]!, id: "z-support", species: "cadenza", health: 28 },
    ];
  });
  expect(chooseBattleCommand(state, false)).toMatchObject({ type: "swap", reserve: "z-support" });
});

it("Auto-play Blinds new Echoes even when their summoner is already Blind", () => {
  const destination = produce(teamRun(42, ["glintstride"]), (game) => {
    prepareDestination(game);
    game.encounter = 3;
    game.journey!.victories = 3;
    game.expedition = { pack: authoredPack(3), recruit: null, lastRoom: "boss" };
  });
  const state = produce(requireBattle(accept(destination, { type: "beginBattle" })), (game) => {
    const card = game.cards.find((card) => card.definitionId === "glintstride-teamBlind")!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    const boss = game.battle!.enemies[0]!;
    boss.combat.blind = true;
    summonEcho(game, boss, "enemy", 6, []);
  });
  const command = chooseBattleCommand(state, false);
  expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.minions![0]!.combat.blind).toBe(true);
});

it("Auto-play uses Mushroom Guard's healing at the Block cap and stops at full Health", () => {
  const state = produce(teamRun(42, ["captoad"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === "captoad-guard")!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    game.team[0]!.block = 1_000_000;
    game.team[0]!.health -= 5;
  });
  const command = chooseBattleCommand(state, false);
  expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.health).toBe(state.team[0]!.health + 3);
  expect(result.state.team[0]!.block).toBe(1_000_000);
  const healthy = produce(state, (game) => {
    game.team[0]!.health += 5;
  });
  expect(chooseBattleCommand(healthy, false)).toEqual({ type: "endTurn" });
});

it("Auto-play values Mushroom Guard's healing ahead of ordinary group protection", () => {
  const state = produce(teamRun(42, ["captoad", "pollenmoth"]), (game) => {
    game.battle!.hand = game.cards
      .filter((card) => ["captoad-guard", "pollenmoth-teamGuard"].includes(card.definitionId))
      .map((card) => card.id);
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards
      .filter((card) => !game.battle!.hand.includes(card.id))
      .map((card) => card.id);
    game.team[0]!.health = 1;
  });
  expect(chooseBattleCommand(state, false)).toMatchObject({
    type: "play",
    cardId: state.cards.find((card) => card.definitionId === "captoad-guard")!.id,
  });
});

it("Auto-play uses Nightmare Harvest for actual afflictions and preserves Mana when none remain", () => {
  const healthy = produce(teamRun(42, ["reverie", "emberback"]), (game) => {
    const card = game.cards.find((c) => c.definitionId === "reverie-nightmare-harvest")!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((c) => c.id !== card.id).map((c) => c.id);
  });
  expect(chooseBattleCommand(healthy, false)).toEqual({ type: "endTurn" });
  const afflicted = produce(healthy, (game) => {
    game.team[1]!.combat!.poison = 30;
  });
  expect(chooseBattleCommand(afflicted, false)).toMatchObject({
    type: "play",
    cardId: afflicted.battle!.hand[0],
  });
});

it("Auto-play spends an attack to consume Negate without predicting a blocked final blow", () => {
  const game = produce(teamRun(42, ["glintstride"]), (d) => {
    const card = d.cards.find((c) => c.definitionId === "glintstride-attack")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.buffer = [];
    d.battle!.discard = [];
    d.battle!.enemies.forEach((enemy, index) => {
      enemy.health = index === 0 ? 1 : 0;
      enemy.block = 0;
      enemy.combat.negate = index === 0;
    });
  });
  const command = chooseBattleCommand(game, false);
  expect(command).toMatchObject({ type: "play", cardId: game.battle!.hand[0] });
  const result = dispatch(game, command);
  expect(result.accepted).toBe(true);
  expect(result.state.phase).toBe("battle");
  expect(result.state.battle!.enemies[0]!.health).toBe(1);
  expect(result.state.battle!.enemies[0]!.combat.negate).toBe(false);
});

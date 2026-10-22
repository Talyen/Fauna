import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, definition, FIRST_RUN_STARTERS, species } from "../../../src/game/content";
import { freshCombat, hit } from "../../../src/game/combat";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { definitionKeywords } from "../../../src/game/keywords";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { battleChoices } from "../../../src/application/battle-policy";
import type { GameEvent } from "../../../src/game/types";
import { accept, teamRun, winBattle } from "../../support/game";

function ready(id = "ringpalm-attack", seed = 1, copies = 1) {
  return produce(teamRun(1, ["ringpalm", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.ringpalm = copies;
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    for (const enemy of game.battle!.enemies) {
      enemy.block = 0;
      enemy.combat = freshCombat();
    }
    game.rng = seed;
  });
}
const play = (game: ReturnType<typeof ready>, targetId?: string) =>
  dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId, autoEndTurn: false });

function seedFor(predicate: (rolls: number[]) => boolean) {
  for (let seed = 0; seed < 100_000; seed++) {
    let rng = seed;
    const rolls = Array.from({ length: 12 }, () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng / 4294967296;
    });
    if (predicate(rolls)) return seed;
  }
  throw new Error("No seed found for the requested outcome");
}
const damage = (events: GameEvent[], actorId = "ally-0") =>
  events.filter(
    (event) => event.kind === "damage" && event.actorId === actorId && event.damageType === "stun",
  );

it("plays the approved one-Mana kit with detached previews and current-format resume", () => {
  const kit = CARDS.filter((card) => card.species === "ringpalm");
  expect(kit.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Deal 6 Stun damage"],
    [1, "Deal 1 Stun damage to all enemies; Gain 1 Armor; 20% chance to repeat"],
    [1, "Grant all allies 2 Block or Thorns"],
  ]);
  expect(kit.map(definitionKeywords)).toEqual([["stun"], ["stun", "armor"], ["block", "nature"]]);
  for (const card of kit) {
    const game = ready(card.id);
    const targetId = card.id === "ringpalm-attack" ? "enemy-0" : undefined;
    const original = encodeSave(game);
    const result = play(game, targetId);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, game.battle!.hand[0]!, targetId)).toEqual(result);
    expect(encodeSave(game)).toBe(original);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    if (card.id === "ringpalm-attack")
      expect(damage(result.events).map((event) => event.amount)).toEqual([6]);
    else
      expect(battleChoices(game, false)).toContainEqual({
        type: "play",
        cardId: game.battle!.hand[0]!,
        autoEndTurn: false,
      });
  }
  expect(() => decodeSave(JSON.stringify({ ...ready(), version: 35 }))).toThrow();
});

it.each([10, 20, 30, 40, 50, 60])(
  "rolls exactly %i percent Resonance independently on every Stun packet",
  (percent) => {
    const chance = percent / 100;
    for (const repeats of [false, true]) {
      const seed = seedFor(([roll]) =>
        repeats ? roll! >= chance - 0.001 && roll! < chance : roll! >= chance && roll! < chance + 0.001,
      );
      const events: GameEvent[] = [];
      produce(ready("ringpalm-attack", seed, percent / 10), (game) => {
        const source = game.team[0]!,
          target = game.battle!.enemies[0]!;
        // Supplemental Stun skips Dodge/Critical rolls, isolating the exact passive threshold.
        hit(game, source, target, 2, "stun", events, { origin: "proc" as const });
        expect(target.health).toBe(target.maxHealth - (repeats ? 4 : 2));
        expect(target.combat.stun).toBe(repeats ? 4 : 2);
        expect(game.battleXP.stun).toBeUndefined();
      });
      expect(damage(events)).toHaveLength(repeats ? 2 : 1);
    }
    expect(species("ringpalm").passiveTiers[percent / 10 - 1]!.description).toBe(
      `Ringpalm’s Stun damage has a ${percent}% chance to repeat`,
    );
  },
);

it("rolls Resonance separately for area targets and never repeats Armor with its damage", () => {
  // No intrinsic repeat; target 1 resonates, target 2 does not, target 3 resonates.
  const seed = seedFor(
    (r) =>
      r[0]! >= 0.2 &&
      [1, 2, 4, 5, 7, 8].every((i) => r[i]! > 0.05) &&
      r[3]! < 0.6 &&
      r[6]! >= 0.6 &&
      r[9]! < 0.6,
  );
  const result = play(ready("ringpalm-harmonic-set", seed, 6));
  expect(
    [0, 1, 2].map((i) => damage(result.events).filter((event) => event.targetId === `enemy-${i}`).length),
  ).toEqual([2, 1, 2]);
  expect(result.state.team[0]!.combat!.armor).toBe(1);
  expect(result.state.battleXP).toMatchObject({ stun: 1, armor: 1 });
});

it("repeats all of Harmonic Set once, charging Mana and granting accepted-play XP once", () => {
  const seed = seedFor(([roll]) => roll! < 0.2);
  const game = ready("ringpalm-harmonic-set", seed, 6);
  const result = play(game);
  expect(result.state.team[0]!.combat!.armor).toBe(2);
  expect(result.events.filter((event) => event.text === "Ringpalm repeats Harmonic Set")).toHaveLength(1);
  expect(damage(result.events).length).toBeGreaterThanOrEqual(6);
  expect(damage(result.events).length).toBeLessThanOrEqual(12);
  expect(result.state.battle!.mana).toBe(3);
  expect(result.state.battle!.cardsPlayedThisTurn).toBe(1);
  expect(result.state.battleXP).toMatchObject({ stun: 1, armor: 1 });
  expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
});

it("caps intrinsic and talent ability repeats together while allowing their independent damage repeats", () => {
  const seed = seedFor(([ability, talent]) => ability! < 0.2 && talent! < 0.1);
  const game = produce(ready("ringpalm-harmonic-set", seed, 6), (draft) => {
    draft.talents = ["stun.jarring-blow"];
  });
  const result = play(game);
  expect(result.state.team[0]!.combat!.armor).toBe(2);
  expect(damage(result.events).length).toBeLessThanOrEqual(12);
  expect(result.state.battle!.cardsPlayedThisTurn).toBe(1);
});

it.each(["actor", "enemies"] as const)("stops Harmonic Set repeats when the %s fall", (fallen) => {
  const seed = seedFor(([ability, dodge]) => ability! < 0.2 && dodge! > 0.05);
  const game = produce(ready("ringpalm-harmonic-set", seed, 6), (draft) => {
    if (fallen === "actor") {
      draft.team[0]!.health = 1;
      draft.team[0]!.combat!.deathDoorUsed = true;
      draft.battle!.enemies[0]!.combat.thorns = 2;
    } else {
      draft.battle!.enemies[0]!.health = 1;
      draft.battle!.enemies[1]!.health = 0;
      draft.battle!.enemies[2]!.health = 0;
    }
  });
  const result = play(game);
  expect(damage(result.events)).toHaveLength(1);
  expect(result.events.some((event) => event.text === "Ringpalm repeats Harmonic Set")).toBe(false);
  expect(result.events.filter((event) => event.status === "armor" && event.outcome === "gain")).toHaveLength(
    fallen === "actor" ? 0 : 1,
  );
  if (fallen === "actor") expect(result.state.team[0]!.health).toBe(0);
});

it("applies Armor separately to the repeated base packet and allows its Stun to cross the control threshold", () => {
  const seed = seedFor(([roll]) => roll! < 0.1);
  produce(ready("ringpalm-attack", seed), (game) => {
    const source = game.team[0]!,
      target = game.battle!.enemies[0]!;
    target.health = target.maxHealth = 18;
    target.combat.armor = 1;
    hit(game, source, target, 5, "stun", [], { origin: "proc" as const });
    expect(target.health).toBe(9);
    expect(target.combat.controlled).toBe("stun");
    expect(target.combat.armor).toBe(0);
  });
});

it.each(["miss", "block", "armor", "kill", "actorKnockout", "derived", "periodic", "retaliation"] as const)(
  "does not roll Resonance for %s",
  (mode) => {
    const seed = seedFor(([roll]) => roll! > 0.05 && roll! < 0.1);
    const events: GameEvent[] = [];
    produce(ready("ringpalm-attack", seed, 6), (game) => {
      const source = game.team[0]!,
        target = game.battle!.enemies[0]!;
      if (mode === "block") target.block = 20;
      if (mode === "armor") target.combat.armor = 20;
      if (mode === "kill") target.health = 1;
      if (mode === "actorKnockout") {
        source.health = 1;
        source.combat!.deathDoorUsed = true;
        target.combat.thorns = 10;
      }
      const proc = mode !== "miss" && mode !== "actorKnockout";
      hit(
        game,
        source,
        target,
        2,
        "stun",
        events,
        mode === "derived" || mode === "periodic" || mode === "retaliation"
          ? { origin: mode }
          : proc
            ? { origin: "proc" as const }
            : { origin: "ability", blindMiss: mode === "miss" },
      );
      expect(events.some((event) => event.text.includes("with Resonance"))).toBe(false);
      if (mode === "actorKnockout") expect(source.health).toBe(0);
      if (proc) expect(game.rng).toBe(seed);
    });
  },
);

it("does not recurse Resonance, reroll Critical or Dodge, or trigger Thorns on repeated damage", () => {
  const seed = seedFor((r) => r[0]! > 0.05 && r[1]! < 0.05 && r[2]! < 0.6 && r[3]! < 0.6);
  const events: GameEvent[] = [];
  produce(ready("ringpalm-attack", seed, 6), (game) => {
    const source = game.team[0]!,
      target = game.battle!.enemies[0]!;
    target.combat.thorns = 2;
    hit(game, source, target, 2, "stun", events);
    expect(damage(events).map((event) => [event.amount, event.critical])).toEqual([
      [4, true],
      [2, false],
    ]);
    expect(source.health).toBe(28);
    expect(target.combat.thorns).toBe(1);
  });
});

it.each([true, false])(
  "Seedling Circle shares one %s Block roll with living deployed allies only",
  (block) => {
    const seed = seedFor(([roll]) => roll! < 0.5 === block);
    const game = produce(ready("ringpalm-teamProtection", seed), (draft) => {
      draft.team[2]!.health = 0;
      draft.reserves.push({ ...draft.team[1]!, id: "backup", combat: freshCombat() });
      draft.roster.push("mossguard");
      if (!block) for (const unit of draft.team) unit.block = 10;
    });
    const result = play(game);
    expect(result.state.team.map((unit) => (block ? unit.block : unit.combat!.thorns))).toEqual([2, 2, 0]);
    expect(result.state.reserves[0]!.block).toBe(0);
    expect(result.state.reserves[0]!.combat!.thorns).toBe(0);
    expect(result.state.battle!.enemies.every((unit) => unit.block === 0 && unit.combat.thorns === 0)).toBe(
      true,
    );
    expect(result.state.battleXP).toMatchObject({ block: 1, nature: 1 });
    const activeGame = produce(game, (draft) => {
      draft.team[2]!.health = 1;
    });
    expect(battleChoices(activeGame, false)).toContainEqual({
      type: "play",
      cardId: game.battle!.hand[0]!,
      autoEndTurn: false,
    });
    expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  },
);

it("rejects invalid or unaffordable plays without spending RNG and retains the same rolls through swaps and resume", () => {
  const game = ready();
  expect(play(game).state).toBe(game);
  const empty = produce(game, (draft) => {
    draft.battle!.mana = 0;
  });
  expect(play(empty, "enemy-0").state).toBe(empty);
  let swapped = produce(game, (draft) => {
    draft.reserves.push({ ...draft.team[1]!, id: "backup", combat: freshCombat() });
    draft.roster.push("mossguard");
  });
  swapped = accept(swapped, { type: "swap", activeId: "ally-0", reserve: "backup" });
  swapped = decodeSave(encodeSave(swapped));
  swapped = accept(swapped, { type: "swap", activeId: "backup", reserve: "ally-0" });
  expect(swapped.rng).toBe(game.rng);
  const resumed = decodeSave(encodeSave(swapped));
  expect(play(resumed, "enemy-0")).toEqual(play(swapped, "enemy-0"));
});

it("offers Ringpalm as a starter and discovers and recruits it through ordinary encounters", () => {
  expect(FIRST_RUN_STARTERS).toContain("ringpalm");
  const initial = createGame(7);
  let game = accept(
    accept(initial, { type: "draft", species: initial.starterOffers.find((kind) => kind !== "ringpalm")! }),
    { type: "start" },
  );
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = COMBAT_PACKS.findIndex((pack) => pack[0] === "ringpalm");
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("ringpalm");
  expect(game.battle!.enemies[0]!.species).toBe("ringpalm");
  game = accept(winBattle(game), { type: "recruit", species: "ringpalm" });
  expect(game.discovery.recruited.ringpalm).toBe(1);
  expect(game.cards.filter((card) => definition(card.definitionId).species === "ringpalm")).toHaveLength(3);
  expect(decodeSave(encodeSave(game))).toEqual(game);
});

it.each(["Ringclap", "Harmonic Set", "Seedling Circle"])(
  "enemy %s uses the base passive and protects only its own side",
  (name) => {
    const seed = seedFor(
      (r) =>
        Math.floor(r[0]! * 3) === ["Ringclap", "Harmonic Set", "Seedling Circle"].indexOf(name) &&
        (name !== "Harmonic Set" || r[1]! < 0.2),
    );
    const game = produce(ready("ringpalm-teamProtection", seed, 6), (draft) => {
      const enemy = draft.battle!.enemies[0]!;
      enemy.species = "ringpalm";
      enemy.name = "Ringpalm";
      enemy.power = 1;
      for (const other of draft.battle!.enemies.slice(1)) {
        other.combat.controlled = "freeze";
        other.combat.controlTurns = 1;
      }
    });
    const result = dispatch(game, { type: "endTurn" });
    expect(
      result.events.some((event) => event.actorId === "enemy-0" && event.text.includes(`uses ${name}`)),
    ).toBe(true);
    if (name === "Harmonic Set") expect(result.state.battle!.enemies[0]!.combat.armor).toBe(2);
    if (name === "Seedling Circle") {
      expect(
        result.events
          .filter((event) => (event.kind === "block" && (event.amount ?? 0) > 0) || event.status === "thorns")
          .every((event) => event.targetId?.startsWith("enemy-")),
      ).toBe(true);
    }
    // Enemy rank is always 10%, even with the player's six collected copies.
    const events: GameEvent[] = [];
    const noRepeat = seedFor(([roll]) => roll! > 0.1 && roll! < 0.6);
    produce(game, (draft) => {
      draft.rng = noRepeat;
      hit(draft, draft.battle!.enemies[0]!, draft.team[0]!, 2, "stun", events, { origin: "proc" as const });
    });
    expect(damage(events, "enemy-0")).toHaveLength(1);
  },
);

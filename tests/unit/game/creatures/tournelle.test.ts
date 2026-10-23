import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { definition, species } from "../../../../src/game/content";
import { cardText, enemyCanUse } from "../../../../src/game/card-rules";
import { cardKeywords } from "../../../../src/game/progression";
import { freshCombat, hit } from "../../../../src/game/combat/index";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { authoredPack, accept, prepareDestination, teamRun } from "../../../support/game";
import { COMBAT_PACKS } from "../../../../src/game/encounters";
import type { GameEvent } from "../../../../src/game/types";

function fixture(ability = "tournelle-teamClearBlind") {
  return produce(teamRun(42, ["tournelle", "emberback", "prismram"]), (d) => {
    const card = d.cards.find((c) => c.definitionId === ability)!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.buffer = [];
    d.battle!.discard = [];
    d.battle!.enemies.forEach((enemy) => {
      enemy.health = enemy.maxHealth;
      enemy.block = 0;
      enemy.combat = freshCombat();
    });
    d.rng = 42;
  });
}
function play(game: ReturnType<typeof fixture>, targetId?: string) {
  return dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId, autoEndTurn: false });
}

describe("Tournelle", () => {
  it("authors six complete Gallantry tiers and the selected concise rules at one Mana", () => {
    expect(species("tournelle").passiveTiers.map((tier) => tier.effects)).toEqual(
      [10, 20, 30, 40, 50, 60].map((amount) => [{ kind: "gallantry", amount }]),
    );
    for (const [id, text] of [
      ["tournelle-teamClearBlind", "Cleanse allies Blind / Draw a Light card"],
      ["tournelle-attack", "Deal 4 Light damage / Doubled against enemies with more Health than you"],
      ["tournelle-swapLowest", "Swap out the lowest Health ally / Draw a Card"],
    ]) {
      expect(cardText(definition(id!))).toBe(text);
      expect(definition(id!).cost).toBe(1);
    }
    expect(cardKeywords({ definitionId: "tournelle-teamClearBlind" })).toEqual(["health"]);
    expect(enemyCanUse(definition("tournelle-teamClearBlind"))).toBe(true);
    expect(enemyCanUse(definition("tournelle-swapLowest"))).toBe(false);
  });
  it("cleanses only deployed allies' Blind, grants actual Cleanse rewards and tutors a Light card", () => {
    const game = produce(fixture(), (d) => {
      d.boons = ["sin-eaters-lantern"];
      for (const ally of d.team) {
        ally.health -= 7;
        ally.combat!.blind = true;
        ally.combat!.poison = 2;
      }
      d.team[1]!.combat!.controlled = "freeze";
      d.team[1]!.combat!.controlTurns = 1;
      d.team[1]!.combat!.freeze = 10;
    });
    const preview = previewCard(game, game.battle!.hand[0]!);
    const result = play(game);
    expect(result.accepted).toBe(true);
    expect(result.state).toEqual(preview.state);
    expect(result.state.team.every((c) => !c.combat!.blind && c.combat!.poison === 2)).toBe(true);
    expect(result.state.team[1]!.combat!.controlled).toBe("freeze");
    expect(result.state.team.map((c) => c.health)).toEqual(game.team.map((c) => c.health + 6));
    const drawn = result.state.cards.find((c) => c.id === result.state.battle!.hand[0])!;
    expect(cardKeywords(drawn)).toContain("light");
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
  it("does not substitute an ordinary draw when no eligible Light card remains", () => {
    const game = produce(fixture(), (d) => {
      const light = d.cards.filter((c) => cardKeywords(c).includes("light")).map((c) => c.id);
      d.battle!.buffer = light;
      d.battle!.draw = d.battle!.draw.filter((id) => !light.includes(id));
    });
    const before = [...game.battle!.hand, ...game.battle!.buffer].slice(1);
    const result = play(game).state;
    expect([...result.battle!.hand, ...result.battle!.buffer]).toEqual(before);
  });
  it.each([29, 30, 31])(
    "doubles Valiant Challenge only against strictly greater current Health (%i)",
    (health) => {
      const game = produce(fixture("tournelle-attack"), (d) => {
        d.battle!.enemies[0]!.health = health;
        d.battle!.enemies[0]!.maxHealth = 40;
      });
      const result = play(game, game.battle!.enemies[0]!.id);
      expect(result.state.battle!.enemies[0]!.health).toBe(health - (health > 30 ? 8 : 4));
      expect(result.state).toEqual(
        previewCard(game, game.battle!.hand[0]!, game.battle!.enemies[0]!.id).state,
      );
    },
  );
  it("upgrades the base attack before doubling and retains its base rule text", () => {
    const game = produce(fixture("tournelle-attack"), (d) => {
      d.cards.find((c) => c.id === d.battle!.hand[0])!.level = 1;
      d.team[0]!.health = 20;
    });
    const next = play(game, game.battle!.enemies[0]!.id).state;
    expect(next.battle!.enemies[0]!.health).toBe(game.battle!.enemies[0]!.health - 12);
  });
  it("swaps the lowest current-Health ally before drawing, retaining effects and the new formation", () => {
    const game = produce(fixture("tournelle-swapLowest"), (d) => {
      d.reserves.push({
        id: "backup",
        species: "mossguard",
        health: 25,
        block: 2,
        attacked: false,
        combat: freshCombat(),
      });
      d.team[1]!.health = 8;
      d.team[1]!.combat!.poison = 3;
      d.team[2]!.health = 9;
      d.battle!.hand.push(d.cards.find((c) => c.ownerId === "ally-1")!.id);
      d.battle!.draw = d.battle!.draw.filter((id) => !d.battle!.hand.includes(id));
    });
    const result = play(game);
    expect(result.state.team[1]!.id).toBe("backup");
    expect(result.state.reserves.find((c) => c.id === "ally-1")!.combat!.poison).toBe(3);
    expect(result.state.cards.some((c) => c.ownerId === "ally-1")).toBe(false);
    expect(result.state.battle!.hand).toHaveLength(1);
    expect(result.events.findIndex((e) => e.kind === "action" && e.actionType === "swap")).toBeGreaterThan(0);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
  it("still draws without a backup, without moving allies or consuming selection RNG", () => {
    const game = fixture("tournelle-swapLowest");
    const next = play(game).state;
    expect(next.team.map((c) => c.id)).toEqual(game.team.map((c) => c.id));
    expect(next.battle!.hand).toHaveLength(1);
    expect(next.rng).toBe(game.rng);
  });
  it("can swap Tournelle itself and still complete the draw", () => {
    const game = produce(fixture("tournelle-swapLowest"), (d) => {
      d.team[0]!.health = 1;
      d.reserves.push({
        id: "backup",
        species: "mossguard",
        health: 20,
        block: 0,
        attacked: false,
        combat: freshCombat(),
      });
    });
    const result = play(game);
    expect(result.state.team[0]!.id).toBe("backup");
    expect(result.state.battle!.hand).toHaveLength(1);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
  it("intercepts once, resolves defenses and statuses on Tournelle, and leaves the ally untouched", () => {
    const events: GameEvent[] = [];
    const game = produce(fixture(), (d) => {
      d.team[1]!.health = 10;
      d.rng = 1972;
      hit(d, d.battle!.enemies[0]!, d.team[1]!, 6, "poison", events, { origin: "ability" });
    });
    expect(game.team[1]!.health).toBe(10);
    expect(game.team[1]!.combat!.poison).toBe(0);
    expect(game.team[0]!.health).toBe(24);
    expect(game.team[0]!.combat!.poison).toBe(6);
    expect(events.filter((e) => e.text.includes("intercepts"))).toHaveLength(1);
  });
  it("does not intercept equal injury, periodic damage, or while knocked out or in backup", () => {
    for (const mode of ["equal", "periodic", "knockout", "backup"]) {
      const events: GameEvent[] = [];
      const game = produce(fixture(), (d) => {
        d.team[1]!.health = mode === "equal" ? species("emberback").health : 10;
        if (mode === "knockout") d.team[0]!.health = 0;
        if (mode === "backup") {
          const unit = d.team.shift()!;
          d.reserves.push(unit);
        }
        const target = d.team.find((c) => c.id === "ally-1")!;
        hit(d, d.battle!.enemies[0]!, target, 2, "light", events, {
          origin: mode === "periodic" ? "periodic" : "ability",
        });
      });
      expect(
        events.some((e) => e.text.includes("intercepts")),
        mode,
      ).toBe(false);
      expect(game.team.find((c) => c.id === "ally-1")!.health).toBeLessThan(
        mode === "equal" ? species("emberback").health : 10,
      );
    }
  });
  it("checks relative injury rather than absolute Health and persists no temporary interception state", () => {
    const events: GameEvent[] = [];
    const initial = produce(teamRun(42, ["tournelle", "mossguard", "prismram"]), (d) => {
      d.team[0]!.health = 20;
      d.team[1]!.health = 21;
      d.rng = 1972;
    });
    const game = produce(decodeSave(encodeSave(initial)), (d) => {
      hit(d, d.battle!.enemies[0]!, d.team[1]!, 2, "light", events, { origin: "ability" });
    });
    expect(events.some((e) => e.text.includes("intercepts"))).toBe(true);
    expect(game.team[0]!.health).toBe(18);
    expect(game.team[1]!.health).toBe(21);
  });
  it.each([0, 1, 2, 3, 4, 5])("uses the actual Gallantry chance at rank %i", (rank) => {
    for (const [seed, bucket] of [
      [2358, 1],
      [36, 2],
      [294, 3],
      [552, 4],
      [810, 5],
      [1068, 6],
    ]) {
      const events: GameEvent[] = [];
      produce(fixture(), (draft) => {
        draft.discovery.recruited.tournelle = rank + 1;
        draft.team[1]!.health = 10;
        draft.rng = seed!;
        hit(draft, draft.battle!.enemies[0]!, draft.team[1]!, 2, "light", events);
      });
      expect(events.some((event) => event.text.includes("intercepts"))).toBe(bucket! <= rank);
    }
  });
  it("uses base-tier Gallantry for enemies regardless of the player's collection rank", () => {
    const destination = produce(fixture(), (draft) => {
      prepareDestination(draft);
      draft.encounter = 2;
      draft.journey!.victories = 2;
      draft.expedition = {
        pack: authoredPack(
          draft.encounter,
          COMBAT_PACKS.findIndex((pack) => pack[1] === "tournelle"),
        ),
        recruit: null,
        lastRoom: null,
      };
      draft.discovery.recruited.tournelle = 6;
    });
    const game = accept(destination, { type: "beginBattle" });
    for (const [seed, expected] of [
      [1972, true],
      [2358, false],
    ] as const) {
      const events: GameEvent[] = [];
      produce(game, (draft) => {
        draft.battle!.enemies[0]!.health = 10;
        draft.rng = seed;
        hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 2, "light", events);
      });
      expect(events.some((event) => event.text.includes("intercepts"))).toBe(expected);
    }
  });
  it.each(["tournelle", "prismram"] as const)(
    "resolves an accepted %s attack and its follow-ups against the interceptor",
    (kind) => {
      const destination = produce(teamRun(42, [kind, "mossguard", "emberback"]), (draft) => {
        prepareDestination(draft);
        draft.encounter = 2;
        draft.journey!.victories = 2;
        draft.expedition = {
          pack: authoredPack(
            draft.encounter,
            COMBAT_PACKS.findIndex((pack) => pack[1] === "tournelle"),
          ),
          recruit: null,
          lastRoom: null,
        };
      });
      const game = produce(accept(destination, { type: "beginBattle" }), (draft) => {
        const id = kind === "tournelle" ? "tournelle-attack" : "prismram-spectrum-lance";
        const card = draft.cards.find((entry) => entry.definitionId === id)!;
        draft.battle!.hand = [card.id];
        draft.battle!.buffer = [];
        draft.battle!.discard = [];
        draft.battle!.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
        draft.battle!.enemies[0]!.health = 10;
        draft.battle!.enemies[0]!.block = 9;
        draft.battle!.enemies[1]!.block = 0;
        draft.battle!.enemies[1]!.combat.armor = 2;
        draft.rng = 1972;
      });
      const result = dispatch(game, {
        type: "play",
        cardId: game.battle!.hand[0]!,
        targetId: "enemy-0",
        autoEndTurn: false,
      });
      expect(result.accepted).toBe(true);
      expect(result.events.filter((event) => event.text.includes("intercepts"))).toHaveLength(1);
      expect(result.state.battle!.enemies[0]).toEqual(game.battle!.enemies[0]);
      expect(result.state.battle!.enemies[1]!.health).toBe(
        game.battle!.enemies[1]!.health - (kind === "tournelle" ? 8 : 4),
      );
      expect(result.state.battle!.enemies[1]!.combat.armor).toBe(kind === "tournelle" ? 1 : 0);
      expect(result.state).toEqual(previewCard(game, game.battle!.hand[0]!, "enemy-0").state);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    },
  );
  it("rejects an invalid target without advancing RNG or changing the roster", () => {
    const game = fixture("tournelle-attack");
    expect(play(game, "missing")).toEqual({
      accepted: false,
      state: game,
      reason: "Choose a living enemy.",
      events: [],
    });
  });
});

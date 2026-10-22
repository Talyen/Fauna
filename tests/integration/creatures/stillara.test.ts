import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, FIRST_RUN_STARTERS, species } from "../../../src/game/content";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { definitionKeywords } from "../../../src/game/keywords";
import { battleChoices } from "../../../src/application/battle-policy";
import type { GameState } from "../../../src/game/types";
import { prepareDestination, accept, teamRun, winBattle } from "../../support/game";

function ready(ability = "reed-reservoir") {
  return produce(teamRun(1, ["stillara", "mossguard", "prismram"]), (game) => {
    const card = game.cards.find((entry) => entry.definitionId === `stillara-${ability}`)!;
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
function addBackup(game: GameState) {
  game.roster.push("coralcurl");
  game.reserves.push({
    id: "backup",
    species: "coralcurl",
    health: 20,
    block: 0,
    combat: freshCombat(),
    attacked: false,
  });
}
it("registers the support kit, recruitment, preview parity and current saves", () => {
  const kit = CARDS.filter((card) => card.species === "stillara");
  expect(kit.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Gain 2 Mana"],
    [1, "Cleanse all Freeze build-up from allies; Draw 1 card"],
    [1, "Restore 1 Health to all allies; Draw 1 card"],
  ]);
  expect(kit.map(definitionKeywords)).toEqual([["mana"], ["health"], ["health"]]);
  expect(FIRST_RUN_STARTERS).not.toContain("stillara");
  for (const ability of ["reed-reservoir", "thaw-path", "water-remembers"]) {
    const game = ready(ability);
    const before = encodeSave(game);
    const result = play(game);
    expect(result.accepted).toBe(true);
    expect(previewCard(game, game.battle!.hand[0]!)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(battleChoices(game)).toContainEqual(
      expect.objectContaining({ type: "play", cardId: game.battle!.hand[0] }),
    );
  }
  expect(() => decodeSave(JSON.stringify({ ...ready(), version: 40 }))).toThrow();
  let game = produce(teamRun(1, ["mossguard", "emberback", "prismram"]), (draft) => {
    prepareDestination(draft);
    draft.battle = null;
    draft.expedition = {
      recruit: null,
      lastRoom: null,
      pack: COMBAT_PACKS.findIndex((pack) => pack[0] === "stillara"),
    };
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.discovery.encountered).toContain("stillara");
  game = accept(winBattle(game), { type: "recruit", species: "stillara" });
  expect(game.discovery.recruited.stillara).toBe(1);
});
it("grants Mana after payment, before automatic end turn, with caps and unchanged rejection", () => {
  for (const mana of [1, 3, 4]) {
    const game = produce(ready(), (draft) => {
      draft.battle!.mana = mana;
    });
    const result = play(game, true);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(Math.min(4, mana + 1));
    expect(result.state.battle!.turn).toBe(game.battle!.turn);
    expect(result.state.battleXP.mana).toBe(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({ kind: "status", amount: Math.min(2, 5 - mana) }),
    );
  }
  const empty = produce(ready(), (draft) => {
    draft.battle!.mana = 0;
  });
  expect(play(empty)).toMatchObject({ accepted: false, state: empty });
  expect(play(empty).state).toBe(empty);
});
it("Thaw Path clears only allied Freeze buildup, rewards actual removal and draws once", () => {
  const game = produce(ready("thaw-path"), (draft) => {
    addBackup(draft);
    draft.boons = ["sin-eaters-lantern"];
    for (const unit of [...draft.team, ...draft.reserves]) {
      unit.health -= 8;
      Object.assign(unit.combat!, { freeze: 3, stun: 2, burn: 1, poison: 2, bleed: 3, blind: true });
    }
    draft.team[1]!.combat!.controlled = "freeze";
    draft.team[1]!.combat!.controlTurns = 1;
    draft.team[1]!.combat!.skipped = true;
    draft.team[2]!.health = 0;
    draft.battle!.enemies[0]!.combat.freeze = 2;
  });
  const result = play(game);
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.combat).toMatchObject({
    freeze: 0,
    stun: 2,
    burn: 1,
    poison: 2,
    bleed: 3,
    blind: true,
  });
  expect(result.state.team[1]!.combat).toMatchObject({
    freeze: 0,
    controlled: "freeze",
    controlTurns: 1,
    skipped: true,
  });
  expect(result.state.team[2]!.combat!.freeze).toBe(3);
  expect(result.state.reserves[0]!.combat!.freeze).toBe(3);
  expect(result.state.battle!.enemies[0]!.combat.freeze).toBe(2);
  expect(result.events.filter((event) => event.status === "cleanse")).toHaveLength(2);
  expect(result.events.filter((event) => event.kind === "heal")).toHaveLength(2);
  expect(result.state.battle!.hand).toHaveLength(1);
  expect(result.state.battleXP.health).toBe(1);
  const clean = produce(ready("thaw-path"), (draft) => {
    draft.boons = ["sin-eaters-lantern"];
    draft.team[0]!.health -= 5;
  });
  expect(play(clean).events.some((event) => event.kind === "heal")).toBe(false);
});
it("Water Remembers heals living deployed allies including self and draws once even at full Health", () => {
  const game = produce(ready("water-remembers"), (draft) => {
    addBackup(draft);
    draft.team[0]!.health -= 3;
    draft.team[1]!.health -= 3;
    draft.team[2]!.health = 0;
  });
  const result = play(game);
  expect(result.state.team.map((unit) => unit.health)).toEqual([24, species("mossguard").health - 2, 0]);
  expect(result.state.reserves[0]!.health).toBe(20);
  expect(result.state.battle!.hand).toHaveLength(1);
  expect(result.state.battleXP.health).toBe(1);
  expect(play(ready("water-remembers")).state.battle!.hand).toHaveLength(1);
});
it.each([10, 20, 30, 40, 50, 60])(
  "First Thaw reduces Freeze damage and buildup by %i%% including self",
  (percent) => {
    produce(ready(), (game) => {
      game.discovery.recruited.stillara = percent / 10;
      for (const target of game.team) {
        const before = target.health;
        hit(game, game.battle!.enemies[0]!, target, 10, "freeze", [], { origin: "proc" as const });
        expect(target.health).toBe(before - (10 - percent / 10));
        expect(target.combat!.freeze).toBe(10 - percent / 10);
        target.health = before;
        hit(game, game.battle!.enemies[0]!, target, 10, "water", [], { origin: "proc" as const });
        expect(target.health).toBe(before - 10);
      }
    });
  },
);
it("multiplies Freeze resistance before rounding and Block", () => {
  produce(ready(), (game) => {
    game.discovery.recruited.stillara = 6;
    game.talents = ["freeze.cold-resistance"];
    const target = game.team[1]!;
    target.block = 3;
    hit(game, game.battle!.enemies[0]!, target, 20, "freeze", [], { origin: "proc" as const });
    expect(target.block).toBe(0);
    expect(target.health).toBe(species(target.species).health - 1);
    expect(target.combat!.freeze).toBe(1);
  });
});
it("uses only living deployed protectors and recipients, strongest tier and enemy base tier", () => {
  for (const mode of ["fallen", "backup", "duplicate", "enemy", "reserveTarget"] as const) {
    produce(ready(), (game) => {
      game.discovery.recruited.stillara = 6;
      const protector = game.team[0]!,
        target = game.team[1]!,
        attacker = game.battle!.enemies[0]!;
      if (mode === "fallen") protector.health = 0;
      if (mode === "backup") {
        game.team.shift();
        game.reserves.push(protector);
      }
      if (mode === "duplicate") game.team[2]!.species = "stillara";
      if (mode === "enemy") {
        attacker.species = "stillara";
        const recipient = game.battle!.enemies[1]!;
        hit(game, protector, recipient, 10, "freeze", [], { origin: "proc" as const });
        expect(recipient.health).toBe(recipient.maxHealth - 9);
      } else {
        if (mode === "reserveTarget") {
          game.team.splice(1, 1);
          game.reserves.push(target);
        }
        hit(game, attacker, target, 10, "freeze", [], { origin: "proc" as const });
        expect(target.health).toBe(species(target.species).health - (mode === "duplicate" ? 4 : 10));
      }
    });
  }
});
it("enemy Stillara alternates team healing and thawing without player Mana or draws", () => {
  for (const last of ["stillara-water-remembers", "stillara-thaw-path"]) {
    const game = produce(ready(), (draft) => {
      const enemy = draft.battle!.enemies[0]!;
      enemy.species = "stillara";
      enemy.lastAbility = last;
      enemy.power = 1;
      draft.battle!.enemies.slice(1).forEach((unit) => {
        unit.species = "emberback";
      });
      draft.battle!.enemies[1]!.combat.freeze = 3;
      draft.battle!.enemies[1]!.health -= 5;
      draft.team.forEach((unit) => {
        unit.block = 100;
      });
    });
    const result = dispatch(game, { type: "endTurn" });
    expect(result.accepted).toBe(true);
    const next = last.endsWith("thaw-path") ? "stillara-water-remembers" : "stillara-thaw-path";
    expect(result.state.battle!.enemies[0]!.lastAbility).toBe(next);
    if (next.endsWith("thaw-path")) expect(result.state.battle!.enemies[1]!.combat.freeze).toBe(0);
    else
      expect(result.events).toContainEqual(
        expect.objectContaining({ kind: "heal", targetId: "enemy-1", amount: 1 }),
      );
    expect(result.events.some((event) => event.kind === "block" && event.targetId === "enemy-0")).toBe(false);
  }
});

it("updates First Thaw immediately across swaps and current-format resume", () => {
  let game = produce(ready(), (draft) => {
    draft.discovery.recruited.stillara = 6;
    addBackup(draft);
  });
  game = accept(game, { type: "swap", activeId: "ally-0", reserve: "backup" });
  game = decodeSave(encodeSave(game));
  produce(game, (draft) => {
    const target = draft.team[1]!;
    const before = target.health;
    hit(draft, draft.battle!.enemies[0]!, target, 10, "freeze", [], { origin: "proc" as const });
    expect(target.health).toBe(before - 10);
  });
  game = accept(game, { type: "swap", activeId: "backup", reserve: "ally-0" });
  game = decodeSave(encodeSave(game));
  produce(game, (draft) => {
    const target = draft.team[1]!;
    const before = target.health;
    hit(draft, draft.battle!.enemies[0]!, target, 10, "freeze", [], { origin: "proc" as const });
    expect(target.health).toBe(before - 4);
  });
});

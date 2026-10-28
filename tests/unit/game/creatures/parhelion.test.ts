import {
  addReserve,
  accept,
  authoredPack,
  prepareDestination,
  requireBattle,
  teamRun,
} from "../../../support/game";
import { playCard as play } from "../../../support/cards";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { definition, FIRST_RUN_STARTERS, species, speciesCards } from "../../../../src/game/content";
import { cardText, enemyCanUse, enemyCard } from "../../../../src/game/card-rules";
import { actionValue, enemyAbilityValue } from "../../../../src/game/ability-rules";
import { cardKeywords } from "../../../../src/game/progression";
import { previewCard } from "../../../../src/game/engine";
import {
  removeControlBuildup,
  removeEffects,
  freshCombat,
  startAction,
} from "../../../../src/game/combat/index";
import { executeAbility } from "../../../../src/game/combat/abilities";
import { swapBackup } from "../../../../src/game/team";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { validateCatalog } from "../../../../src/game/content-validation";
import { COMBAT_PACKS } from "../../../../src/game/encounters";
import { parhelionBattle } from "../../../support/parhelion";
import type { GameEvent } from "../../../../src/game/types";

const reprieve = "parhelion-polar-reprieve";
const reservoir = "parhelion-sundog-reservoir";
const waltz = "parhelion-whiteout-waltz";

describe("Parhelion", () => {
  it("authors the selected one-Mana kit, six Sunthaw tiers and normal encounter integration", () => {
    expect(speciesCards("parhelion").map((card) => [cardText(card), card.cost])).toEqual([
      ["Cleanse all Freeze build-up from allies; Draw 1 card", 1],
      ["Gain 2 Mana", 1],
      ["Deal 1 Freeze damage; Blind all enemies", 1],
    ]);
    expect(species("parhelion").passiveTiers.map((tier) => tier.effects)).toEqual(
      [1, 2, 3, 4, 5, 6].map((amount) => [{ kind: "sunthaw", amount }]),
    );
    expect(cardKeywords({ definitionId: reprieve })).toEqual(["health"]);
    expect(cardKeywords({ definitionId: reservoir })).toEqual(["mana"]);
    expect(cardKeywords({ definitionId: waltz })).toEqual(["freeze"]);
    expect(FIRST_RUN_STARTERS).not.toContain("parhelion");
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it.each([1, 2, 3, 4, 5, 6])("heals each thawed ally for %i Health and draws exactly one card", (amount) => {
    const before = produce(parhelionBattle(), (draft) => {
      draft.discovery.recruited.parhelion = amount;
    });
    const result = play(before, reprieve);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!).toMatchObject({ health: 18 + amount, combat: { freeze: 0 } });
    expect(result.state.team[1]!).toMatchObject({ health: 20 + amount, combat: { freeze: 0, burn: 2 } });
    expect(result.state.team[2]!.health).toBe(23);
    expect(result.state.battle!.mana).toBe(3);
    expect(result.state.battle!.hand).toHaveLength(before.battle.hand.length);
    expect(result.state.battle!.draw).toHaveLength(before.battle.draw.length - 1);
    const card = before.cards.find((entry) => entry.definitionId === reprieve)!;
    expect(previewCard(before, card.id)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(before.team[0]!.combat!.freeze).toBe(4);
  });

  it("uses Sunthaw for ordinary Cleanse and other creatures' thawing without healing unrelated removals", () => {
    const events: GameEvent[] = [];
    const game = produce(parhelionBattle(), (draft) => {
      const ally = draft.team[1]!;
      removeEffects(ally, "cleanse", 1, events, draft); // Burn precedes Freeze
      expect(ally.health).toBe(20);
      removeEffects(ally, "cleanse", 1, events, draft);
      expect(ally.health).toBe(21);
      removeEffects(ally, "cleanse", 1, events, draft);
      expect(ally.health).toBe(21);
      ally.combat!.freeze = 5;
      const actor = draft.team[2]!;
      const def = definition("stillara-thaw-path");
      executeAbility(draft, { side: "player", actor, def, value: 1 }, events);
    });
    expect(game.team[0]!.health).toBe(19);
    expect(game.team[1]!.health).toBe(22);
    expect(events.filter((event) => event.kind === "heal" && event.amount > 0)).toHaveLength(3);
  });

  it("keeps active Freeze intact when only buildup is cleansed and grants no healing for natural recovery", () => {
    const events: GameEvent[] = [];
    const game = produce(parhelionBattle(), (draft) => {
      const ally = draft.team[1]!;
      ally.combat!.freeze = 0;
      ally.combat!.burn = 0;
      ally.combat!.controlled = "freeze";
      ally.combat!.controlTurns = 1;
      removeControlBuildup(draft, ally, "freeze", events);
      expect(ally.combat!.controlled).toBe("freeze");
      startAction(ally, events, draft);
      expect(ally.health).toBe(20);
      removeEffects(ally, "cleanse", 6, events, draft);
    });
    expect(game.team[1]!.health).toBe(20);
    expect(events.some((event) => event.kind === "heal")).toBe(false);
  });

  it("does not heal an empty cleanse, Stun removal or a capped recipient, and never revives", () => {
    const events: GameEvent[] = [];
    const game = produce(parhelionBattle(), (draft) => {
      const ally = draft.team[2]!;
      ally.combat!.stun = 4;
      removeControlBuildup(draft, ally, "stun", events);
      expect(ally.health).toBe(23);
      ally.health = species(ally.species).health;
      ally.combat!.freeze = 4;
      removeControlBuildup(draft, ally, "freeze", events);
      expect(ally.health).toBe(species(ally.species).health);
      ally.health = 0;
      ally.combat!.freeze = 4;
      removeEffects(ally, "cleanse", 6, events, draft);
    });
    expect(game.team[2]!.health).toBe(0);
    expect(events.filter((event) => event.kind === "heal").every((event) => event.amount === 0)).toBe(true);
  });

  it("sums living deployed Sunthaw providers and loses their contribution on knockout or swap", () => {
    const game = produce(parhelionBattle(), (draft) => {
      draft.team[1]!.species = "parhelion";
      const ally = draft.team[2]!;
      ally.combat!.freeze = 4;
      removeControlBuildup(draft, ally, "freeze", []);
      expect(ally.health).toBe(25);
      draft.team[1]!.health = 0;
      ally.combat!.freeze = 4;
      removeControlBuildup(draft, ally, "freeze", []);
      expect(ally.health).toBe(26);
      addReserve(draft, "backup", "mossguard", 32, freshCombat());
      swapBackup(draft, draft.team[0]!.id, "backup", []);
      ally.combat!.freeze = 4;
      removeControlBuildup(draft, ally, "freeze", []);
      expect(ally.health).toBe(26);
    });
    expect(game.reserves[0]!.species).toBe("parhelion");
  });

  it("cleanses only deployed living allies and cannot heal the same buildup again on a repeat", () => {
    const events: GameEvent[] = [];
    const game = produce(parhelionBattle(), (draft) => {
      addReserve(draft, "backup", "stillara", 12, { ...freshCombat(), freeze: 4 });
      const def = { ...definition(reprieve), repeatChance: 100 };
      executeAbility(draft, { side: "player", actor: draft.team[0]!, def, value: 1 }, events);
    });
    expect(game.team.map((ally) => ally.health)).toEqual([19, 21, 23]);
    expect(game.reserves[0]!).toMatchObject({ health: 12, combat: { freeze: 4 } });
    expect(events.filter((event) => event.kind === "heal" && event.amount > 0)).toHaveLength(2);
    expect(game.battle.draw).toHaveLength(parhelionBattle().battle.draw.length - 2);
  });

  it("lets Polar Reprieve draw without buildup and rejects unaffordable plays without changing state or RNG", () => {
    const ready = produce(parhelionBattle(), (draft) => {
      draft.team.forEach((ally) => {
        ally.combat!.freeze = 0;
      });
    });
    const result = play(ready, reprieve);
    expect(result.accepted).toBe(true);
    expect(result.state.team.map((ally) => ally.health)).toEqual([18, 20, 23]);
    expect(result.state.battle!.draw).toHaveLength(ready.battle.draw.length - 1);
    const poor = produce(ready, (draft) => {
      draft.battle.mana = 0;
    });
    const rejected = play(poor, reprieve);
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(poor);
  });

  it("grants Reservoir's two Mana after paying its cost, respecting the shared Mana cap", () => {
    const ready = produce(parhelionBattle(), (draft) => {
      draft.battle.mana = 2;
    });
    expect(play(ready, reservoir).state.battle!.mana).toBe(3);
    expect(play(parhelionBattle(), reservoir).state.battle!.mana).toBe(4);
    expect(enemyCanUse(definition(reservoir))).toBe(false);
    const upgraded = ready.cards.find((card) => card.definitionId === reservoir)!;
    expect(actionValue({ ...upgraded, level: 1 }, ready.team[0]!, ready)).toBe(4);
  });

  it("deals Freeze damage to the chosen enemy and Blinds the whole opposing row, with preview parity", () => {
    const ready = produce(parhelionBattle(), (draft) => {
      draft.rng = 1900;
      draft.battle.enemies.forEach((enemy) => {
        enemy.combat.controlled = "stun";
        enemy.combat.controlTurns = 1;
      });
    });
    const target = ready.battle.enemies[0]!;
    const result = play(ready, waltz, target.id);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
      ready.battle.enemies.map((enemy, index) => enemy.health - (index === 0 ? 1 : 0)),
    );
    expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
    const card = ready.cards.find((entry) => entry.definitionId === waltz)!;
    expect(previewCard(ready, card.id, target.id)).toEqual(result);
    expect(play(ready, waltz).state).toBe(ready);
    expect(cardText(definition(waltz), 1)).toBe("Deal 3 Freeze damage; Blind all enemies");
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("supports enemy thawing and healing at the base tier without using the player's rank or draw pile", () => {
    const destination = produce(teamRun(42, ["stillara", "emberback", "mossguard"]), (draft) => {
      prepareDestination(draft);
      draft.discovery.recruited.parhelion = 6;
      draft.discovery.encountered.push("parhelion");
      draft.expedition = {
        recruit: null,
        lastRoom: null,
        pack: authoredPack(
          draft.encounter,
          COMBAT_PACKS.findIndex((pack) => pack[0] === "parhelion"),
        ),
      };
    });
    const ready = requireBattle(accept(destination, { type: "beginBattle" }));
    const game = produce(ready, (draft) => {
      const actor = draft.battle.enemies[0]!;
      actor.health = 15;
      actor.combat.freeze = 4;
      const ally = draft.battle.enemies[1]!;
      ally.health -= 5;
      ally.combat.freeze = 3;
      const def = enemyCard(definition(reprieve));
      executeAbility(draft, { side: "enemy", actor, def, value: enemyAbilityValue(actor, def) }, []);
    });
    expect(game.battle.enemies[0]!).toMatchObject({ health: 16, combat: { freeze: 0 } });
    expect(game.battle.enemies[1]!.health).toBe(ready.battle.enemies[1]!.health - 4);
    expect(game.battle.draw).toEqual(ready.battle.draw);
    expect(game.team.map((ally) => ally.health)).toEqual(ready.team.map((ally) => ally.health));
    expect(enemyCanUse(definition(reprieve))).toBe(true);
    expect(enemyCanUse(definition(waltz))).toBe(true);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });

  it("preserves Sunthaw healing and status attribution when Orbit Armillary returns a cleansed Freeze", () => {
    const events: GameEvent[] = [];
    const game = produce(parhelionBattle(), (draft) => {
      draft.boons = ["orbit-armillary"];
      const ally = draft.team[0]!;
      const enemy = draft.battle.enemies[0]!;
      ally.combat!.statusSources.freeze = enemy.id;
      removeControlBuildup(draft, ally, "freeze", events);
      expect(ally.health).toBe(19);
      expect(ally.combat!.freeze).toBe(0);
      expect(ally.combat!.statusSources.freeze).toBeUndefined();
      expect(enemy.combat.freeze).toBe(4);
      expect(enemy.combat.statusSources.freeze).toBe(ally.id);
    });
    expect(events.filter((event) => event.kind === "heal" && event.amount > 0)).toHaveLength(1);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });
});

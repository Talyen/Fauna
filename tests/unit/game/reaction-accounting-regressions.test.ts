import { expect, it } from "vitest";
import { grantBlock, freshCombat } from "../../../src/game/combat/index";
import { STACK_LIMIT } from "../../../src/game/combat/state";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { species, TALENTS } from "../../../src/game/content";
import type { GameEvent } from "../../../src/game/types";
import { requireBattle, teamRun } from "../../support/game";

it("keeps Block capped when conversion healing triggers another grant", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "bloomquail"])));
  state.boons = ["yarrow-salve-tin", "sail-needle", "wishing-building-block", "origami-staircase"];
  const recipient = state.team[0]!;
  const provider = state.team[1]!;
  recipient.health = species(recipient.species).health - 1;
  recipient.combat = { ...freshCombat(), bleed: 1, armor: 1 };
  provider.combat!.armor = 1;
  provider.block = STACK_LIMIT - 2;
  const events: GameEvent[] = [];
  grantBlock(state, provider, 2, events);
  expect(provider.block).toBe(STACK_LIMIT);
  expect(recipient.health).toBe(species(recipient.species).health);
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(
    events.reduce(
      (sum, event) => sum + (event.kind === "block" && event.targetId === provider.id ? event.amount : 0),
      0,
    ),
  ).toBe(2);
});

it.each(["leech.blood-debt", "leech.sanguine-overflow", "leech.bloodletting", "leech.mana-siphon"] as const)(
  "%s uses the Leech restoration even when a reaction damages the healer",
  (talent) => {
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
    state.boons = ["yarrow-salve-tin", "orbit-armillary", "story-puzzle-cube"];
    const selected = TALENTS.find((entry) => entry.id === talent)!;
    state.keywordXP.leech = 1_000_000;
    state.talents = TALENTS.filter(
      (entry) => entry.keyword === "leech" && (entry.row < selected.row || entry.id === talent),
    ).map((entry) => entry.id);
    state.battle.mana = 0;
    state.battle.puzzleProgress = ["burn", "poison"];
    const source = state.team[0]!;
    const enemy = state.battle.enemies[0]!;
    source.health = species(source.species).health - 1;
    source.combat = { ...freshCombat(), bleed: 1 };
    source.combat.statusSources.bleed = enemy.id;
    enemy.combat = { ...freshCombat(), armor: 1 };
    expect(decodeSave(encodeSave(state))).toEqual(state);
    observeDecisions(state, (decision) =>
      decision?.kind === "chance" && decision.threshold === 0.1 ? 0 : 0.99,
    );
    const initialHealth = source.health;
    const events: GameEvent[] = [];
    resolveCombat("leechHealth", state, source, 2, events, false, enemy);
    expect(source.health).toBe(initialHealth);
    expect(
      events.some((event) => event.kind === "heal" && event.targetId === source.id && event.amount === 1),
    ).toBe(true);
    if (talent === "leech.blood-debt") expect(state.currency).toBe(1);
    else if (talent === "leech.bloodletting") expect(source.combat!.burn).toBe(0);
    else expect(state.battle.mana).toBe(talent === "leech.mana-siphon" ? 2 : 1);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  },
);

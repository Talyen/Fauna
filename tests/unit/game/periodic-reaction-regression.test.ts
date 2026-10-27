import { expect, it } from "vitest";
import { freshCombat, tickStatuses } from "../../../src/game/combat/index";
import { observeDecisions } from "../../../src/game/random";
import { requireBattle, teamRun } from "../../support/game";

it("keeps newly applied Burn when a tick's Cleanse triggers a fresh retaliation", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const ally = state.team[0]!;
  const enemy = state.battle.enemies[0]!;
  ally.health = 8;
  ally.block = 0;
  ally.combat = { ...freshCombat(), burn: 4, statusSources: { burn: enemy.id } };
  enemy.species = "emberback";
  enemy.block = 0;
  enemy.combat = { ...freshCombat(), armor: 1 };
  state.talents = ["health.last-resort"];
  state.boons = ["orbit-armillary", "story-puzzle-cube"];
  state.battle.puzzleProgress = ["poison", "bleed"];
  observeDecisions(state, () => 0.99);

  tickStatuses(state, ally, []);

  expect(ally.combat.burn).toBe(1);
  expect(ally.combat.statusSources.burn).toBe(enemy.id);
});

import { freshCombat } from "../../src/game/combat/state";
import { observeDecisions } from "../../src/game/random";
import type { BattleState } from "../../src/game/types";

/** Reset battle participants and fix random decisions for isolated combat regressions. */
export function prepareCombatFixture(state: BattleState, enemyHealth: "all" | "none" = "none") {
  state.boons = [];
  state.talents = [];
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.block = 0;
    unit.combat = freshCombat();
  }
  if (enemyHealth === "all") for (const enemy of state.battle.enemies) enemy.health = enemy.maxHealth = 100;
  observeDecisions(state, () => 0.99);
}

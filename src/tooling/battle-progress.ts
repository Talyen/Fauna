import type { GameState } from "../game/types";

export interface IncompleteBattle {
  encounter: number;
  turn: number;
  enemyHealth: number;
  lowestEnemyHealth: number;
  turnsWithoutHealthProgress: number;
  stalled: boolean;
}
/** Tracks the lowest enemy Health and resets the stall clock when living allies change. */
export function createBattleProgress() {
  let current: IncompleteBattle | null = null;
  let lastProgressTurn = 0;
  let livingAllies = "";
  return {
    observe(state: GameState) {
      if (state.phase !== "battle") {
        current = null;
        livingAllies = "";
        return;
      }
      const health = state.battle.enemies.reduce((sum, enemy) => sum + enemy.health, 0);
      const turn = state.battle.turn;
      const active = state.team
        .filter((unit) => unit.health > 0)
        .map((unit) => unit.id)
        .join("\0");
      if (!current || current.encounter !== state.encounter || turn < current.turn) {
        lastProgressTurn = turn;
        current = {
          encounter: state.encounter,
          turn,
          enemyHealth: health,
          lowestEnemyHealth: health,
          turnsWithoutHealthProgress: 0,
          stalled: false,
        };
      }
      if (active !== livingAllies) {
        livingAllies = active;
        lastProgressTurn = turn;
      }
      if (health < current.lowestEnemyHealth) {
        current.lowestEnemyHealth = health;
        lastProgressTurn = turn;
      }
      current.turn = turn;
      current.enemyHealth = health;
      current.turnsWithoutHealthProgress = turn - lastProgressTurn;
      current.stalled = current.turnsWithoutHealthProgress >= 10;
    },
    snapshot(): IncompleteBattle | null {
      return current ? { ...current } : null;
    },
  };
}

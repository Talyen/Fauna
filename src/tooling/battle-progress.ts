import type { GameState } from "../game/types";

export interface IncompleteBattle {
  encounter: number;
  turn: number;
  enemyHealth: number;
  lowestEnemyHealth: number;
  turnsWithoutHealthProgress: number;
  stalled: boolean;
}
/** Diagnostic only: never ends combat or calls a budget exhaustion a defeat. */
export function createBattleProgress() {
  let current: IncompleteBattle | null = null;
  let lastProgressTurn = 0;
  return {
    observe(state: GameState) {
      if (state.phase !== "battle") {
        current = null;
        return;
      }
      const health = state.battle.enemies.reduce((sum, enemy) => sum + enemy.health, 0);
      const turn = state.battle.turn;
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

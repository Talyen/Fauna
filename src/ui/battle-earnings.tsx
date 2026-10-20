import { Coins } from "lucide-react";
import type { GameState } from "../game/types";
import { KeywordProgressGrid } from "./keyword-progress-grid";

export function BattleEarnings({ game, detailed = false }: { game: GameState; detailed?: boolean }) {
  const receipt = game.journey?.lastBattle ?? game.reward;
  if (!receipt) return null;
  const xp = Object.values(receipt.xp).reduce((total, value) => total + value, 0);
  if (!receipt.currency && !xp) return null;
  return (
    <div className="battle-earnings-receipt" aria-label="Last battle earnings">
      {receipt.currency > 0 ? (
        <p className="battle-earnings">
          <Coins aria-hidden="true" />+{receipt.currency} Gold
        </p>
      ) : null}
      {detailed ? (
        <KeywordProgressGrid earned={receipt.xp} totals={game.keywordXP} />
      ) : xp > 0 ? (
        <p className="battle-earnings">+{xp} keyword XP</p>
      ) : null}
    </div>
  );
}

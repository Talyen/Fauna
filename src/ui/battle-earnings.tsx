import { Coins } from "lucide-react";
import type { GameState } from "../game/types";

export function BattleEarnings({ game }: { game: GameState }) {
  const receipt = game.journey?.lastBattle ?? game.reward;
  if (!receipt) return null;
  const xp = Object.values(receipt.xp).reduce((total, value) => total + value, 0);
  if (!receipt.currency && !xp) return null;
  return (
    <p className="battle-earnings" aria-label="Last battle earnings">
      {receipt.currency > 0 ? (
        <span>
          <Coins aria-hidden="true" />+{receipt.currency} currency
        </span>
      ) : null}
      {xp > 0 ? <span>+{xp} keyword XP</span> : null}
    </p>
  );
}

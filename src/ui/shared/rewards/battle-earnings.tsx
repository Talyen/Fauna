import { useMessages } from "../localization/message-context";
import { MessageParts } from "../localization/message-parts";
import { AnimatedNumber } from "./result-presentation";
import { Coins } from "lucide-react";
import type { GameState } from "../../../game/types";
import { KeywordProgressGrid } from "../keyword-progress-grid";
export function BattleEarnings({ game, detailed = false }: { game: GameState; detailed?: boolean }) {
  const i18n = useMessages();
  const receipt = game.journey?.lastBattle;
  if (!receipt) return null;
  const xp = Object.values(receipt.xp).reduce((total, value) => total + value, 0);
  if (!receipt.currency && !xp) return null;
  return (
    <div
      className="battle-earnings-receipt"
      aria-label={i18n.message("earnings.lastBattle", "Last battle earnings")}
    >
      {detailed ? (
        <KeywordProgressGrid earned={receipt.xp} totals={game.keywordXP} />
      ) : xp > 0 ? (
        <p className="battle-earnings">
          <MessageParts
            template={i18n.template("earnings.keywordXp", "+{{amount}} keyword XP")}
            values={{ amount: <AnimatedNumber value={xp} /> }}
          />
        </p>
      ) : null}
      {receipt.currency > 0 ? (
        <p className="battle-earnings">
          <Coins className="gold-icon" aria-hidden="true" />
          <MessageParts
            template={i18n.template("earnings.gold", "+{{amount}} Gold")}
            values={{ amount: <AnimatedNumber value={receipt.currency} /> }}
          />
        </p>
      ) : null}
    </div>
  );
}

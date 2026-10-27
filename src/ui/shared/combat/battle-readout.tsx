import { useMessages } from "../localization/message-context";
import { Shield, Skull } from "lucide-react";
import { Progress } from "../progress";

export function BattleReadout({
  health,
  maxHealth,
  block = 0,
  previous,
  previousBlock,
  knockout = false,
  children,
}: {
  health: number;
  maxHealth: number;
  block?: number;
  previous?: number;
  previousBlock?: number;
  knockout?: boolean;
  children?: React.ReactNode;
}) {
  const i18n = useMessages();
  return (
    <div className="battle-readout">
      <div className="health-forecast">
        <div className="health-bar-surface">
          <Progress
            value={health}
            maximum={maxHealth}
            previous={previous}
            label={i18n.content("content.keyword.health.label", "Health")}
            tone="health"
          />
        </div>
        {knockout ? (
          <Skull className="knockout-preview" aria-label={i18n.message("battle.knockout", "Knockout")} />
        ) : null}
      </div>
      <div className="combat-stats">
        {block > 0 || (previousBlock ?? 0) > 0 ? (
          <span
            data-combat-tone="block"
            aria-label={
              previousBlock !== undefined && previousBlock !== block
                ? i18n.message("battle.blockChange", "Block {{previous}} to {{current}}", {
                    previous: previousBlock,
                    current: block,
                  })
                : i18n.message("battle.block", "Block {{amount}}", { amount: block })
            }
          >
            <Shield aria-hidden="true" />
            {previousBlock !== undefined && previousBlock !== block ? `${previousBlock} → ${block}` : block}
          </span>
        ) : null}
        {children}
      </div>
    </div>
  );
}

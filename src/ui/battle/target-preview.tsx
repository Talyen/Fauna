import type { TargetForecast } from "./play-preview-model";
import type { GameEvent } from "../../game/types";
import { KeywordIcon } from "../shared/keyword-icon";
import { KeywordText } from "../shared/keyword-text";
import { Heart, Shield } from "lucide-react";
import { BattleReadout } from "../shared/combat/battle-readout";
import { DamageValue } from "../shared/combat/combat-values";
export function TargetPreview({ forecast }: { forecast: TargetForecast | undefined }) {
  if (!forecast) return null;
  const { name, health, previousHealth, block, previousBlock, maxHealth, absorbed, changes, events } =
    forecast;
  return (
    <div
      className="target-preview"
      role="status"
      aria-label={`Target preview for ${name}: Health ${previousHealth} to ${health}, Block ${previousBlock} to ${block}${absorbed ? `, ${absorbed} damage absorbed` : ""}${changes.length ? `, ${changes.join(", ")}` : ""}${health === 0 ? ", Knockout" : ""}`}
    >
      <BattleReadout
        health={health}
        maxHealth={maxHealth}
        previous={previousHealth}
        block={block}
        previousBlock={previousBlock}
        knockout={previousHealth > 0 && health === 0}
      >
        {events
          .filter((e) => (e.kind === "damage" || e.kind === "heal") && (e.amount ?? 0) > 0)
          .map((e, i) => (
            <span key={i}>
              {e.kind === "damage" ? (
                <DamageValue type={e.damageType} amount={e.amount} signed />
              ) : (
                <span data-combat-tone="health">
                  <Heart aria-hidden="true" />+{e.amount}
                </span>
              )}
            </span>
          ))}
        {absorbed > 0 ? (
          <span data-combat-tone="block">
            <Shield aria-hidden="true" />
            {absorbed} absorbed
          </span>
        ) : null}
        {changes.map((change) => (
          <span key={change}>
            <KeywordText text={change} />
          </span>
        ))}
        {events
          .filter(
            (event): event is Extract<GameEvent, { kind: "status" }> =>
              event.kind === "status" &&
              "status" in event &&
              event.status === "dodge" &&
              event.outcome === "dodge",
          )
          .map((event, index) => (
            <span key={`dodge-${index}`} data-combat-tone="dodge">
              <KeywordIcon id="dodge" />
              Dodge
            </span>
          ))}
      </BattleReadout>
    </div>
  );
}

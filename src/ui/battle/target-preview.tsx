import type { TargetForecast } from "./play-preview-model";
import type { GameEvent } from "../../game/types";
import { KeywordIcon } from "../shared/keyword-icon";
import { KeywordText } from "../shared/keyword-text";
import { Heart, Shield } from "lucide-react";
import { BattleReadout } from "../shared/combat/battle-readout";
import { DamageValue } from "../shared/combat/combat-values";
export function TargetPreview({ forecast }: { forecast: TargetForecast | undefined }) {
  if (!forecast) return null;
  if (forecast.unresolved || forecast.alternatives) return <ConditionalPreview forecast={forecast} />;
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

function ConditionalPreview({ forecast }: { forecast: TargetForecast }) {
  const alternatives = forecast.alternatives ?? [];
  const sameHealth =
    alternatives.length > 0 && alternatives.every((value) => value.health === alternatives[0]!.health);
  const sameBlock =
    alternatives.length > 0 && alternatives.every((value) => value.block === alternatives[0]!.block);
  const possibleKnockout = alternatives.some((value) => value.health === 0);
  const guaranteedKnockout = sameHealth && alternatives[0]!.health === 0;
  const descriptions = [...new Set(alternatives.map((value) => outcomeText(value)))];
  const compact = descriptions.length <= 2 && descriptions.every((description) => description.length <= 20);
  const mayDodge = alternatives.some((value) =>
    value.events.some((event) => event.kind === "status" && event.outcome === "dodge"),
  );
  const mayCrit = alternatives.some((value) =>
    value.events.some((event) => event.kind === "damage" && event.critical),
  );
  return (
    <div
      className="target-preview"
      data-conditional="true"
      role="status"
      aria-label={`Possible outcomes for ${forecast.name}: ${forecast.unresolved ? "Outcome depends on hidden information or further random effects" : descriptions.join(" or ")}${possibleKnockout ? (guaranteedKnockout ? ", Knockout" : ", Possible knockout") : ""}`}
    >
      <BattleReadout
        health={sameHealth ? alternatives[0]!.health : forecast.previousHealth}
        previous={sameHealth ? forecast.previousHealth : undefined}
        maxHealth={forecast.maxHealth}
        block={sameBlock ? alternatives[0]!.block : forecast.previousBlock}
        previousBlock={sameBlock ? forecast.previousBlock : undefined}
        knockout={guaranteedKnockout}
      >
        {forecast.unresolved || (!compact && !mayDodge && !mayCrit) ? <span>Outcome varies</span> : null}
        {!forecast.unresolved && !compact && mayDodge ? <span>May be Dodged</span> : null}
        {!forecast.unresolved && !compact && mayCrit ? <span>Critical possible</span> : null}
        {compact && !forecast.unresolved
          ? descriptions.map((description, index) => (
              <span key={description} className="conditional-preview">
                {index ? "or " : "Possible: "}
                <KeywordText text={description} />
              </span>
            ))
          : null}
        {possibleKnockout && !guaranteedKnockout ? <span>Possible knockout</span> : null}
      </BattleReadout>
    </div>
  );
}

function outcomeText(value: TargetForecast) {
  const damage = new Map<string, number>();
  for (const event of value.events) {
    if (event.kind === "damage")
      damage.set(event.damageType, (damage.get(event.damageType) ?? 0) + event.amount);
  }
  const parts: string[] = [...damage].map(
    ([type, amount]) => `${amount} ${type[0]!.toUpperCase()}${type.slice(1)}`,
  );
  if (
    value.events.some(
      (event) => event.kind === "status" && event.status === "dodge" && event.outcome === "dodge",
    )
  )
    parts.push("Dodge");
  if (value.events.some((event) => event.kind === "damage" && event.critical) && parts[0])
    parts[0] = `Critical ${parts[0]}`;
  if (value.absorbed) parts.push(`${value.absorbed} absorbed`);
  const healed = value.events.reduce((total, event) => total + (event.kind === "heal" ? event.amount : 0), 0);
  if (healed || value.health > value.previousHealth)
    parts.push(`Heal ${healed || value.health - value.previousHealth}`);
  if (!damage.size && value.health < value.previousHealth)
    parts.push(`Lose ${value.previousHealth - value.health} Health`);
  if (value.block !== value.previousBlock) parts.push(`Block ${value.previousBlock} → ${value.block}`);
  parts.push(...value.changes);
  return parts.join("; ") || "No change";
}

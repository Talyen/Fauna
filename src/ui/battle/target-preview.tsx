import { useMessages } from "../shared/localization/message-context";
import { MessageParts } from "../shared/localization/message-parts";
import { useRuleTranslator } from "../shared/localization/rule-catalog";
import { ruleMessage } from "../shared/localization/rule-message";
import { statusRuleVariantId } from "../shared/localization/rule-key.mjs";
import type { StatusChange, TargetForecast } from "./play-preview-model";
import type { GameEvent } from "../../game/types";
import { KeywordIcon } from "../shared/keyword-icon";
import { Keyword, KeywordText } from "../shared/keyword-text";
import { Heart, Shield } from "lucide-react";
import { BattleReadout } from "../shared/combat/battle-readout";
import { DamageValue } from "../shared/combat/combat-values";
import { isKeywordId, KEYWORD_DEFINITIONS } from "../../game/keywords";
export function TargetPreview({ forecast }: { forecast: TargetForecast | undefined }) {
  const i18n = useMessages();
  const translateRule = useRuleTranslator();
  if (!forecast) return null;
  if (forecast.unresolved || forecast.alternatives) return <ConditionalPreview forecast={forecast} />;
  const { name, health, previousHealth, block, previousBlock, maxHealth, absorbed, events } = forecast;
  const changes = forecast.changes.map((change) => statusChangeText(change, i18n, translateRule));
  const summary = i18n.message(
    "preview.exact",
    "Target preview for {{name}}: Health {{previousHealth}} to {{health}}, Block {{previousBlock}} to {{block}}",
    { name, previousHealth, health, previousBlock, block },
  );
  const details = [
    ...(absorbed
      ? [i18n.message("preview.damageAbsorbed", "{{amount}} damage absorbed", { amount: absorbed })]
      : []),
    ...changes,
    ...(health === 0 ? [i18n.message("battle.knockout", "Knockout")] : []),
  ];
  const label = details.length
    ? i18n.message("preview.withDetails", "{{summary}}, {{details}}", {
        summary,
        details: details.join(", "),
      })
    : summary;
  return (
    <div className="target-preview" role="status" aria-label={label}>
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
            {i18n.message("preview.absorbed", "{{amount}} absorbed", { amount: absorbed })}
          </span>
        ) : null}
        {forecast.changes.map((change) => (
          <span key={change.id}>
            <StatusChangeText change={change} />
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
              {i18n.content("content.keyword.dodge.label", "Dodge")}
            </span>
          ))}
      </BattleReadout>
    </div>
  );
}

function ConditionalPreview({ forecast }: { forecast: TargetForecast }) {
  const i18n = useMessages();
  const translateRule = useRuleTranslator();
  const alternatives = forecast.alternatives ?? [];
  const sameHealth =
    alternatives.length > 0 && alternatives.every((value) => value.health === alternatives[0]!.health);
  const sameBlock =
    alternatives.length > 0 && alternatives.every((value) => value.block === alternatives[0]!.block);
  const possibleKnockout = alternatives.some((value) => value.health === 0);
  const guaranteedKnockout = sameHealth && alternatives[0]!.health === 0;
  const descriptions = [...new Set(alternatives.map((value) => outcomeText(value, i18n, translateRule)))];
  const compact = descriptions.length <= 2 && descriptions.every((description) => description.length <= 20);
  const mayDodge = alternatives.some((value) =>
    value.events.some((event) => event.kind === "status" && event.outcome === "dodge"),
  );
  const mayCrit = alternatives.some((value) =>
    value.events.some((event) => event.kind === "damage" && event.critical),
  );
  const outcomes = forecast.unresolved
    ? i18n.message("preview.hiddenOutcome", "Outcome depends on hidden information or further random effects")
    : descriptions.reduce(
        (left, right) =>
          left ? i18n.message("preview.or", "{{left}} or {{right}}", { left, right }) : right,
        "",
      );
  const summary = i18n.message("preview.possibleOutcomes", "Possible outcomes for {{name}}: {{outcomes}}", {
    name: forecast.name,
    outcomes,
  });
  const label = possibleKnockout
    ? i18n.message("preview.withDetails", "{{summary}}, {{details}}", {
        summary,
        details: guaranteedKnockout
          ? i18n.message("battle.knockout", "Knockout")
          : i18n.message("preview.possibleKnockout", "Possible knockout"),
      })
    : summary;
  return (
    <div className="target-preview" data-conditional="true" role="status" aria-label={label}>
      <BattleReadout
        health={sameHealth ? alternatives[0]!.health : forecast.previousHealth}
        previous={sameHealth ? forecast.previousHealth : undefined}
        maxHealth={forecast.maxHealth}
        block={sameBlock ? alternatives[0]!.block : forecast.previousBlock}
        previousBlock={sameBlock ? forecast.previousBlock : undefined}
        knockout={guaranteedKnockout}
      >
        {forecast.unresolved || (!compact && !mayDodge && !mayCrit) ? (
          <span>{i18n.message("preview.varies", "Outcome varies")}</span>
        ) : null}
        {!forecast.unresolved && !compact && mayDodge ? (
          <span>{i18n.message("preview.mayDodge", "May be Dodged")}</span>
        ) : null}
        {!forecast.unresolved && !compact && mayCrit ? (
          <span>{i18n.message("preview.mayCrit", "Critical possible")}</span>
        ) : null}
        {compact && !forecast.unresolved
          ? descriptions.map((description, index) => (
              <span key={description} className="conditional-preview">
                <MessageParts
                  template={
                    index
                      ? i18n.template("preview.alternative", "or {{description}}")
                      : i18n.template("preview.possible", "Possible: {{description}}")
                  }
                  values={{ description: <KeywordText text={description} /> }}
                />
              </span>
            ))
          : null}
        {possibleKnockout && !guaranteedKnockout ? (
          <span>{i18n.message("preview.possibleKnockout", "Possible knockout")}</span>
        ) : null}
      </BattleReadout>
    </div>
  );
}

function statusChangeText(
  change: StatusChange,
  i18n: ReturnType<typeof useMessages>,
  translateRule: ReturnType<typeof useRuleTranslator>,
) {
  if (isKeywordId(change.id))
    return i18n.message("preview.statusChange", "{{keyword}} {{before}} → {{after}}", {
      keyword: i18n.content(`content.keyword.${change.id}.label`, KEYWORD_DEFINITIONS[change.id].label),
      before: change.prior?.count ?? 0,
      after: change.now?.count ?? 0,
    });
  const status = change.now ?? change.prior;
  if (!status) return "";
  const id = statusRuleVariantId(status.id, ruleMessage(status.text).template);
  const text = translateRule(status.text, id)
    .map((part) => part.text)
    .join("");
  return change.now ? text : i18n.message("preview.removeStatus", "Remove {{status}}", { status: text });
}

function StatusChangeText({ change }: { change: StatusChange }) {
  const i18n = useMessages();
  if (isKeywordId(change.id)) {
    return (
      <MessageParts
        template={i18n.message("preview.statusChange", "{{keyword}} {{before}} → {{after}}", {
          keyword: "{{keyword}}",
          before: change.prior?.count ?? 0,
          after: change.now?.count ?? 0,
        })}
        values={{
          keyword: (
            <span className="rule-keyword">
              <Keyword id={change.id} />
            </span>
          ),
        }}
      />
    );
  }
  const status = change.now ?? change.prior;
  if (!status) return null;
  const content = (
    <KeywordText text={status.text} id={statusRuleVariantId(status.id, ruleMessage(status.text).template)} />
  );
  return change.now ? (
    content
  ) : (
    <MessageParts
      template={i18n.template("preview.removeStatus", "Remove {{status}}")}
      values={{ status: content }}
    />
  );
}

function outcomeText(
  value: TargetForecast,
  i18n: ReturnType<typeof useMessages>,
  translateRule: ReturnType<typeof useRuleTranslator>,
) {
  const damage = new Map<string, number>();
  for (const event of value.events) {
    if (event.kind === "damage")
      damage.set(event.damageType, (damage.get(event.damageType) ?? 0) + event.amount);
  }
  const parts: string[] = [...damage].map(([type, amount]) => {
    const label = isKeywordId(type)
      ? i18n.content(`content.keyword.${type}.label`, KEYWORD_DEFINITIONS[type].label)
      : `${type[0]!.toUpperCase()}${type.slice(1)}`;
    return i18n.message("preview.outcomeDamage", "{{amount}} {{type}}", { amount, type: label });
  });
  if (
    value.events.some(
      (event) => event.kind === "status" && event.status === "dodge" && event.outcome === "dodge",
    )
  )
    parts.push(i18n.content("content.keyword.dodge.label", "Dodge"));
  if (value.events.some((event) => event.kind === "damage" && event.critical) && parts[0])
    parts[0] = i18n.message("preview.outcomeCritical", "Critical {{description}}", { description: parts[0] });
  if (value.absorbed)
    parts.push(i18n.message("preview.absorbed", "{{amount}} absorbed", { amount: value.absorbed }));
  const healed = value.events.reduce((total, event) => total + (event.kind === "heal" ? event.amount : 0), 0);
  if (healed || value.health > value.previousHealth)
    parts.push(
      i18n.message("preview.outcomeHeal", "Heal {{amount}}", {
        amount: healed || value.health - value.previousHealth,
      }),
    );
  if (!damage.size && value.health < value.previousHealth)
    parts.push(
      i18n.message("preview.outcomeLoseHealth", "Lose {{amount}} Health", {
        amount: value.previousHealth - value.health,
      }),
    );
  if (value.block !== value.previousBlock)
    parts.push(
      i18n.message("preview.outcomeBlock", "Block {{before}} → {{after}}", {
        before: value.previousBlock,
        after: value.block,
      }),
    );
  parts.push(...value.changes.map((change) => statusChangeText(change, i18n, translateRule)));
  return parts.join("; ") || i18n.message("preview.outcomeNoChange", "No change");
}

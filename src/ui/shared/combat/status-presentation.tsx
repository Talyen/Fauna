import type { ReactNode } from "react";
import { KEYWORD_DEFINITIONS, isKeywordId } from "../../../game/keywords";
import { Keyword, KeywordText } from "../keyword-text";
import { MessageParts } from "../localization/message-parts";
import { useMessages } from "../localization/message-context";
import { statusRuleVariantId } from "../localization/rule-key.mjs";
import { ruleMessage } from "../localization/rule-message";
import { useRuleText } from "../localization/rule-catalog";
import type { Status } from "./combat-status-model";

const measured = ["armor", "thorns", "dodge", "burn", "poison", "bleed", "stun", "freeze"];

/** Keep the committed English snapshot for animation while presenting complete localized messages. */
export function useStatusPresentation(status: Status): { text: string; content: ReactNode } {
  const i18n = useMessages();
  const id = isKeywordId(status.id) && measured.includes(status.id) ? status.id : undefined;
  const source = id ? KEYWORD_DEFINITIONS[id].description : status.text;
  const ruleId = id
    ? `content.glossary.keyword.${id}.definition.rule`
    : statusRuleVariantId(status.id, ruleMessage(status.text).template);
  const description = useRuleText(source, ruleId)
    .map((part) => part.text)
    .join("");
  if (!id) return { text: description, content: <KeywordText text={status.text} id={ruleId} /> };
  const keyword = i18n.content(`content.keyword.${id}.label`, KEYWORD_DEFINITIONS[id].label);
  const count = i18n.number(status.count);
  const values = { keyword, count, description };
  const rich = {
    keyword: (
      <span className="rule-keyword">
        <Keyword id={id} />
      </span>
    ),
    count,
    description: <KeywordText text={source} id={ruleId} />,
  };
  let text =
    id === "dodge"
      ? i18n.message("status.dodge", "{{keyword}} {{count}}% bonus; {{description}}", values)
      : i18n.message("status.measured", "{{keyword}} {{count}}; {{description}}", values);
  let content: ReactNode =
    id === "dodge" ? (
      <MessageParts
        template={i18n.template("status.dodge", "{{keyword}} {{count}}% bonus; {{description}}")}
        values={rich}
      />
    ) : (
      <MessageParts
        template={i18n.template("status.measured", "{{keyword}} {{count}}; {{description}}")}
        values={rich}
      />
    );
  const add = (extra: string) => {
    text = i18n.message("status.additional", "{{description}}; {{extra}}", { description: text, extra });
    content = (
      <MessageParts
        template={i18n.template("status.additional", "{{description}}; {{extra}}")}
        values={{ description: content, extra }}
      />
    );
  };
  if (id === "dodge" && status.temporaryDodge)
    add(
      i18n.message("status.dodgeExpires", "{{count}}% expires at your next turn", {
        count: status.temporaryDodge,
      }),
    );
  if (id === "dodge" && status.dodgeFreezeRetaliation)
    add(
      i18n.message("status.dodgeFreezeRetaliation", "Retaliate with {{count}} Freeze damage when you Dodge", {
        count: status.dodgeFreezeRetaliation,
      }),
    );
  if (id === "dodge" && status.sharedDodge)
    add(
      i18n.message("status.dodgeShared", "{{count}}% from {{trait}}", {
        count: Number(status.sharedDodge.toFixed(2)),
        trait: i18n.content("content.species.dunefox.trait", "Shifting Sands"),
      }),
    );
  return { text, content };
}

import { useMessages } from "./localization/message-context";
import { useEffectMetadata } from "./effects/effects";
import { KEYWORD_DEFINITIONS, type KeywordId } from "../../game/keywords";
import { useRuleText } from "./localization/rule-catalog";
import type { RuleMessage } from "./localization/rule-message";
import { Fragment, type CSSProperties } from "react";

/** Format complete translated card rules without changing their catalog identity. */
export function cardRuleLines(text: string) {
  return text.replace(/\s*[;；]\s*|\s+\/\s+/g, "\n");
}
export function Keyword({ id, className }: { id: KeywordId; className?: string }) {
  const i18n = useMessages();
  const metadata = useEffectMetadata([id]);
  return (
    <span {...metadata} className={className} data-keyword={id}>
      {i18n.content(`content.keyword.${id}.label`, KEYWORD_DEFINITIONS[id].label)}
    </span>
  );
}

/** Labels stay readable without color; definitions remain in the menu Glossary. */
export function KeywordText({
  text,
  id,
  structured,
  lines = false,
  keywordColorVariables = false,
}: {
  text: string;
  id?: string;
  structured?: RuleMessage;
  lines?: boolean;
  keywordColorVariables?: boolean;
}) {
  const metadata = useEffectMetadata();
  return useRuleText(text, id, structured).map((part, index) =>
    part.keyword ? (
      <span
        key={index}
        className="rule-keyword"
        data-keyword={part.keyword}
        style={
          keywordColorVariables
            ? ({ "--rule-keyword-color": `var(--keyword-${part.keyword})` } as CSSProperties)
            : undefined
        }
        {...metadata}
        data-effect-keywords={part.keyword}
      >
        {part.text}
      </span>
    ) : lines ? (
      <Fragment key={index}>
        {cardRuleLines(part.text)
          .split("\n")
          .map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {line}
            </Fragment>
          ))}
      </Fragment>
    ) : (
      part.text
    ),
  );
}

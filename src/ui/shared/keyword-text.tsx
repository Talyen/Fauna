import { useMessages } from "./localization/message-context";
import { useEffectMetadata } from "./effects/effects";
import { KEYWORD_DEFINITIONS, type KeywordId } from "../../game/keywords";
import { useRuleText } from "./localization/rule-catalog";
export function Keyword({ id }: { id: KeywordId }) {
  const i18n = useMessages();
  const metadata = useEffectMetadata([id]);
  return (
    <span {...metadata} data-keyword={id}>
      {i18n.content(`content.keyword.${id}.label`, KEYWORD_DEFINITIONS[id].label)}
    </span>
  );
}

/** Labels stay readable without color; definitions remain in the menu Glossary. */
export function KeywordText({ text, id }: { text: string; id?: string }) {
  const metadata = useEffectMetadata();
  return useRuleText(text, id).map((part, index) =>
    part.keyword ? (
      <span
        key={index}
        className="rule-keyword"
        data-keyword={part.keyword}
        {...metadata}
        data-effect-keywords={part.keyword}
      >
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

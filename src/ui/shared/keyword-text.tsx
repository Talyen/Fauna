import { useEffectMetadata } from "./effects/effects";
import { KEYWORD_DEFINITIONS, keywordText, type KeywordId } from "../../game/keywords";
export function Keyword({ id }: { id: KeywordId }) {
  const metadata = useEffectMetadata([id]);
  return (
    <span {...metadata} data-keyword={id}>
      {KEYWORD_DEFINITIONS[id].label}
    </span>
  );
}

/** Labels stay readable without color; definitions remain in the menu Glossary. */
export function KeywordText({ text }: { text: string }) {
  const metadata = useEffectMetadata();
  return keywordText(text).map((part, index) =>
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

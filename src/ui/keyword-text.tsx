import { KEYWORD_DEFINITIONS, keywordText, type KeywordId } from "../game/keywords";

export function Keyword({ id }: { id: KeywordId }) {
  return <span data-keyword={id}>{KEYWORD_DEFINITIONS[id].label}</span>;
}

/** Labels stay readable without color; definitions remain in the menu Glossary. */
export function KeywordText({ text }: { text: string }) {
  return keywordText(text).map((part, index) =>
    part.keyword ? (
      <span key={index} data-keyword={part.keyword}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

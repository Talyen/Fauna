# Plain inline keywords

Open `/design/keyword-interactions/index.html` to review the accepted plain-text treatment, including an example inside a parent rules tooltip and a shadcn Glossary dialog populated from the real game catalog. Illustrative rule amounts are spacing examples, not new gameplay content.

The user superseded the earlier interactive-reference choices: keywords are semibold words in their semantic colors, with ordinary text spacing and no underline, hover feedback, keyword tooltip, click action or individual focus stop. Definitions remain in the Glossary. The canonical KeywordText renderer uses plain spans; the former button wrapper and its padding no longer appear in this preview. Previously saved `fauna-design-keyword-picks-v1` values are preserved but ignored by the retired study.

Actual registered shadcn Tooltip and Dialog own the surrounding sample tooltip and Glossary, with native focus and dismissal behavior. These are separate surfaces: hovering a colored word does not open another tooltip. Current production rules belong to [UI contracts](../../Docs/UI.md).

# Plain inline keywords

Open `/design/keyword-interactions/index.html` to review the accepted plain-text treatment, including an example inside a parent rules tooltip and a shadcn Glossary dialog populated from the real game catalog. Illustrative rule amounts are spacing examples, not new gameplay content.

The user superseded the earlier interactive-reference choices: keywords are semibold words in their semantic colors, with ordinary text spacing and no underline, hover feedback, keyword tooltip, click action or individual focus stop. Definitions remain in the Glossary. The canonical KeywordText renderer uses plain spans; the former button wrapper and its padding no longer appear in this preview. Previously saved `fauna-design-keyword-picks-v1` values are preserved but ignored by the retired study.

Actual registered shadcn Tooltip and Dialog own the surrounding sample tooltip and Glossary, with native focus and dismissal behavior. These are separate surfaces: hovering a colored word does not open another tooltip. Follow [Phone decisions](../PHONE_DECISIONS.md) for the current preference record. Production inline keyword emphasis is updated; full-game rendered, CI, desktop and physical-controller acceptance remain pending.

Focused browser review verified ordinary inline sentence spacing, semibold colored spans with zero padding/margins and no focus stops, the parent tooltip containing plain keyword text, and the Glossary opening/closing with focus return. This is component-preview evidence, not full-game acceptance.

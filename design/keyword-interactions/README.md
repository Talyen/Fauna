# Plain inline keywords

Open `/design/keyword-interactions/index.html` to review the accepted plain-text treatment, including an example inside a parent rules tooltip and a shadcn Glossary dialog populated from the real game catalog. Illustrative rule amounts are spacing examples, not new gameplay content.

The fixture demonstrates plain inline keyword text; the [shared UI contract](../../Docs/UI.md#shared-components-and-enforcement) owns its production behavior. The retired study ignores previously saved `fauna-design-keyword-picks-v1` values.

Actual registered shadcn Tooltip and Dialog own the surrounding sample tooltip and Glossary, with native focus and dismissal behavior. These are separate surfaces: hovering a colored word does not open another tooltip.

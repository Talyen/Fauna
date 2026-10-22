---
name: fauna-ui-design
description: Design or revise Fauna player screens, layouts and visual styling using rendered whole-screen references and a copy reduction pass
---

# Fauna UI design

Read [UI contracts](../../../Docs/UI.md) and the [reference pack](../../../design/visual-quality/README.md). Open the relevant reference images; filenames and prose are not substitutes for seeing them. Current UI contracts override historical studies. Reference labels distinguish established behavior, proposed direction and user-approved appearance; never promote a candidate to approved yourself.

Before implementation, inspect the current rendered screen and its real content. State the player's decision and distinguish persistent state from information available through inspection. Decision-relevant information does not automatically belong on the resting screen. Choose a positively accepted visual reference when one exists and identify the specific relationship to carry forward: artwork versus text scale, grouping, alignment, density or emphasis. Do not copy unrelated decoration. Existing project screens are not positive aesthetic references merely because they already exist; rejected examples cannot establish the desired direction.

Compose the whole screen first. Establish artwork scale, reading order, useful negative space and a bounded content group before tuning controls. Button hierarchy follows the role of the actions and explicit user direction: a row of equally valid choices is not inherently a hierarchy defect. Do not assume quieter buttons, wider spacing, left-aligned text or fewer filled controls improve a composition.

Use the existing shared owners; generic dashboard containers, repeated cards around cards, badges and ornamental separators need a concrete gameplay purpose. Preserve registered primitives and accessibility. New visual values belong in tokens.

Preserve hover/focus disclosure unless the user requests another information layout or an observed interaction failure requires it. Do not turn an aesthetic task into an information-density redesign. Avoid promoting names, rules or instructions from inspection onto the resting screen as a default improvement.

Audit every visible phrase in its intended disclosure layer: retain necessary state, rules, availability and outcomes; remove repeated headings, descriptions of obvious controls, motivational copy and routine success messages. Example: under “Choose your reward”, remove “Select one of the rewards below to continue”. Do not move filler into tooltips. Do not remove accessible names or hide essential rules to obtain a lower word count.

Implement the smallest complete composition, then capture it through the real player flow. Compare against the baseline with the same state, viewport, text preference, input modality and animation condition. Review at minimum 1280×720 with 125% text and 1920×1080 at default text. Inspect both full frames and interaction states; geometry checks alone cannot establish visual quality. Follow the bounded review authorization and completion requirements in UI contracts.

Apply the [critique skill](../fauna-ui-critique/SKILL.md) to the rendered result. Fix identified defects and recapture. Give the user a compact comparison when taste remains unresolved; record their choice without inventing approval. Keep the result visually pending until they accept a proposed direction. Report the actual coverage and remaining CI/platform boundaries.

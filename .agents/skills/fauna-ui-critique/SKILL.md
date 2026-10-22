---
name: fauna-ui-critique
description: Critique rendered Fauna UI changes for composition, copy, artwork integration and player interaction before visual completion
---

# Fauna UI critique

Use [current UI contracts](../../../Docs/UI.md), the affected screen specification and its review tier. For composition or art-direction work, open the relevant images in the [reference pack](../../../design/visual-quality/README.md). Inspect actual images and the changed player flow. If you only have source, request or capture the permitted focused preview and label the missing visual evidence; do not issue aesthetic approval from code.

First inspect the full frame without reading the author's rationale. Assess the composition against the requested visual direction and accepted references before enumerating possible changes. Identify the visual focus and how the player accesses necessary information. Compare against the previous version and visual reference when required by the [review tier](../../../Docs/UI.md#required-review); small adjustments do not require an extra baseline or reference study.

Separate observed defects from design hypotheses; do not promote your own preferred treatment to a requirement.

Look for concrete defects:

- Composition: unintended focal points, broken grouping, accidental gaps or clipping; do not classify deliberate symmetry, equal choice emphasis or compact spacing as defects without evidence
- Copy: repeated meaning, obvious instructions, unnecessary subtitles, promotional language, success narration; preserve exact rules and useful unavailable reasons
- Artwork: distortion/cropping, inconsistent scale, muddy contrast, lighting or material mismatch, decorative framing that competes with the image
- Interaction: ambiguous targets, controls that misrepresent their action roles, weak selected/unavailable distinction, tooltip collisions, lost focus, unclear committed outcome
- Contrast: inspect computed text/icon colors against the actual rendered fill, including screen overrides and hover/focus; valid token definitions alone do not prove readable controls
- Fit: full content at supported sizes and enlarged text, readable type, reachable controls and unchanged minimum hit areas

For each finding, name the screen/state, visible evidence, player consequence and smallest useful correction. “Feels premium”, “more polished” and numeric self-ratings are not evidence. A missing preference decision is different from a defect. Do not reward a candidate for implementing your suggestions. Reassess the full image independently; a list of changes, more visible information or passing checks cannot establish visual improvement. Test your critique against the rejected Merchant B pilot: it passed layout and interaction checks but lost to A.

After correction, inspect fresh captures and follow the single [rendered review procedure](../../../Docs/UI.md#required-review) for evidence, coverage reporting and A/B preference decisions. Never infer acceptance from silence or promote your own candidate to an approved reference. A missing preference decision is separate from a functional defect.

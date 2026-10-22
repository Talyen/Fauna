---
name: fauna-ui-critique
description: Critique rendered Fauna UI changes for composition, copy, artwork integration and player interaction before visual completion
---

# Fauna UI critique

Use [current UI contracts](../../../Docs/UI.md) and the [reference pack](../../../design/visual-quality/README.md). Inspect actual images and the changed player flow. If you only have source, request or capture the permitted focused preview and label the missing visual evidence; do not issue aesthetic approval from code.

First inspect the full frame without reading the author's rationale. Identify the first visual focus, the player's next action, and the supporting information. Then compare against the previous version and the relevant visual reference at the same state and size.

Look for concrete defects:

- Composition: competing focal points, detached heading/actions, accidental gaps, weak grouping, uneven alignment, excessive or insufficient density
- Copy: repeated meaning, obvious instructions, unnecessary subtitles, promotional language, success narration; preserve exact rules and useful unavailable reasons
- Artwork: distortion/cropping, inconsistent scale, muddy contrast, lighting or material mismatch, decorative framing that competes with the image
- Interaction: ambiguous targets, equal emphasis on unrelated actions, weak selected/unavailable distinction, tooltip collisions, lost focus, unclear committed outcome
- Fit: full content at supported sizes and enlarged text, readable type, reachable controls and unchanged minimum hit areas

For each finding, name the screen/state, visible evidence, player consequence and smallest useful correction. “Feels premium”, “more polished” and numeric self-ratings are not evidence. A missing preference decision is different from a defect. Changing an identified imperfection is not proof the overall composition improved. Test your critique against the rejected Merchant B pilot: it passed layout and interaction checks but lost to A.

After correction, inspect fresh captures. Report separately: functional checks; rendered evidence inspected; unresolved aesthetic choice; user acceptance. Never call CI screenshots aesthetic approval, infer user preference from silence, or label your own candidate as a golden reference.

For a new direction, present A/B options with identical content and state, without persuasive captions or preferred-option badges. Ask only which the user prefers. Record the chosen image and scope in the reference pack. If the user rejects both but prefers one, record rejection of both and the relative preference; do not promote the less-disliked option to approved. One screen's acceptance does not approve every screen or establish physical-controller/native behavior.

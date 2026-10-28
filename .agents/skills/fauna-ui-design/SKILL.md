---
name: fauna-ui-design
description: Design or revise Fauna player screens, interaction flows, layouts and visual styling using rendered whole-screen references
---

# Fauna UI design

Follow the [UI task procedure](../../../Docs/UI.md#required-review), which owns the checklist, evidence tiers and completion rules. Read only the affected screen contract and relevant visual references linked there.

Apply the [copy and layout rule](../../../Docs/UI.md#copy-and-layout): Avoid taglines, avoid helper text, avoid secondary labels - if a screen needs them to make sense, fix the layout instead.

For a new or changed interaction, describe the entry state, player action, visible committed outcome and return path before implementing. Include cancellation, unavailable choices and focus return where relevant. A mockup should make that flow reviewable; label simulated outcomes and distinguish a proposed interaction from working gameplay. Design-only requests call for a proposal, while implementation requests authorize proceeding with routine design choices.

Establish the artwork scale, reading order, grouping and bounded whole-screen composition before tuning individual controls. Preserve the requested disclosure layout and the roles of the actions. Use containers, labels and decoration only when they help the player's decision. Audit copy in its intended disclosure layer, keeping rules, availability, outcomes and accessible names while removing repetition.

Review the rendered result independently against the requested direction and the reference's recorded acceptance scope. Report visible defects and player consequences; distinguish preference questions from functional defects. Source inspection and passing tests do not establish visual quality.

---
name: fauna-art-direction
description: Create, select or revise Fauna artwork and artistic treatments using project references and inspection at actual gameplay scale
---

# Fauna art direction

Read [content ownership](../../../Docs/CONTENT.md), [UI contracts](../../../Docs/UI.md) and the [visual references](../../../design/visual-quality/README.md). Inspect the relevant existing artwork and the screen where it will appear before choosing or producing an asset. Fauna does not inherit another game's house style merely because that skill is installed.

Define the asset's job and intended display size. Use a small, explicit set of project references for subject silhouette, composition, palette, light direction, contrast and material/mark-making. Keep subject identity and gameplay readability ahead of ornamental detail. If no accepted artistic direction exists, create a limited comparison and label it proposed; do not silently establish a new house style.

When generating bitmap artwork, use the available image-generation workflow. Preserve source originals and use the repository asset pipeline for prepared output. Do not add a dependency or replace a working source library for a single image. For code-native styling, edit the canonical source and tokens rather than rasterizing controls.

Review both the source and its real ArtCard rendering: creatures are 4:3 landscape, actions 3:4 portrait, with contain rendering. Check silhouette, focal point, edges, value separation and image-to-background cohesion at the actual shared artwork profile. An attractive large source image can still fail at 160px. Check the set together for consistent lighting and visual weight.

Reject mismatched framing, illegible detail, unexplained glow, generic ornament, unintended text, broken anatomy or geometry, and styles inconsistent with the selected references. Correct the supported defect and inspect again. Do not try to compensate for weak composition by increasing saturation, glow or detail.

Deliver the asset in context with reference provenance, conditions inspected and any unresolved choice. Follow the [rendered review procedure](../../../Docs/UI.md#required-review) for in-game evidence and preference decisions. Source generation, rendered verification and user acceptance are separate facts.

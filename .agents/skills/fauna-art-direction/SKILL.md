---
name: fauna-art-direction
description: Create, select or revise Fauna artwork and artistic treatments using project references and inspection at actual gameplay scale
---

# Fauna art direction

Follow the [UI task procedure](../../../Docs/UI.md#required-review) for in-game review. Inspect the relevant artwork, screen and visual references linked there before choosing or producing an asset. Consult [content ownership](../../../Docs/CONTENT.md#prepared-assets) when authoring or preparing assets. Fauna does not inherit another game's house style merely because that skill is installed.

Inspect actual image pixels, not only filenames, prompts or sidecars. Keep dependent art judgments provisional when images are inaccessible. For connected Drive assets, use the Google Drive skill and retain the selected source links/IDs or local paths; follow [source-asset checkout guidance](../../../CONTRIBUTING.md#dependencies-and-source-assets) if originals are omitted from a task checkout.

Define the asset's job and intended display size. Use a small, explicit set of project references for subject silhouette, composition, palette, light direction, contrast and material/mark-making. Keep subject identity and gameplay readability ahead of ornamental detail. If no accepted artistic direction exists, create a limited comparison and label it proposed; do not silently establish a new house style.

When generating bitmap artwork, use the available image-generation workflow. Preserve source originals and use the repository asset pipeline for prepared output. Do not add a dependency or replace a working source library for a single image. For code-native styling, edit the canonical source and tokens rather than rasterizing controls.

For every Fauna image-generation task, use [fauna-image-generation](../fauna-image-generation/SKILL.md) to retrieve and apply the current locked Google Drive style prompt before generation.

For in-game card art, review both the source and its real ArtCard rendering at the native [artwork ratio](../../../Docs/CONTENT.md#artwork-contracts) and shared profile. Other assets need inspection on their intended surface; do not force a background, icon or branding asset into a card review. Check silhouette, focal point, edges, value separation and image-to-background cohesion at the actual shared artwork profile. An attractive large source image can still fail at 160px. Check the set together for consistent lighting and visual weight.

Reject mismatched framing, illegible detail, unexplained glow, generic ornament, unintended text, broken anatomy or geometry, and styles inconsistent with the selected references. Correct the supported defect and inspect again. Do not try to compensate for weak composition by increasing saturation, glow or detail.

Deliver the asset in context with reference provenance, conditions inspected and any unresolved choice. Follow the [rendered review procedure](../../../Docs/UI.md#required-review) for in-game evidence and preference decisions. Source generation, rendered verification and user acceptance are separate facts.

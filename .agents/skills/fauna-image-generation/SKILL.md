---
name: fauna-image-generation
description: Generate or edit imagery for Fauna, including creature, ability, Boon and environment artwork. Use whenever creating Fauna images to retrieve and apply the current locked art style prompt from Google Drive before generation.
---

# Fauna image generation

Before every Fauna image-generation task, read the current [Fauna locked art style prompt](https://drive.google.com/file/d/1VODYgwwZO9leeR5xLgc5OoVdbefRiYRv/view) through the connected Google Drive tool. The Drive file is the authority; do not substitute memory, filenames, existing artwork or a creature-specific prompt for its current text. If the link is inaccessible, search the Fauna `Art Style` folder for `Fauna — Locked Art Style Prompt.txt`. If its contents remain unavailable, explain the blocker and ask for the prompt rather than silently generating in an assumed style.

Apply the locked style text and its generation instructions to each requested image and variant. Keep the subject description faithful to the user's request; do not invent extra props, targets, actions or scene details when the user asks for a minimal prompt. Preserve project-specific card aspect ratios in `Docs/CONTENT.md`; adapt the locked prompt's creature-card format for the requested asset when necessary and report the adaptation. Use fresh generation without image references as the locked prompt instructs, unless the user explicitly overrides that instruction. Explicit user requests take precedence over the style prompt and this skill.

Use the built-in image generation workflow and include the prompt's requested model name in the request, without claiming a model was selected if the tool cannot choose one. Follow `fauna-art-direction` for provenance and source/actual-size review, and `fauna-ui-critique` plus `Docs/UI.md#required-review` for rendered acceptance. Record the Drive source, actual prompt and generated originals; distinguish visual inspection from user approval.

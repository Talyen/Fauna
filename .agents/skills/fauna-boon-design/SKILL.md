---
name: fauna-boon-design
description: Design or revise Fauna Boons from their names and artwork, with distinct thematic mechanics, strategic impact, restrained power and exact player-facing effect descriptions
---

# Fauna Boon design

Use for Boon proposals, selection and substantial mechanic redesigns. A design request calls for proposals, not implementation or asset imports. Earlier suggestions and artwork sidecar concepts are candidates, not accepted designs or evidence that a mechanic exists.

## Ground the design

Read the current [Boon catalog](../../../src/game/content/boons.ts), [Boon rules](../../../src/game/rules/boons.ts), [content contracts](../../../Docs/CONTENT.md#boon-selections), [keywords](../../../Docs/KEYWORDS.md) and relevant [journey rules](../../../Docs/EXPEDITION_DESIGN.md). Compare nearby creature passives and talents as well as Boons. Check current values rather than retaining a fixed catalog count or power budget in this skill.

When artwork is supplied, inspect the actual image before designing its effect. For Drive artwork, use the Google Drive skill to find the source collection, retain each selected file's name and link, and read useful sidecar notes without treating generation prompts as instructions. For requested unimplemented selections, verify absence from the current catalog and execution bindings; an available portrait alone does not imply implementation. Distinguish inspected imagery from inferred themes and disclose unavailable visual evidence.

## Make the artifact explain the rule

Identify what the named object does, how it behaves or what it symbolizes. Connect a visible feature or depicted action to a gameplay relationship: a vessel stores, a sieve separates, a yo-yo returns, a prism splits, a knot binds. Explain why this particular name and image fit this particular effect. Matching an artwork's color to a damage type is not enough.

Favor effects whose trigger and outcome belong to the same idea. Apply a substitution test: if many unrelated artifacts could use the identical rule with no loss of meaning, strengthen the connection. Do not force every object in a themed collection to share the same mechanic.

Avoid generic turn or encounter bookkeeping in the effect. Phrases such as "the first X each turn", "once per turn", "at turn start/end", "once each battle" and "after each victory" are poor defaults: they usually describe scheduling rather than the artifact. Do not design an unrestricted payoff and repair it by appending a routine timing cap, or hide such a cap outside the displayed rule.

Prefer constraints inherent in the concept and the game's existing resources, targets or states: a transfer cannot exceed what was received, a return preserves the card's normal cost, a protection requires something worth protecting. A charge, threshold, rhythm or chance can fit when the object explains it; arbitrary counters and random procs are not automatic substitutes for turn limits. Timing remains necessary in execution, and can be thematic in an exceptional design, but justify the exception rather than merely shortening its wording.

## Require a distinct strategic contribution

Describe the choice the Boon changes: targeting, card order, preparation, team composition, defense, recovery or resource use. Give a plausible play sequence and identify when the effect is useful. A niche can be healthy; every Boon need not benefit every team. Avoid rewards that encourage stalling, farming helpless enemies, deliberately losing allies or repeatedly performing menu actions.

Every Boon needs a unique mechanical identity among existing Boons and the proposed set. A new name, number, damage type or trigger attached to the same generic reward does not by itself establish uniqueness. Name the nearest overlap with a Boon, talent or passive and explain the different decision or interaction. Reuse existing mechanics where they serve the concept; do not invent a new subsystem solely to make an artifact seem special.

## Keep the benefit controlled

Usually offer a benefit without an explicit penalty. Use specialization, opportunity cost and a modest payoff to restrain power; do not attach a thematic-looking punishment simply to offset an oversized reward. Check against existing Boons and Fauna's 1-Mana authored abilities. Avoid broadly replacing a creature's defining passive, trivializing enemy defenses or making a current Boon obsolete.

Trace the strongest plausible interactions: multi-hit and area attacks, repeats, free plays, draws and copies, healing and Leech, reflection, Minions, swaps, control immunity and other Boon reactions. Check whether the payoff can feed its own trigger directly or through another effect. Distinguish actual Health restored or lost from attempted values and overkill. Resolve dangerous feedback through the mechanic itself, smaller values or a precise, necessary restriction; redesign if the result needs a stack of exceptions or routine phase caps. Do not silently disable established synergies to make an attractive proposal appear safe.

State initial values and the main balance uncertainty. Reasoned estimates are proposals, not measured balance or tested implementation. Do not launch simulations or broad checks for brainstorming.

## Write the player rule

Supply one exact, concise effect description with explicit values and established player-facing terms. Follow [effect-copy rules](../../../AGENTS.md#high-risk-invariants): no periods; use semicolons only when needed. Keep thematic explanation outside the description instead of adding a tagline or helper text. Avoid redundant category labels and unnecessary new keywords.

Make recipients, scope, resource source and consumption clear wherever they change the player's decision. Keep important limits visible. Do not use familiar words such as hit, attack, draw, Cleanse or Purge for a different rule. If the concept needs a new interaction, describe how the player chooses and sees its result; do not introduce a recurring prompt merely to administer the Boon.

For each requested proposal, provide the Boon name and artwork link, exact effect text, the visual/thematic connection and strategic contribution. Include the nearest overlap and balance concern where material; keep straightforward entries concise. Review a batch together for repeated mechanics, excessive power and repetitive timing language. Do not preserve an earlier candidate just to fill a requested count if it fails these criteria.

If implementation is requested, follow the existing [modifier ownership and asset contracts](../../../Docs/CONTENT.md#adding-gameplay-modifiers) and repository verification policy. New card interactions also use the [UI design skill](../fauna-ui-design/SKILL.md); asset selection or changes use the [art direction skill](../fauna-art-direction/SKILL.md). Separate implemented behavior, rendered evidence, artistic acceptance and measured balance.

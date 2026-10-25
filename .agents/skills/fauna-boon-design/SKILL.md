---
name: fauna-boon-design
description: Design or revise artwork-led Fauna Boons with automatic passive rules that change strategy and team-building without new battle controls, downsides or power creep
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

Treat Boons as a place to change the game's rules through automatic passive effects. Prefer a new interaction or relationship that opens a different way to play over a conditional numerical bonus. Explore how defenses, damage, cards, resources and creatures' existing mechanics can cooperate. Numbers should tune the rule's impact rather than supply its entire identity. A simple numerical Boon can still fit when its thematic and strategic case is strong; do not fill a set with variations on "+1 when X happens".

Put strategic depth in recruitment, team composition and existing card plays. Do not add Boon buttons, activations, modes, manual storage or withdrawals, card marking, resource allocation, extra target selection or acting-creature selection. Avoid "You may" effects and optional side actions; automatic resolution should make the existing battle flow richer without asking the player to administer the Boon. Use existing targets and combat rules to resolve recipients predictably. Account for any needed feedback through existing cards, resource totals, status displays and combat outcomes; a separate meter, pile or management panel is a reason to simplify the design. An explicit later request for an active item or new interaction can change this scope.

Describe the choice the Boon changes: targeting, card order, preparation, team composition, defense, recovery or resource use. Give a plausible play sequence and identify when the effect is useful. For a team-building Boon, name the complementary roles or mechanics it brings together and explain a recruitment or deployment decision it would change. Favor bridges between existing kits over a bonus for bringing one named species or a required pair. A niche can be healthy; every Boon need not benefit every team. Avoid rewards that encourage stalling, farming helpless enemies, deliberately losing allies or repeatedly performing menu actions.

Apply a strategy test: without quoting its numbers or adding a new battle input, explain what existing play becomes useful and why a different team or sequence becomes attractive. "The same plan deals more damage" is a weak default answer. Rule changes should remain legible and faithful to the artifact; complexity and novelty alone do not establish strategic depth.

Every Boon needs a unique mechanical identity among existing Boons and the proposed set. A new name, number, damage type or trigger attached to the same generic reward does not by itself establish uniqueness. Name the nearest overlap with a Boon, talent or passive and explain the different decision or interaction. Reuse existing mechanics where they serve the concept; do not invent a new subsystem solely to make an artifact seem special.

## Keep the benefit controlled

Design beneficial rule changes without explicit penalties or hidden downsides. Preserve existing actions and useful outcomes while adding an automatic benefit. A mandatory conversion, redirection, card return or resource transfer can weaken an established strategy even when its wording sounds positive; check what is lost, what gets consumed and which existing effects are displaced. Redesign harmful interactions rather than repairing them with an optional activation or another choice. Do not offset an oversized reward with a punishment.

Aim for more viable strategies rather than a universally stronger baseline. Use natural specialization, player choice, bounded existing resources and a modest payoff to restrain power. Check against existing Boons and Fauna's 1-Mana authored abilities. Explain why the strongest benefiting team still faces meaningful combat decisions and why this does not become the automatic choice for most teams. Avoid broadly replacing a creature's defining passive, making a specific composition compulsory, trivializing enemy defenses or making a current Boon obsolete. Thematic rule changes may introduce supported exceptions to combat rules; they do not authorize bypassing ownership, deterministic resolution or save correctness.

Trace the strongest plausible interactions: multi-hit and area attacks, repeats, free plays, draws and copies, healing and Leech, reflection, Minions, swaps, control immunity and other Boon reactions. Check whether the payoff can feed its own trigger directly or through another effect. Distinguish actual Health restored or lost from attempted values and overkill. Resolve dangerous feedback through the mechanic itself, smaller values or a precise, necessary restriction; redesign if the result needs a stack of exceptions or routine phase caps. Do not silently disable established synergies to make an attractive proposal appear safe.

State initial values and the main balance uncertainty. Reasoned estimates are proposals, not measured balance or tested implementation. Do not launch simulations or broad checks for brainstorming.

## Write the player rule

Supply one exact player-facing description with simple, elegant wording that evokes the artifact's behavior. The main text communicates the core rule rather than every execution detail. For example, "Your Mana can overflow", "Cards Dodged by enemies return to your hand" and "Overkill damage spreads to other enemies" establish the right level of brevity. "Your Light hits Blind Burning enemies" is a strong model: concise, thematic and strategically clear. Do not restore technical qualifiers such as "single-target", "all its hits", "first living enemy" or a numeric cap by default merely because the engine needs an exact contract. Include a number or restriction when it is essential to understanding the effect; otherwise keep tuning, recipient tie-breaks and execution details in design notes and canonical rules. Simplify unnecessary mechanical restrictions as well as the prose, and ensure the short description remains true to the intended behavior.

Follow [effect-copy rules](../../../AGENTS.md#high-risk-invariants): no periods; use semicolons only when needed. Evoke the theme through the rule's verbs rather than adding decorative flavor sentences, taglines or helper text. Avoid redundant category labels and unnecessary new keywords.

Keep the relationships and conditions needed to understand the strategy; brevity must not promise a different effect. Do not use familiar words such as hit, attack, draw, Cleanse or Purge for a different rule. Describe the automatic rule directly rather than offering a permission with "You may". Explain how its outcome remains legible through existing feedback; redesign concepts that require new battle inputs or administration.

Use natural keyword inflections freely and give every used form its canonical keyword color: Burning shares Burn's identity, Dodged shares Dodge's, and Purged shares Purge's. Check [keyword aliases](../../../src/game/keywords.ts) and the shared [KeywordText renderer](../../../src/ui/shared/keyword-text.tsx); register missing forms at that owner when implementing them rather than adding per-Boon styling or forcing awkward base-word phrasing. Preserve the written word and casing. Keyword colors belong in game rendering, not improvised color markup in a chat proposal.

For each requested proposal, provide the Boon name and artwork link, exact effect text, the visual/thematic connection and the rule or strategic decision it changes. Include team-building implications, the nearest overlap and balance concern where material; keep straightforward entries concise. Review a batch together for repeated mechanics, numerical filler, new interaction burdens, hidden downsides, dominant compositions, excessive power and repetitive timing language. Do not preserve an earlier candidate just to fill a requested count if it fails these criteria.

If implementation is requested, follow the existing [modifier ownership and asset contracts](../../../Docs/CONTENT.md#adding-gameplay-modifiers) and repository verification policy. New card interactions also use the [UI design skill](../fauna-ui-design/SKILL.md); asset selection or changes use the [art direction skill](../fauna-art-direction/SKILL.md). Separate implemented behavior, rendered evidence, artistic acceptance and measured balance.
